// --- GLOBAL VARS ---
let allResultsData = []; // Stores the original full dataset
let currentSort = {
    column: 'score',
    direction: 'desc'
};
let isModalOpen = false;
const modal = document.getElementById('detailsModal');
const closeButton = modal ? modal.querySelector('.close-button') : null;

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    // Support both legacy array and new { results, filters } payload
    const stored = JSON.parse(sessionStorage.getItem('analysisResults'));
    const resultsData = stored && stored.results ? stored.results : stored;
    const appliedFilters = stored && stored.filters ? stored.filters : null;
    const resultsContent = document.getElementById('resultsContent');
    const noResultsDiv = document.getElementById('noResults');
    const filterBar = document.getElementById('filterBar');

    if (!resultsData || !Array.isArray(resultsData) || resultsData.length === 0) {
        if (resultsContent) resultsContent.style.display = 'none';
        if (filterBar) filterBar.style.display = 'none';
        if (noResultsDiv) noResultsDiv.style.display = 'block';
        return;
    }

    // Store original data
    allResultsData = resultsData;

    // If filters were stored with the results, initialize the UI
    if (appliedFilters) {
        const minScoreEl = document.getElementById('filterScore');
        const minScoreVal = document.getElementById('filterScoreValue');
        if (minScoreEl && minScoreVal) {
            minScoreEl.value = appliedFilters.minScore || 0;
            minScoreVal.textContent = appliedFilters.minScore || 0;
        }
        const keywordEl = document.getElementById('filterKeyword');
        if (keywordEl && appliedFilters.requiredSkills && appliedFilters.requiredSkills.length > 0) {
            // Populate the dedicated required skills input on the results page
            const reqSkillsEl = document.getElementById('filterRequiredSkills');
            if (reqSkillsEl) reqSkillsEl.value = appliedFilters.requiredSkills.join(', ');
        }
    }
    
    // Show filter bar
    if (filterBar) filterBar.style.display = 'flex';

    // Initial sort and populate
    sortData(allResultsData, currentSort.column, currentSort.direction);
    populateResultsTable(allResultsData);
    addDetailButtonListeners(allResultsData);
    updateSortUI();

    // --- ADD EVENT LISTENERS (ONLY ONCE) ---
    
    // Filter Listeners
    const keywordInput = document.getElementById('filterKeyword');
    if (keywordInput) keywordInput.addEventListener('input', applyFilters);
    document.getElementById('filterEligibility').addEventListener('change', applyFilters);
    document.getElementById('filterScore').addEventListener('input', handleScoreSlider);
    // Add support for required skills filter (comma-separated in separate UI)
    const requiredSkillsInput = document.getElementById('filterRequiredSkills');
    if (requiredSkillsInput) requiredSkillsInput.addEventListener('input', applyFilters);

    // Sort Listeners
    document.querySelectorAll('.results-table th.sortable').forEach(th => {
        th.addEventListener('click', handleSort);
    });
    
    // Export Listener
    document.getElementById('exportCsvButton').addEventListener('click', exportToCsv);

    // Modal Listeners
    if (modal && closeButton) {
        closeButton.onclick = closeModal;
        window.addEventListener('keydown', handleEscKey);
        window.onclick = (event) => {
            if (event.target == modal && isModalOpen) {
                closeModal();
            }
        }
    }
    // (feedback UI removed)
});

// --- FILTERING & SORTING ---

function handleScoreSlider(e) {
    document.getElementById('filterScoreValue').textContent = e.target.value;
    applyFilters();
}

