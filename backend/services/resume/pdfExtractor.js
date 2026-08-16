const pdfParse = require('pdf-parse'); // v1.1.1 — plain function, no self-test bug

const logger = require('../../utils/logger');

const MIN_TEXT_LENGTH = 100; // Below this = likely a scanned/image PDF

/**
 * Extract raw text from a PDF buffer.
 * @param {Buffer} buffer - The PDF file buffer from multer
 * @returns {Promise<string>} - Extracted plain text
 * @throws {Error} - If PDF is unreadable or text is too short (scanned PDF)
 */
const extractTextFromPDF = async (buffer) => {
  try {
    const data = await pdfParse(buffer);
    const text = data.text?.trim() || '';

    logger.info(`[PDFExtractor] Extracted ${text.length} characters from PDF`);

    if (text.length < MIN_TEXT_LENGTH) {
      const err = new Error(
        'Could not extract readable text from this PDF. ' +
        'Please ensure it is a text-based PDF (not a scanned image). ' +
        `Only ${text.length} characters were extracted.`
      );
      err.statusCode = 422;
      throw err;
    }

    return text;
  } catch (error) {
    // Re-throw our own errors
    if (error.statusCode) throw error;

    // pdf-parse parsing errors
    logger.error('[PDFExtractor] Failed to parse PDF:', error.message);
    const err = new Error('Failed to read PDF file. The file may be corrupted or password-protected.');
    err.statusCode = 422;
    throw err;
  }
};

module.exports = { extractTextFromPDF };
