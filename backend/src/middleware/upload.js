import multer from 'multer';
import path from 'path';
import FileType from 'file-type';

const ALLOWED_EXTENSIONS = /jpg|jpeg|png|webp|gif|mp4|mov|avi|webm|mp3|wav|ogg|m4a|aac/;
const ALLOWED_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/quicktime',
  'video/x-msvideo',
  'video/webm',
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/ogg',
  'audio/m4a',
  'audio/x-m4a',
  'audio/aac',
  'audio/webm',
  'audio/mp4',
]);

function checkFileType(file, cb) {
  const extname = ALLOWED_EXTENSIONS.test(path.extname(file.originalname).toLowerCase());
  const mimetype = ALLOWED_EXTENSIONS.test(file.mimetype);

  if (extname && mimetype) {
    return cb(null, true);
  } else {
    cb(new Error('Images, videos, and audio files only are allowed!'));
  }
}

export const MAX_UPLOAD_SIZE_BYTES = 100 * 1024 * 1024; // 100MB max limit

const upload = multer({
  storage: multer.memoryStorage(), // buffer files in memory, then push to S3
  limits: { fileSize: MAX_UPLOAD_SIZE_BYTES },
  fileFilter(req, file, cb) {
    checkFileType(file, cb);
  },
});

// The extension/mimetype check above only looks at attacker-controlled
// metadata (filename, Content-Type header) — a file's actual bytes can be
// anything, e.g. an HTML/JS payload saved as "photo.png". This inspects the
// real file signature (magic bytes) after multer buffers it, and rejects
// anything whose content doesn't match an allowed image/video format.
// Works after both upload.single() (req.file) and upload.fields() (req.files).
export async function verifyFileContents(req, res, next) {
  try {
    const files = req.file ? [req.file] : Object.values(req.files || {}).flat();

    for (const file of files) {
      const detected = await FileType.fromBuffer(file.buffer);
      if (!detected || !ALLOWED_MIMES.has(detected.mime)) {
        return res.status(400).json({ message: 'File content does not match a supported image, video, or audio format' });
      }
      file.detectedMime = detected.mime;
    }

    next();
  } catch (error) {
    console.error('verifyFileContents Error:', error);
    res.status(500).json({ message: 'Server error validating uploaded file' });
  }
}

export default upload;
