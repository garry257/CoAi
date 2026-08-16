const multer = require('multer');

// Store file in memory as Buffer (no disk writes)
// pdf-parse reads the buffer directly
const storage = multer.memoryStorage();

// Filter: only allow PDF files
const fileFilter = (req, file, cb) => {
  if (
    file.mimetype === 'application/pdf' ||
    file.originalname.toLowerCase().endsWith('.pdf')
  ) {
    cb(null, true);
  } else {
    cb(
      Object.assign(new Error('Only PDF files are allowed'), { statusCode: 400 }),
      false
    );
  }
};

// 5 MB limit
const MAX_SIZE_BYTES = 5 * 1024 * 1024;

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_SIZE_BYTES },
});

module.exports = upload;
