// public/script.js

// Store selected files in an array for easier management
let selectedFiles = [];

document.addEventListener('DOMContentLoaded', () => {
    const analysisForm = document.getElementById('analysisForm');
    const uploadBox = document.querySelector('.upload-box-modern');
    const fileInput = document.getElementById('fileInput');
    const fileListDisplay = document.getElementById('fileList'); // Changed from fileName
    const loader = document.getElementById('loader');
    const analyzeButton = document.getElementById('analyzeButton');
    const errorMessage = document.getElementById('errorMessage');

    if (uploadBox && fileInput) {
        // Make upload box keyboard accessible
        uploadBox.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                fileInput.click();
            }
        });
        
        uploadBox.addEventListener('click', (e) => {
            // Prevent triggering click if a file-remove button was clicked
            if (e.target.classList.contains('file-remove-btn')) {
                return;
            }
            fileInput.click();
        });

        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            uploadBox.addEventListener(eventName, preventDefaults, false);
            document.body.addEventListener(eventName, preventDefaults, false);
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            uploadBox.addEventListener(eventName, () => uploadBox.classList.add('highlight-border'), false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            uploadBox.addEventListener(eventName, () => uploadBox.classList.remove('highlight-border'), false);
        });

        uploadBox.addEventListener('drop', handleDrop, false);
        fileInput.addEventListener('change', handleFileSelect, false);
        
        // Add event listener for removing files
        fileListDisplay.addEventListener('click', handleFileRemove, false);
    }

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        handleFiles(files);
    }

    function handleFileSelect(event) {
        const files = event.target.files;
        handleFiles(files);
        // Reset file input to allow re-selection of the same file
        fileInput.value = '';
    }

    function handleFiles(files) {
        showError(''); // Clear any previous errors
        for (const file of files) {
            // Client-side validation
            const isValidType = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'].includes(file.type);
            const isValidSize = file.size <= 5 * 1024 * 1024; // 5MB limit

            if (!isValidType) {
                showError(`Invalid file type: ${file.name}. Only PDF, DOC, and DOCX are allowed.`);
                continue;
            }
            if (!isValidSize) {
                showError(`File is too large: ${file.name}. Max size is 5MB.`);
                continue;
            }
            
            // Add to array if valid and not already added
            if (!selectedFiles.find(f => f.name === file.name && f.size === file.size)) {
                selectedFiles.push(file);
            }
        }
        updateFileListUI();
    }

    function updateFileListUI() {
        fileListDisplay.innerHTML = ''; // Clear current list
        if (selectedFiles.length === 0) {
            fileListDisplay.innerHTML = '<li class="file-list-placeholder">No resumes selected.</li>';
        } else {
            selectedFiles.forEach((file, index) => {
                const li = document.createElement('li');
                li.className = 'file-list-item';
                li.innerHTML = `
                    <span>${file.name}</span>
                    <button type="button" class="file-remove-btn" data-index="${index}" aria-label="Remove ${file.name}">&times;</button>
                `;
                fileListDisplay.appendChild(li);
            });
        }
    }
    
    function handleFileRemove(event) {
        if (event.target.classList.contains('file-remove-btn')) {
            event.preventDefault();
            event.stopPropagation();
            const index = parseInt(event.target.getAttribute('data-index'), 10);
            selectedFiles.splice(index, 1); // Remove from array
            updateFileListUI();
        }
    }
    
    // Initialize file list UI on load
    if (fileListDisplay) {
         updateFileListUI();
    }

    if (analysisForm) {
        analysisForm.addEventListener('submit', async function(event) {
            event.preventDefault();
            showLoading(true);
            showError(''); // Clear previous errors
            console.log('Analyze form submitted');

            const jobDescription = document.getElementById('jobDescription').value;

            if (selectedFiles.length === 0 || !jobDescription) {
                showLoading(false);
                showError('Please select at least one resume file and paste a job description.');
                return;
            }

            // Collect filters from UI
            const filters = {
                minScore: document.getElementById('filterMinScore') ? parseInt(document.getElementById('filterMinScore').value, 10) : 0,
                experience: document.getElementById('filterExperience') ? document.getElementById('filterExperience').value : 'any',
                location: document.getElementById('filterLocation') ? document.getElementById('filterLocation').value.trim() : '',
                requiredSkills: document.getElementById('filterRequiredSkills') ? document.getElementById('filterRequiredSkills').value.split(',').map(s=>s.trim()).filter(Boolean) : [],
                minEducation: document.getElementById('filterMinEducation') ? document.getElementById('filterMinEducation').value : 'any',
                requiredCerts: document.getElementById('filterRequiredCerts') ? document.getElementById('filterRequiredCerts').value.split(',').map(s=>s.trim()).filter(Boolean) : [],
                preferredKeywords: document.getElementById('filterPreferredKeywords') ? document.getElementById('filterPreferredKeywords').value.split(',').map(s=>s.trim()).filter(Boolean) : [],
                blacklist: document.getElementById('filterBlacklist') ? document.getElementById('filterBlacklist').value.split(',').map(s=>s.trim()).filter(Boolean) : []
            };

            // *** REAL BACKEND INTEGRATION ***
            try {
                console.log('Selected files count:', selectedFiles.length);
                const formData = new FormData();
                selectedFiles.forEach(file => {
                    formData.append('resumeFiles', file);
                });
                formData.append('jobDescription', jobDescription);
                // Append filters to the form data so server can log/use them if needed
                formData.append('filters', JSON.stringify(filters));

                console.log('Sending request to /analyze-batch with jobDescription length:', jobDescription.length);
                const response = await fetch('/analyze-batch', {
                    method: 'POST',
                    body: formData
                });

                if (!response.ok) {
                    let text;
                    try { text = await response.text(); } catch (e) { text = response.statusText; }
                    console.error('Server returned non-OK response', response.status, text);
                    // Try to extract JSON error if possible
                    try {
                        const errorData = JSON.parse(text);
                        throw new Error(errorData.error || errorData.message || `Server error: ${response.statusText}`);
                    } catch (jsonErr) {
                        throw new Error(`Server error: ${response.status} - ${text}`);
                    }
                }

                const results = await response.json();
                
                if (results.error) {
                     throw new Error(results.error);
                }

                // Store results together with filters and redirect
                const payload = { results, filters };
                sessionStorage.setItem('analysisResults', JSON.stringify(payload));
                window.location.href = 'results.html';

            } catch (error) {
                console.error('Caught Error:', error);
                showError(`Analysis failed: ${error.message}`);
            } finally {
                showLoading(false);
            }
        });
    }

    // Update min score label on upload page filter
    const filterMinScoreEl = document.getElementById('filterMinScore');
    const minScoreVal = document.getElementById('minScoreVal');
    if (filterMinScoreEl && minScoreVal) {
        filterMinScoreEl.addEventListener('input', () => {
            minScoreVal.textContent = filterMinScoreEl.value;
        });
    }

    function showLoading(isLoading) {
        if (isLoading) {
            loader.style.display = 'block';
            analyzeButton.disabled = true;
            analyzeButton.style.opacity = '0.6';
        } else {
            loader.style.display = 'none';
            analyzeButton.disabled = false;
            analyzeButton.style.opacity = '1';
        }
    }

    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.style.display = message ? 'block' : 'none';
    }
});

