const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();

// Set up Multer for file uploads
const upload = multer({ dest: 'uploads/' });

// Serve static files from the current directory
app.use(express.static(path.join(__dirname)));

// Helper function to find the name from resume content (placeholder)
function findNameFromResume(resumeContent) {
    // NOTE: This is a placeholder. For production, you will need a robust library
    // to parse different file types (e.g., pdf-parse for PDFs).
    const lines = resumeContent.split('\n');
    return lines[0].trim() || 'Unknown User';
}

// Function to simulate keyword analysis
function analyzeResume(resumeText, jobDescription) {
    const jobKeywords = jobDescription.toLowerCase().split(/\s+/).filter(word => word.length > 2);
    const resumeTextLower = resumeText.toLowerCase();

    const foundKeywords = jobKeywords.filter(keyword => resumeTextLower.includes(keyword));
    const missingKeywords = jobKeywords.filter(keyword => !resumeTextLower.includes(keyword));

    const totalKeywords = jobKeywords.length;
    const atsScore = totalKeywords > 0 ? Math.round((foundKeywords.length / totalKeywords) * 100) : 0;
    const matchPercentage = atsScore;

    const suggestions = [
        'Use action verbs to describe your experience.',
        'Quantify your achievements with numbers and metrics.',
        'Tailor your resume to each job description.',
    ];

    return {
        atsScore,
        matchPercentage,
        foundKeywords,
        missingKeywords,
        suggestions
    };
}

// The main POST endpoint to handle resume analysis
app.post('/analyze', upload.single('resumeFile'), async (req, res) => {
    try {
        const resumeFile = req.file;
        const jobDescription = req.body.jobDescription;

        if (!resumeFile || !jobDescription) {
            return res.status(400).json({ error: 'Please upload a resume and provide a job description.' });
        }

        const resumeContent = fs.readFileSync(resumeFile.path, 'utf8');
        const name = findNameFromResume(resumeContent);
        const analysisResults = analyzeResume(resumeContent, jobDescription);

        // Combine all results into a single JSON response
        res.json({
            name: name,
            ...analysisResults
        });

    } catch (error) {
        console.error('Error processing resume:', error);
        res.status(500).json({ error: 'Failed to analyze the resume. Please try again.' });
    } finally {
        // Clean up the uploaded file
        if (req.file) {
            fs.unlink(req.file.path, (err) => {
                if (err) console.error('Error deleting uploaded file:', err);
            });
        }
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});