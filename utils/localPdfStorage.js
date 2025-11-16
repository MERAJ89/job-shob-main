/**
 * Local filesystem-based PDF storage (fallback when S3 is not configured)
 * Stores PDFs in server memory and provides download URLs via a simple endpoint
 */

const path = require('path');
const fs = require('fs');

// In-memory storage: maps fileKey -> { buffer, filename, contentType, uploadedAt }
const pdfStorage = new Map();

// Ensure temp directory exists for local file storage
const storageDir = path.resolve(__dirname, '..', '..', 'temp-pdfs');
if (!fs.existsSync(storageDir)) {
  try {
    fs.mkdirSync(storageDir, { recursive: true });
  } catch (err) {
    console.warn('Could not create temp-pdfs directory:', err.message);
  }
}

/**
 * Generate a presigned "upload" URL (local endpoint that accepts PUT requests)
 * In this case, it's just a marker — the actual upload happens via a dedicated endpoint
 */
function createLocalPresignedUploadUrl({ key }) {
  // Return a fake presigned URL that points to a local endpoint
  return `/api/pdfs/upload/${encodeURIComponent(key)}`;
}

/**
 * Handle direct file upload to local storage
 * Called when client PUTs file to the presigned URL
 */
async function handleLocalFileUpload(fileKey, buffer, contentType) {
  try {
    // Store in memory
    pdfStorage.set(fileKey, {
      buffer,
      contentType,
      uploadedAt: new Date(),
      size: buffer.length
    });

    // Also save to filesystem as backup
    const filepath = path.join(storageDir, fileKey.replace(/\//g, '_'));
    fs.writeFileSync(filepath, buffer);

    return { success: true, fileKey };
  } catch (err) {
    console.error('Failed to store PDF locally:', err);
    throw err;
  }
}

/**
 * Get a stored PDF file for download
 */
function getLocalStoredFile(fileKey) {
  const stored = pdfStorage.get(fileKey);
  if (!stored) {
    // Try to load from filesystem
    const filepath = path.join(storageDir, fileKey.replace(/\//g, '_'));
    if (fs.existsSync(filepath)) {
      try {
        const buffer = fs.readFileSync(filepath);
        return { buffer, contentType: 'application/pdf' };
      } catch (err) {
        console.error('Failed to read PDF from filesystem:', err);
        return null;
      }
    }
    return null;
  }
  return stored;
}

/**
 * Delete a stored PDF file
 */
function deleteLocalStoredFile(fileKey) {
  try {
    pdfStorage.delete(fileKey);
    const filepath = path.join(storageDir, fileKey.replace(/\//g, '_'));
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
    }
    return { success: true };
  } catch (err) {
    console.error('Failed to delete local PDF:', err);
    throw err;
  }
}

module.exports = {
  createLocalPresignedUploadUrl,
  handleLocalFileUpload,
  getLocalStoredFile,
  deleteLocalStoredFile,
  isUsingLocalStorage: true
};
