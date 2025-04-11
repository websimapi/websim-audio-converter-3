import { createFFmpeg, fetchFile } from '@ffmpeg/ffmpeg';

document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileInput');
  const fileInfo = document.getElementById('fileInfo');
  const fileName = document.getElementById('fileName');
  const fileSize = document.getElementById('fileSize');
  const fileType = document.getElementById('fileType');
  const conversionOptions = document.getElementById('conversionOptions');
  const progressContainer = document.getElementById('progressContainer');
  const progressBar = document.getElementById('progressBar');
  const progressText = document.getElementById('progressText');
  const resultContainer = document.getElementById('resultContainer');
  const downloadBtn = document.getElementById('downloadBtn');
  const convertBtn = document.getElementById('convertBtn');
  const formatSelect = document.getElementById('formatSelect');
  const errorContainer = document.getElementById('error');
  const errorMessage = document.getElementById('errorMessage');

  // FFmpeg instance
  const ffmpeg = createFFmpeg({
    log: true,
    progress: ({ ratio }) => {
      const percent = Math.round(ratio * 100);
      progressBar.style.width = `${percent}%`;
      progressText.textContent = `${percent}%`;
    },
  });

  // Global variables
  let selectedFile = null;
  let convertedFileName = null;

  // Initialize FFmpeg
  const load = async () => {
    try {
      await ffmpeg.load();
      console.log('FFmpeg loaded');
    } catch (error) {
      showError(`Failed to load FFmpeg: ${error.message}`);
    }
  };
  load();

  // Drag and drop handlers
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    
    if (e.dataTransfer.files.length) {
      handleFileSelection(e.dataTransfer.files[0]);
    }
  });

  dropZone.addEventListener('click', () => {
    fileInput.click();
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length) {
      handleFileSelection(e.target.files[0]);
    }
  });

  // File selection handler
  function handleFileSelection(file) {
    if (!file.type.startsWith('audio/')) {
      showError('Please select an audio file.');
      return;
    }

    selectedFile = file;
    
    // Display file info
    fileName.textContent = file.name;
    fileSize.textContent = `Size: ${formatFileSize(file.size)}`;
    fileType.textContent = `Type: ${file.type || 'Unknown'}`;
    
    fileInfo.style.display = 'block';
    conversionOptions.style.display = 'block';
    resultContainer.style.display = 'none';
    errorContainer.style.display = 'none';
  }

  // Convert button click handler
  convertBtn.addEventListener('click', async () => {
    if (!selectedFile) {
      showError('Please select a file first.');
      return;
    }

    if (!ffmpeg.isLoaded()) {
      showError('FFmpeg is not loaded yet. Please wait and try again.');
      return;
    }

    const targetFormat = formatSelect.value;
    const originalFileName = selectedFile.name;
    const fileBaseName = originalFileName.substring(0, originalFileName.lastIndexOf('.')) || originalFileName;
    convertedFileName = `${fileBaseName}.${targetFormat}`;

    try {
      // Show progress
      progressContainer.style.display = 'block';
      progressBar.style.width = '0%';
      progressText.textContent = '0%';
      conversionOptions.style.display = 'none';
      resultContainer.style.display = 'none';

      // Read file
      const fileData = await fetchFile(selectedFile);
      
      // Write file to FFmpeg memory
      ffmpeg.FS('writeFile', originalFileName, fileData);
      
      // Run FFmpeg command
      await ffmpeg.run('-i', originalFileName, convertedFileName);
      
      // Complete
      progressBar.style.width = '100%';
      progressText.textContent = '100%';
      
      setTimeout(() => {
        progressContainer.style.display = 'none';
        resultContainer.style.display = 'block';
      }, 500);
    } catch (error) {
      showError(`Conversion failed: ${error.message}`);
      progressContainer.style.display = 'none';
    }
  });

  // Download button click handler
  downloadBtn.addEventListener('click', async () => {
    try {
      // Read the converted file from FFmpeg memory
      const data = ffmpeg.FS('readFile', convertedFileName);
      
      // Get MIME type for the target format
      const mimeType = getMimeType(convertedFileName);
      
      // Create blob and download
      const blob = new Blob([data.buffer], { type: mimeType });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = convertedFileName;
      document.body.appendChild(a);
      a.click();
      
      // Clean up
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
    } catch (error) {
      showError(`Download failed: ${error.message}`);
    }
  });

  // Utility functions
  function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  function getMimeType(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    
    const mimeTypes = {
      'mp3': 'audio/mpeg',
      'wav': 'audio/wav',
      'ogg': 'audio/ogg',
      'm4a': 'audio/mp4',
      'flac': 'audio/flac'
    };
    
    return mimeTypes[ext] || 'application/octet-stream';
  }

  function showError(message) {
    errorMessage.textContent = message;
    errorContainer.style.display = 'block';
    progressContainer.style.display = 'none';
  }
});

