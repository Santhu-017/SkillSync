// server.js
// Admin endpoint and feedback-related endpoints removed; weights read from environment variables
// server.js

const express = require('express');
const multer = require('multer');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const pdf = require('pdf-parse');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path');

// Load environment variables from .env file
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Serve the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Initialize multer to handle file uploads in memory
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });
// (feedback storage removed)
const { computeEligibility, reloadWeights, getWeights } = require('./lib/eligibility');
const { sendResultsEmail } = require('./lib/mailer');

// Function to call Gemini API for a single resume
async function analyzeResumeWithGemini(resumeText, jobDescription) {
    try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

        // Model selection: try configured model first, then fall back to known working models
        const preferModel = process.env.GEMINI_MODEL || 'models/gemini-2.5-flash';
        const fallbackCandidates = [
            preferModel,
            'models/gemini-2.5-flash',
            'models/gemini-2.5-pro',
            'models/gemini-2.0-flash',
            'models/gemini-pro',
            'models/gemini',
            
        ];
        let lastErr = null;
        let chosenModel = null;
        let result = null;

        const prompt = [
            'Analyze the following resume against the provided job description.',
            'Your response MUST be a valid JSON object only, without any markdown formatting.',
            '',
            'IMPORTANT: You must include all of the following keys in your JSON response, even if you cannot find the information. If a value is not found, return an empty array [] for lists, or "N/A" for strings.',
            '',
            'Return a JSON object with this exact structure:',
            '{',
            '  "name": "<The full name of the candidate extracted from the resume>",',
            '  "email": "<The email address of the candidate extracted from the resume, or "N/A" if not found>",',
            '  "atsScore": <An estimated ATS score from 0 to 100, representing how well the resume matches the job description>,',
            '  "eligibility": "<A one-word eligibility status: \"Eligible\", \"Potential Fit\", or \"Not a Fit\">",',
            '  "foundKeywords": [],',
            '  "missingKeywords": [],',
            '  "extractedSkills": [],',
            '  "extractedSoftSkills": [],',
            '  "extractedEducation": [{ "degree": "<Degree>", "institution": "<Institution>", "year": "<Year>" }],',
            '  "extractedExperience": [{ "title": "<Job Title>", "company": "<Company>", "duration": "<Dates of Employment>" }]',
            '}',
            '',
            'Job Description:',
            jobDescription,
            '',
            'Resume Text:',
            resumeText
        ].join('\n');

        for (const candidate of fallbackCandidates) {
            try {
                const model = genAI.getGenerativeModel({ model: candidate });
                const attempt = await model.generateContent(prompt);
                const response = await attempt.response;
                const text = response.text();
                const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();
                const parsed = JSON.parse(cleanedText);
                chosenModel = candidate;
                result = parsed;
                break;
            } catch (err) {
                lastErr = err;
                console.warn(`Model ${candidate} failed:`, err && err.message ? err.message : err);
            }
        }

        if (!result) {
            console.error('All model candidates failed. Last error:', lastErr);
            return { error: true, message: 'No available generative model responded. Check GEMINI_MODEL env or your API access.' };
        }

        console.log('analyzeResumeWithGemini: used model', chosenModel);
        return result;

    } catch (error) {
        console.error('Error in Gemini analysis:', error);
        return { error: true, message: 'Failed to analyze with AI.' };
    }
}

// Corrected endpoint for BATCH analysis
app.post('/analyze-batch', upload.array('resumeFiles'), async (req, res) => {
    try {
        console.log('/analyze-batch called - files:', req.files ? req.files.length : 0, 'body keys:', Object.keys(req.body));
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No resume files uploaded.' });
        }

        const jobDescription = req.body.jobDescription;
        if (!jobDescription) {
             return res.status(400).json({ error: 'Job description is missing.' });
        }

        // Parse filters if provided (sent as JSON string from client)
        let filters = {};
        if (req.body.filters) {
            try {
                filters = typeof req.body.filters === 'string' ? JSON.parse(req.body.filters) : req.body.filters;
            } catch (e) {
                console.warn('Failed to parse filters JSON:', e && e.message ? e.message : e);
                filters = {};
            }
        }

        const analysisPromises = req.files.map(async (file) => {
            try {
                const pdfBuffer = file.buffer;
                const data = await pdf(pdfBuffer);
                const resumeText = data.text;
                
                const analysisResult = await analyzeResumeWithGemini(resumeText, jobDescription);

                if(analysisResult.error){
                    return {
                        name: file.originalname,
                        email: "N/A",
                        atsScore: 0,
                        eligibility: "Error",
                        ...analysisResult
                    }
                }

                // Compute a more advanced eligibility score and breakdown on the server
                try {
                    const enriched = computeEligibility(analysisResult, resumeText, filters, jobDescription);
                    return { ...analysisResult, ...enriched };
                } catch (e) {
                    console.warn('Eligibility computation failed:', e && e.message ? e.message : e);
                    return analysisResult;
                }

            } catch (pdfError) {
                console.error(`Error parsing file ${file.originalname}:`, pdfError);
                return { 
                    name: file.originalname,
                    email: "N/A",
                    atsScore: 0,
                    eligibility: "Error",
                    error: true,
                    message: "Failed to parse PDF file."
                };
            }
        });

        let results = await Promise.all(analysisPromises);
        results.sort((a, b) => (b.atsScore || 0) - (a.atsScore || 0));
        res.json(results);

    } catch (error) {
        console.error('Error during batch analysis:', error);
        res.status(500).json({ error: 'An error occurred while analyzing the resumes.' });
    }
});

