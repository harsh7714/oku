import multer from 'multer';
import path from 'path';

function checkFileType(file, cb) {
  const filetypes = /jpg|jpeg|png|webp|mp4|mov|avi/;
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = filetypes.test(file.mimetype);

  if (extname && mimetype) {
    return cb(null, true);
  } else {
    cb(new Error('Images and videos only are allowed!'));
  }
}

const upload = multer({
  storage: multer.memoryStorage(), // buffer files in memory, then push to S3
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB max limit
  fileFilter(req, file, cb) {
    checkFileType(file, cb);
  },
});

export default upload;