function applyFilters() {
    const keyword = document.getElementById('filterKeyword') ? document.getElementById('filterKeyword').value.toLowerCase() : '';
    const eligibility = document.getElementById('filterEligibility').value;
    const score = parseInt(document.getElementById('filterScore').value, 10);
    const requiredSkillsRaw = document.getElementById('filterRequiredSkills') ? document.getElementById('filterRequiredSkills').value : '';
    const requiredSkills = requiredSkillsRaw.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

    let filteredData = [...allResultsData];

    // 1. Filter by Keyword (Name, Email, Skills)
    if (keyword) {
        filteredData = filteredData.filter(item => 
            (item.name && item.name.toLowerCase().includes(keyword)) ||
            (item.email && item.email.toLowerCase().includes(keyword)) ||
            (item.extractedSkills && item.extractedSkills.some(skill => skill.toLowerCase().includes(keyword)))
        );
    }

    // 2. Filter by Eligibility
    if (eligibility !== 'all') {
        filteredData = filteredData.filter(item => item.eligibility === eligibility);
    }

    // 3. Filter by Score
    filteredData = filteredData.filter(item => (item.atsScore || 0) >= score);

    // 4. Filter by required skills if provided - candidate must contain all required skills
    if (requiredSkills.length > 0) {
        filteredData = filteredData.filter(item => {
            const skills = (item.extractedSkills || []).map(s => s.toLowerCase());
            return requiredSkills.every(rs => skills.includes(rs));
        });
    }

    // 4. Re-sort the filtered data
    sortData(filteredData, currentSort.column, currentSort.direction);
    
    // 5. Re-populate the table
    populateResultsTable(filteredData);
    addDetailButtonListeners(filteredData); // Re-add listeners to new buttons
}

function handleSort(e) {
    const newColumn = e.currentTarget.dataset.sort;

    let newDirection;
    if (currentSort.column === newColumn) {
        newDirection = currentSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
        newDirection = (newColumn === 'name') ? 'asc' : 'desc';
    }
    
    currentSort.column = newColumn;
    currentSort.direction = newDirection;

    updateSortUI();
    applyFilters(); // Re-apply filters which will also sort
}

function sortData(data, column, direction) {
    data.sort((a, b) => {
        const valA = (column === 'score') ? (a.atsScore || 0) : (a.name || '').toLowerCase();
        const valB = (column === 'score') ? (b.atsScore || 0) : (b.name || '').toLowerCase();

        if (valA < valB) {
            return direction === 'asc' ? -1 : 1;
        }
        if (valA > valB) {
            return direction === 'asc' ? 1 : -1;
        }
        return 0;
    });
    return data;
}

function updateSortUI() {
    document.querySelectorAll('.results-table th.sortable').forEach(th => {
        if (th.dataset.sort === currentSort.column) {
            th.setAttribute('data-sort-dir', currentSort.direction);
        } else {
            th.removeAttribute('data-sort-dir');
        }
    });
}

// --- TABLE & UI POPULATION ---

