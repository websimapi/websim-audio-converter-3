document.addEventListener('DOMContentLoaded', function() {
    // Elements
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const fileName = document.getElementById('fileName');
    const conversionOptions = document.getElementById('conversionOptions');
    const convertBtn = document.getElementById('convertBtn');
    const resultSection = document.getElementById('resultSection');
    const downloadLink = document.getElementById('downloadLink');
    const loading = document.getElementById('loading');
    const formatSelect = document.getElementById('formatSelect');
    
    let uploadedFile = null;
    let audioDuration = 0;

    // Check for MediaRecorder support and populate available formats
    setupFormatOptions();
    
    function setupFormatOptions() {
        // Clear existing options
        formatSelect.innerHTML = '';
        
        // Default formats to check
        const formatsToCheck = [
            { value: 'audio/mp3', label: 'MP3', extension: 'mp3' },
            { value: 'audio/wav', label: 'WAV', extension: 'wav' },
            { value: 'audio/ogg', label: 'OGG', extension: 'ogg' },
            { value: 'audio/webm', label: 'WEBM', extension: 'webm' }
        ];
        
        let hasAtLeastOneFormat = false;
        
        // Add only supported formats
        formatsToCheck.forEach(format => {
            if (isFormatSupported(format.value)) {
                const option = document.createElement('option');
                option.value = format.value;
                option.textContent = format.label;
                option.dataset.extension = format.extension;
                formatSelect.appendChild(option);
                hasAtLeastOneFormat = true;
            }
        });
        
        // If no formats are supported, add a fallback
        if (!hasAtLeastOneFormat) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'No supported formats detected';
            formatSelect.appendChild(option);
            convertBtn.disabled = true;
        }
    }
    
    function isFormatSupported(mimeType) {
        if (!window.MediaRecorder) {
            return false;
        }
        
        try {
            return MediaRecorder.isTypeSupported(mimeType);
        } catch (e) {
            console.error(`Error checking support for ${mimeType}:`, e);
            return false;
        }
    }
    
    // Handle drag and drop
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
    });
    
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, highlight, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, unhighlight, false);
    });
    
    function highlight() {
        dropZone.classList.add('highlight');
    }
    
    function unhighlight() {
        dropZone.classList.remove('highlight');
    }
    
    dropZone.addEventListener('drop', handleDrop, false);
    
    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        handleFiles(files);
    }
    
    // Handle file input change
    fileInput.addEventListener('change', function() {
        handleFiles(this.files);
    });
    
    function handleFiles(files) {
        if (files.length > 0) {
            const file = files[0];
            
            // Check if it's an audio file
            if (file.type.startsWith('audio/')) {
                uploadedFile = file;
                fileName.textContent = file.name;
                
                // Analyze the file to check its duration and compatibility
                analyzeAudioFile(file);
                
                conversionOptions.style.display = 'block';
                resultSection.style.display = 'none';
            } else {
                showError('Please upload an audio file.');
            }
        }
    }
    
    function analyzeAudioFile(file) {
        // Create an audio element to check duration and basic compatibility
        const audio = new Audio();
        const objectUrl = URL.createObjectURL(file);
        
        audio.addEventListener('loadedmetadata', function() {
            audioDuration = audio.duration;
            URL.revokeObjectURL(objectUrl);
            
            // Add file info with duration
            const minutes = Math.floor(audioDuration / 60);
            const seconds = Math.floor(audioDuration % 60);
            const fileInfo = document.createElement('div');
            fileInfo.className = 'file-info';
            fileInfo.innerHTML = `Duration: ${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
            fileName.appendChild(fileInfo);
        });
        
        audio.addEventListener('error', function() {
            URL.revokeObjectURL(objectUrl);
            const fileInfo = document.createElement('div');
            fileInfo.className = 'file-warning';
            fileInfo.textContent = 'This audio format may have limited compatibility with your browser.';
            fileName.appendChild(fileInfo);
        });
        
        audio.src = objectUrl;
    }
    
    function showError(message) {
        const errorBox = document.createElement('div');
        errorBox.className = 'error-message';
        errorBox.textContent = message;
        
        // Remove any existing error messages
        const existingError = document.querySelector('.error-message');
        if (existingError) {
            existingError.remove();
        }
        
        // Add error before conversion options
        conversionOptions.parentNode.insertBefore(errorBox, conversionOptions);
        
        // Auto-remove after 10 seconds
        setTimeout(() => {
            errorBox.remove();
        }, 10000);
    }
    
    // Handle conversion
    convertBtn.addEventListener('click', convertAudio);
    
    function convertAudio() {
        if (!uploadedFile) {
            showError('Please upload an audio file first.');
            return;
        }
        
        const targetFormat = formatSelect.value;
        
        if (!targetFormat || !isFormatSupported(targetFormat)) {
            showError('The selected format is not supported by your browser.');
            return;
        }
        
        // Show loading indicator
        loading.style.display = 'flex';
        conversionOptions.style.display = 'none';
        
        // Read the file
        const reader = new FileReader();
        reader.onload = function(e) {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // Use Promise-based approach with proper error handling
            audioContext.decodeAudioData(e.target.result)
                .then(processAudioBuffer)
                .catch(handleDecodingError);
                
            function processAudioBuffer(buffer) {
                try {
                    // Create a source node
                    const source = audioContext.createBufferSource();
                    source.buffer = buffer;
                    
                    // Create a destination for the media stream
                    const destination = audioContext.createMediaStreamDestination();
                    source.connect(destination);
                    
                    // Make sure we use a supported MIME type
                    const mediaRecorder = new MediaRecorder(destination.stream, {mimeType: targetFormat});
                    const chunks = [];
                    
                    mediaRecorder.ondataavailable = e => {
                        if (e.data.size > 0) {
                            chunks.push(e.data);
                        }
                    };
                    
                    mediaRecorder.onstop = () => {
                        const blob = new Blob(chunks, {type: targetFormat});
                        
                        // Create URL for the blob
                        const url = URL.createObjectURL(blob);
                        
                        // Set download link
                        downloadLink.href = url;
                        
                        // Get file extension from selected option's data attribute
                        const selectedOption = formatSelect.options[formatSelect.selectedIndex];
                        const extension = selectedOption.dataset.extension || 'audio';
                        
                        // Get original filename without extension
                        const originalName = uploadedFile.name.split('.').slice(0, -1).join('.');
                        downloadLink.download = `${originalName}.${extension}`;
                        
                        // Show result section
                        loading.style.display = 'none';
                        resultSection.style.display = 'block';
                    };
                    
                    // Start recording
                    mediaRecorder.start();
                    
                    // Start the source
                    source.start(0);
                    
                    // Get duration from buffer (more reliable)
                    const duration = buffer.duration;
                    
                    // Record for the duration of the audio
                    setTimeout(() => {
                        try {
                            mediaRecorder.stop();
                            source.stop();
                        } catch (err) {
                            handleDecodingError(err);
                        }
                    }, (duration * 1000) + 100); // Add a small buffer for safety
                } catch (err) {
                    handleDecodingError(err);
                }
            }
            
            function handleDecodingError(error) {
                console.error('Error processing audio:', error);
                
                let errorMessage = 'Error processing audio.';
                
                // Try to extract more detailed error information
                if (error.name) {
                    errorMessage += ` (${error.name})`;
                }
                
                if (error.message) {
                    errorMessage += `: ${error.message}`;
                } else {
                    errorMessage += ' Your browser may not support this audio format.';
                }
                
                loading.style.display = 'none';
                conversionOptions.style.display = 'block';
                showError(errorMessage);
            }
        };
        
        reader.onerror = function() {
            loading.style.display = 'none';
            conversionOptions.style.display = 'block';
            showError('Error reading the file. The file may be corrupted.');
        };
        
        reader.readAsArrayBuffer(uploadedFile);
    }
    
    // Add click event for the entire drop zone
    dropZone.addEventListener('click', function(e) {
        if (e.target !== fileInput) {
            fileInput.click();
        }
    });
});