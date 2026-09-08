import { checkMediaExplicitWithGemini } from '../utils/geminiMediaFilter.js';

/**
 * Middleware to check uploaded image, video, and audio files for explicit content via Gemini API.
 * Runs after multer buffering and magic-byte verification.
 */
export async function checkMediaExplicit(req, res, next) {
  try {
    const files = req.file ? [req.file] : Object.values(req.files || {}).flat();

    for (const file of files) {
      if (!file || !file.buffer) continue;

      const result = await checkMediaExplicitWithGemini(
        file.buffer,
        file.mimetype,
        file.originalname
      );

      if (result.isExplicit) {
        return res.status(400).json({
          message: `Uploaded media contains explicit or inappropriate content: ${result.reason || 'Flagged by AI safety moderation'}`
        });
      }
    }

    next();
  } catch (error) {
    console.error('checkMediaExplicit Middleware Error:', error);
    res.status(500).json({ message: 'Server error checking media explicit content' });
  }
}

export default checkMediaExplicit;