function populateResultsTable(data) {
    const tableBody = document.getElementById('resultsTableBody');
    if (!tableBody) return;
    tableBody.innerHTML = ''; // Clear previous results

    if (data.length === 0) {
         tableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px; color: #666;">No candidates match your filters.</td></tr>';
         return;
    }

    data.forEach((candidate, index) => {
        const row = document.createElement('tr');
        const eligibilityClass = getEligibilityClass(candidate.eligibility);

        row.innerHTML = `
            <td data-label="Rank">#${index + 1}</td>
            <td data-label="Candidate">
                <div>
                    <div class="candidate-name">${candidate.name || 'N/A'}</div>
                    <div class="candidate-email">${candidate.email || 'N/A'}</div>
                </div>
            </td>
            <td data-label="Score">
                <div class="score-value">${candidate.atsScore || 0}%</div>
            </td>
            <td data-label="Status">
                <span class="badge ${eligibilityClass}">${candidate.eligibility || 'N/A'}</span>
            </td>
            <td data-label="Actions">
                <div class="action-buttons">
                    <button class="btn btn-secondary btn-sm view-details" data-index="${index}">View Details</button>
                    ${ (candidate.eligibility === 'Eligible' && candidate.email && candidate.email !== 'N/A') ? `<button class="btn btn-primary btn-sm send-email" data-index="${index}">Send Shortlist</button>` : '' }
                </div>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

function getEligibilityClass(eligibility) {
    if (eligibility === 'Eligible') return 'badge-eligible';
    if (eligibility === 'Potential Fit') return 'badge-potential';
    if (eligibility === 'Error') return 'badge-error';
    return 'badge-not-fit';
}

function addDetailButtonListeners(data) {
    // Replace view-details buttons with clones to remove old listeners
    document.querySelectorAll('.view-details').forEach(button => {
        button.replaceWith(button.cloneNode(true));
    });

    // Add click handlers for the view-details buttons
    document.querySelectorAll('.view-details').forEach(button => {
        button.addEventListener('click', (e) => {
            const index = e.target.getAttribute('data-index');
            // Find the *actual* data from the filtered list
            const candidateData = data[index];
            if (candidateData) {
                showDetailsModal(candidateData);
            }
        });
    });

    // Replace send-email buttons to remove previous listeners
    document.querySelectorAll('.send-email').forEach(button => {
        button.replaceWith(button.cloneNode(true));
    });

    // Add handlers for send-email buttons -> open compose modal
    document.querySelectorAll('.send-email').forEach(button => {
        button.addEventListener('click', (e) => {
            const idx = e.target.getAttribute('data-index');
            const candidateData = data[idx];
            if (!candidateData) return;
            if (candidateData.eligibility !== 'Eligible' || !candidateData.email || candidateData.email === 'N/A') {
                alert('Candidate is not eligible or has no valid email.');
                return;
            }
            openComposeModal(candidateData, e.target);
        });
    });
}

// --- MODAL LOGIC (FIXED) ---

function closeModal() {
    if (modal) modal.style.display = 'none';
    isModalOpen = false;
}

function handleEscKey(event) {
    if (event.key === 'Escape' && isModalOpen) {
        closeModal();
    }
}

function showDetailsModal(candidate) {
    if (!modal || !closeButton) return;

    document.getElementById('modalCandidateName').textContent = `${candidate.name || 'Candidate'}'s Full Analysis`;
    populatePills(document.getElementById('modalMissingKeywords'), candidate.missingKeywords, 'keyword-pill missing');
    populatePills(document.getElementById('modalFoundKeywords'), candidate.foundKeywords, 'keyword-pill found');
    populatePills(document.getElementById('modalSkills'), candidate.extractedSkills, 'keyword-pill skill');
    populatePills(document.getElementById('modalSoftSkills'), candidate.extractedSoftSkills, 'keyword-pill soft-skill');
    populateDetailList(document.getElementById('modalEducation'), candidate.extractedEducation, 'education');
    populateDetailList(document.getElementById('modalExperience'), candidate.extractedExperience, 'experience');

    // Eligibility score and breakdown (if provided by server)
    const scoreEl = document.getElementById('modalEligibilityScore');
    const breakdownEl = document.getElementById('modalEligibilityBreakdown');
    if (scoreEl) scoreEl.textContent = (candidate.eligibilityScore !== undefined) ? `${candidate.eligibilityScore}% - ${candidate.eligibility || ''}` : (candidate.eligibility || 'N/A');
    if (breakdownEl) populateEligibilityBreakdown(breakdownEl, candidate.eligibilityBreakdown);

    modal.style.display = 'block';
    isModalOpen = true;
}

// --- HELPER FUNCTIONS ---

function populatePills(container, items, pillClass) {
    container.innerHTML = '';
    if (items && items.length > 0) {
        items.forEach(item => {
            const pill = document.createElement('div');
            pill.className = pillClass;
            pill.textContent = item;
            container.appendChild(pill);
        });
    } else {
        container.innerHTML = '<p class="not-found-text">None found.</p>';
    }
}

function populateDetailList(listElement, items, type) {
    listElement.innerHTML = '';
    if (items && items.length > 0) {
        items.forEach(item => {
            const li = document.createElement('li');
            if (type === 'education') {
                li.innerHTML = `<strong>${item.degree || 'N/A'}</strong><span>${item.institution || 'N/A'} (${item.year || 'N/A'})</span>`;
            } else if (type === 'experience') {
                li.innerHTML = `<strong>${item.title || 'N/A'}</strong><span>${item.company || 'N/A'} (${item.duration || 'N/A'})</span>`;
            }
            listElement.appendChild(li);
        });
    } else {
        listElement.innerHTML = '<li class="not-found-text">None found.</li>';
    }
}

// --- EXPORT TO CSV ---

function exportToCsv() {
    // Get the currently filtered and sorted data
    const keyword = document.getElementById('filterKeyword').value.toLowerCase();
    const eligibility = document.getElementById('filterEligibility').value;
    const score = parseInt(document.getElementById('filterScore').value, 10);
    let dataToExport = [...allResultsData];
    if (keyword) {
        dataToExport = dataToExport.filter(item => (item.name && item.name.toLowerCase().includes(keyword)) || (item.email && item.email.toLowerCase().includes(keyword)) || (item.extractedSkills && item.extractedSkills.some(skill => skill.toLowerCase().includes(keyword))));
    }
    if (eligibility !== 'all') {
        dataToExport = dataToExport.filter(item => item.eligibility === eligibility);
    }
    dataToExport = dataToExport.filter(item => (item.atsScore || 0) >= score);
    sortData(dataToExport, currentSort.column, currentSort.direction);

    // Define headers
    const headers = ['Name', 'Email', 'ATS_Score', 'Eligibility', 'Found_Keywords', 'Missing_Keywords', 'Skills', 'Soft_Skills'];
    
    // Create CSV content
    let csvContent = "data:text/csv;charset=utf-8," + headers.join(',') + '\n';

    dataToExport.forEach(item => {
        const row = [
            `"${item.name || 'N/A'}"`,
            `"${item.email || 'N/A'}"`,
            item.atsScore || 0,
            item.eligibility || 'N/A',
            `"${(item.foundKeywords || []).join('; ')}"`,
            `"${(item.missingKeywords || []).join('; ')}"`,
            `"${(item.extractedSkills || []).join('; ')}"`,
            `"${(item.extractedSoftSkills || []).join('; ')}"`,
        ];
        csvContent += row.join(',') + '\n';
    });
    
    // Create download link
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'candidate_shortlist.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function populateEligibilityBreakdown(container, breakdown) {
    container.innerHTML = '';
    if (!breakdown) {
        container.innerHTML = '<li class="not-found-text">No breakdown available.</li>';
        return;
    }
    const rows = [];
    if (breakdown.skillsScore !== undefined) rows.push(['Skills', `${breakdown.skillsScore}%`]);
    if (breakdown.expScore !== undefined) rows.push(['Experience', `${breakdown.expScore}%`]);
    if (breakdown.eduScore !== undefined) rows.push(['Education', `${breakdown.eduScore}%`]);
    if (breakdown.certScore !== undefined) rows.push(['Certifications', `${breakdown.certScore}%`]);
    if (breakdown.locationScore !== undefined) rows.push(['Location', `${breakdown.locationScore}%`]);
    if (breakdown.preferredBonus !== undefined) rows.push(['Preferred Bonus', `${breakdown.preferredBonus}%`]);
    if (breakdown.blacklistPenalty !== undefined) rows.push(['Blacklist Penalty', `-${breakdown.blacklistPenalty}%`]);

    rows.forEach(([label, value]) => {
        const li = document.createElement('li');
        li.innerHTML = `<strong>${label}</strong><span>${value}</span>`;
        container.appendChild(li);
    });
}

// --- EMAIL SENDING (client helper) ---
// Send email; accepts optional content override { subject, html }
async function sendShortlistEmail(candidate, content) {
    if (!candidate) throw new Error('Candidate missing');
    // allow overriding recipient via content.to
    const to = (content && content.to) ? content.to : (candidate.email || null);
    if (!to) throw new Error('Recipient (to) is required');
    const subject = (content && content.subject) ? content.subject : `Your application has been shortlisted`;
    const html = (content && content.html) ? content.html : `<p>Dear ${candidate.name || 'Candidate'},</p>
        <p>Thank you for applying. We are pleased to inform you that your resume has been shortlisted for the role you applied for. We will reach out shortly with interview details.</p>
        <p>Best regards,<br/>Recruiting Team</p>`;

    const payload = { to, subject, html };

    const resp = await fetch('/send-results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (!resp.ok) {
        let body;
        try { body = await resp.json(); } catch (e) { body = { error: 'unknown' }; }
        throw new Error(body && body.error ? body.error : `HTTP ${resp.status}`);
    }

    return resp.json();
}

// Ensure the helper is available globally
try { window.sendShortlistEmail = sendShortlistEmail; } catch (e) {}

// --- Compose modal logic ---
let composeModal = null;
let composeCloseBtn = null;
let generateFromResumeBtn = null;
let writeEmailBtn = null;
let composeSubjectEl = null;
let composeBodyEl = null;
let composeToEl = null;
let composeCancelBtn = null;
let composeSendBtn = null;
let composeCurrentCandidate = null;
let composeTriggerButton = null;

function initComposeModal() {
    composeModal = document.getElementById('composeModal');
    if (!composeModal) return;
    composeCloseBtn = composeModal.querySelector('.compose-close');
    generateFromResumeBtn = document.getElementById('generateFromResumeBtn');
    writeEmailBtn = document.getElementById('writeEmailBtn');
    composeSubjectEl = document.getElementById('composeSubject');
    composeToEl = document.getElementById('composeTo');
    composeBodyEl = document.getElementById('composeBody');
    composeCancelBtn = document.getElementById('composeCancel');
    composeSendBtn = document.getElementById('composeSend');

    composeCloseBtn.onclick = closeComposeModal;
    composeCancelBtn.onclick = closeComposeModal;
    generateFromResumeBtn.onclick = async () => {
        if (!composeCurrentCandidate) return;
        generateFromResumeBtn.disabled = true;
        generateFromResumeBtn.textContent = 'Generating...';
        try {
            const payload = {};
            if (composeCurrentCandidate.resumeText) payload.resumeText = composeCurrentCandidate.resumeText;
            else payload.candidate = composeCurrentCandidate;
            if (sessionStorage.getItem('jobDescription')) payload.jobDescription = sessionStorage.getItem('jobDescription');
            const resp = await fetch('/generate-email', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) });
            if (!resp.ok) throw new Error('Generation failed');
            const data = await resp.json();
                composeSubjectEl.value = data.subject || `Your application has been shortlisted`;
                composeBodyEl.value = data.html || composeBodyEl.value;
        } catch (err) {
            console.error('Email generation failed:', err);
            alert('Failed to generate email. You can write one manually.');
        } finally {
            generateFromResumeBtn.disabled = false;
            generateFromResumeBtn.textContent = 'Generate from Resume';
        }
    };

    writeEmailBtn.onclick = () => {
        // simply focus the body for editing
        composeBodyEl.focus();
    };

    composeSendBtn.onclick = async () => {
        if (!composeCurrentCandidate) return;
        const subject = composeSubjectEl.value || `Your application has been shortlisted`;
        const html = composeBodyEl.value || '';
        const toAddress = (composeToEl && composeToEl.value) ? composeToEl.value.trim() : (composeCurrentCandidate.email || '');
        // basic validation
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!toAddress || !emailPattern.test(toAddress)) {
            alert('Please enter a valid recipient email address.');
            return;
        }
        // disable send while sending
        composeSendBtn.disabled = true;
        const originalText = composeSendBtn.textContent;
        composeSendBtn.textContent = 'Sending...';
        try {
            const resp = await sendShortlistEmail(composeCurrentCandidate, { to: toAddress, subject, html });
            // success: update trigger button if provided
            if (composeTriggerButton) {
                composeTriggerButton.textContent = 'Sent';
                composeTriggerButton.classList.remove('btn-primary');
                composeTriggerButton.classList.add('btn-success');
                composeTriggerButton.disabled = true;
            }
            closeComposeModal();
            alert('Email sent successfully');
            return resp;
        } catch (err) {
            console.error('Failed to send email:', err);
            alert('Failed to send email: ' + (err && err.message ? err.message : err));
            composeSendBtn.disabled = false;
            composeSendBtn.textContent = originalText;
        }
    };

    window.addEventListener('keydown', (ev) => {
        if (ev.key === 'Escape' && composeModal && composeModal.style.display === 'block') closeComposeModal();
    });
}

function openComposeModal(candidate, triggerButton) {
    if (!composeModal) initComposeModal();
    composeCurrentCandidate = candidate;
    composeTriggerButton = triggerButton || null;
    // prefill subject and body with a friendly default
    document.getElementById('composeTitle').textContent = `Send email to ${candidate.name || candidate.email}`;
    // prefill recipient (editable)
    if (composeToEl) composeToEl.value = candidate.email || '';
    composeSubjectEl.value = `Your application has been shortlisted`;
    composeBodyEl.value = `Dear ${candidate.name || 'Candidate'},\n\nWe are pleased to inform you that your application has been shortlisted. We will contact you shortly with interview details.\n\nBest regards,\nRecruiting Team`;
    composeModal.style.display = 'block';
}

function closeComposeModal() {
    if (!composeModal) return;
    composeModal.style.display = 'none';
    composeCurrentCandidate = null;
    composeTriggerButton = null;
}

// Initialize compose modal if page already has data
document.addEventListener('DOMContentLoaded', () => initComposeModal());