// Bind host can be overridden with HOST env var; default to 0.0.0.0 for broad listening.
const host = process.env.HOST || '0.0.0.0';
app.listen(port, host, () => {
    // Use a displayable host for opening a browser (browsers cannot navigate to 0.0.0.0).
    const displayHost = host === '0.0.0.0' ? '127.0.0.1' : host;
    const baseUrl = `http://${displayHost}:${port}`;
    console.log(`Server is running at ${baseUrl} (listening on ${host})`);

    // Auto-open browser on server start (cross-platform)
    try {
        const { exec } = require('child_process');
        const platform = process.platform;
        if (process.env.NO_AUTO_OPEN) {
            console.log('Auto-open disabled via NO_AUTO_OPEN env var.');
            return;
        }
        if (platform === 'win32') {
            // Use cmd start for Windows
            exec(`start "" "${baseUrl}"`);
        } else if (platform === 'darwin') {
            exec(`open "${baseUrl}"`);
        } else {
            // Assume Linux/Unix
            exec(`xdg-open "${baseUrl}"`);
        }
    } catch (err) {
        console.error('Failed to auto-open browser:', err && err.message ? err.message : err);
    }
});

// Diagnostic endpoint: List available Generative AI models for this API key
app.get('/list-models', async (req, res) => {
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) return res.status(400).json({ error: 'GEMINI_API_KEY not set in .env' });

        const url = `https://generativelanguage.googleapis.com/v1/models?key=${encodeURIComponent(apiKey)}`;
        const resp = await fetch(url, { method: 'GET' });
        const data = await resp.text();

        // Try parse JSON, otherwise return raw text
        try {
            return res.json(JSON.parse(data));
        } catch (e) {
            return res.type('text').send(data);
        }
    } catch (err) {
        console.error('Error calling ListModels:', err);
        res.status(500).json({ error: 'Failed to call ListModels', detail: err && err.message });
    }
});
// Admin and feedback-related endpoints were removed; weights use environment variables

// Endpoint to send shortlist emails to candidates (uses Brevo / Sendinblue)
app.post('/send-results', async (req, res) => {
    try {
        // Accept JSON, urlencoded, or plain string bodies from various clients
        let payload = req.body;
        if (!payload || (typeof payload === 'object' && Object.keys(payload).length === 0)) {
            // try parsing raw body if present as string
            if (typeof req.body === 'string' && req.body.trim().length > 0) {
                try { payload = JSON.parse(req.body); } catch (e) { /* ignore */ }
            }
        }

        // also allow query params as a fallback
        const to = (payload && payload.to) || req.query.to;
        const subject = (payload && payload.subject) || req.query.subject || 'Shortlist Notification';
        const html = (payload && payload.html) || req.query.html || '<p>Your resume has been shortlisted.</p>';
        const attachments = (payload && payload.attachments) || req.query.attachments || [];

        if (!to) return res.status(400).json({ error: 'Recipient (to) is required' });

        console.log('/send-results payload:', { to, subject, hasHtml: !!html, attachmentsCount: (attachments || []).length });
        const resp = await sendResultsEmail(to, subject, html, attachments || []);
        // Log the Brevo/SDK response for troubleshooting delivery
        try { console.log('/send-results Brevo response:', JSON.stringify(resp)); } catch (e) { console.log('/send-results Brevo response (raw):', resp); }
        return res.json({ ok: true, resp });
    } catch (err) {
        console.error('Error sending results email:', err && err.message ? err.message : err);
        return res.status(500).json({ error: err && err.message ? err.message : 'Failed to send email' });
    }
});

// Generate a suggested email (subject + html) from a resume or candidate data using Gemini
app.post('/generate-email', express.json(), async (req, res) => {
    try {
        const { resumeText, candidate, jobDescription } = req.body || {};
        if (!resumeText && !candidate) return res.status(400).json({ error: 'resumeText or candidate is required' });

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const preferModel = process.env.GEMINI_MODEL || 'models/gemini-2.5-flash';
        const fallbackCandidates = [
            preferModel,
            'models/gemini-2.5-flash',
            'models/gemini-2.5-pro',
            'models/gemini-2.0-flash',
            'models/gemini-pro',
            'models/gemini',
            'models/text-bison-001'
        ];

        // Build prompt
        const promptParts = [];
        promptParts.push('You are a helpful recruiting assistant.');
        promptParts.push('Create a short professional email to inform a candidate they have been shortlisted.');
        promptParts.push('Return exactly a JSON object with keys: subject (string), html (string).');
        promptParts.push('Use the resume content or candidate details to personalize the message. If information is missing, use generic placeholders.');
        if (jobDescription) {
            promptParts.push('\nJob Description:\n' + jobDescription);
        }
        if (resumeText) {
            promptParts.push('\nResume Text:\n' + resumeText);
        } else if (candidate) {
            promptParts.push('\nCandidate Details:\n' + JSON.stringify(candidate, null, 2));
        }

        const prompt = promptParts.join('\n');

        let lastErr = null;
        for (const modelName of fallbackCandidates) {
            try {
                const model = genAI.getGenerativeModel({ model: modelName });
                const attempt = await model.generateContent(prompt);
                const response = await attempt.response;
                const text = response.text().trim();
                const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
                const parsed = JSON.parse(cleaned);
                return res.json(parsed);
            } catch (err) {
                lastErr = err;
                console.warn('Model', modelName, 'failed to generate email:', err && err.message ? err.message : err);
            }
        }

        console.error('All models failed to generate email. Last error:', lastErr);
        return res.status(500).json({ error: 'Failed to generate email from LLM' });
    } catch (err) {
        console.error('Error in /generate-email:', err);
        return res.status(500).json({ error: err && err.message ? err.message : 'Failed' });
    }
});