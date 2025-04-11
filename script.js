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
    const errorSection = document.getElementById('errorSection');
    const errorMessage = document.getElementById('errorMessage');
    
    let uploadedFile = null;

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
            { value: 'audio/webm', label: 'WEBM', extension: 'webm' },
            { value: 'audio/aac', label: 'AAC', extension: 'aac' },
            { value: 'audio/mpeg', label: 'MPEG', extension: 'mp3' }
        ];
        
        let hasAtLeastOneFormat = false;
        
        // Add only supported formats
        formatsToCheck.forEach(format => {
            try {
                if (isFormatSupported(format.value)) {
                    const option = document.createElement('option');
                    option.value = format.value;
                    option.textContent = format.label;
                    option.dataset.extension = format.extension;
                    formatSelect.appendChild(option);
                    hasAtLeastOneFormat = true;
                }
            } catch (e) {
                console.warn(`Error checking format ${format.label}:`, e);
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
                conversionOptions.style.display = 'block';
                resultSection.style.display = 'none';
                errorSection.style.display = 'none';
            } else {
                showError('Please upload an audio file.');
            }
        }
    }
    
    function showError(message) {
        errorSection.style.display = 'block';
        errorMessage.textContent = message;
        loading.style.display = 'none';
    }
    
    function hideError() {
        errorSection.style.display = 'none';
    }
    
    // Handle conversion
    convertBtn.addEventListener('click', convertAudio);
    
    function convertAudio() {
        if (!uploadedFile) {
            showError('Please upload an audio file first.');
            return;
        }
        
        const targetFormat = formatSelect.value;
        
        if (!targetFormat) {
            showError('The selected format is not supported by your browser.');
            return;
        }
        
        // Double-check format support
        if (!isFormatSupported(targetFormat)) {
            showError(`Your browser doesn't support converting to ${targetFormat}. Please try another format.`);
            return;
        }
        
        // Hide previous errors
        hideError();
        
        // Show loading indicator
        loading.style.display = 'flex';
        conversionOptions.style.display = 'none';
        
        // Read the file
        const reader = new FileReader();
        reader.onload = function(e) {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // Decode the audio data
            audioContext.decodeAudioData(e.target.result)
                .then(buffer => {
                    // Create a new buffer source
                    const source = audioContext.createBufferSource();
                    source.buffer = buffer;
                    
                    // Create a MediaStream destination
                    const destination = audioContext.createMediaStreamDestination();
                    source.connect(destination);
                    
                    try {
                        // Create a MediaRecorder with supported options
                        const mediaRecorder = new MediaRecorder(destination.stream, {mimeType: targetFormat});
                        const chunks = [];
                        
                        mediaRecorder.ondataavailable = e => {
                            if (e.data.size > 0) {
                                chunks.push(e.data);
                            }
                        };
                        
                        mediaRecorder.onstop = () => {
                            try {
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
                            } catch (error) {
                                loading.style.display = 'none';
                                showError('Error creating output file: ' + error.message);
                                console.error('Error creating blob:', error);
                            }
                        };
                        
                        mediaRecorder.onerror = (event) => {
                            loading.style.display = 'none';
                            showError('MediaRecorder error: ' + event.error);
                            console.error('MediaRecorder error:', event);
                        };
                        
                        // Start recording
                        mediaRecorder.start(100); // Provide a timeslice to ensure data is available
                        
                        // Start the source and stop recording when done
                        source.start(0);
                        
                        // Record for the duration of the audio
                        setTimeout(() => {
                            try {
                                mediaRecorder.stop();
                                source.stop();
                            } catch (error) {
                                loading.style.display = 'none'; 
                                showError('Error stopping conversion: ' + error.message);
                                console.error('Error stopping conversion:', error);
                            }
                        }, buffer.duration * 1000);
                    } catch (error) {
                        loading.style.display = 'none';
                        conversionOptions.style.display = 'block';
                        showError('Error creating MediaRecorder: ' + error.message + '. Please try another format.');
                        console.error('MediaRecorder construction error:', error);
                    }
                })
                .catch(error => {
                    loading.style.display = 'none';
                    conversionOptions.style.display = 'block';
                    showError('Error processing audio: ' + error.message);
                    console.error('Error processing audio:', error);
                });
        };
        
        reader.onerror = function() {
            loading.style.display = 'none';
            conversionOptions.style.display = 'block';
            showError('Error reading the file.');
        };
        
        reader.readAsArrayBuffer(uploadedFile);
    }
    
    // Add click event for the entire drop zone
    dropZone.addEventListener('click', function(e) {
        if (e.target !== fileInput) {
            fileInput.click();
        }
    });
    
    // Error section close button
    document.getElementById('errorClose').addEventListener('click', function() {
        hideError();
        conversionOptions.style.display = 'block';
    });
});