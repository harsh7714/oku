import express from 'express';
import { body } from 'express-validator';
import { registerUser, loginUser, getMe } from '../controllers/authController.js';
import { protect } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { authLimiter } from '../middleware/rateLimiters.js';
import { checkExplicitUsername, checkExplicitEmail } from '../utils/explicitFilter.js';

const router = express.Router();

// authLimiter only guards register/login (brute-force-sensitive); it must
// NOT cover /me, which fires on every page load to check the session.
router.post(
  '/register',
  authLimiter,
  validate([
    body('username')
      .trim()
      .isLength({ min: 3 })
      .withMessage('Username must be at least 3 characters long')
      .custom((value) => {
        const check = checkExplicitUsername(value);
        if (!check.isValid) {
          throw new Error(check.reason);
        }
        return true;
      }),
    body('email')
      .trim()
      .isEmail()
      .withMessage('Please provide a valid email address')
      .custom((value) => {
        const check = checkExplicitEmail(value);
        if (!check.isValid) {
          throw new Error(check.reason);
        }
        return true;
      }),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
  ]),
  registerUser
);
router.post(
  '/login',
  authLimiter,
  validate([
    body('emailOrUsername').trim().notEmpty().withMessage('Please provide your email or username'),
    body('password').notEmpty().withMessage('Please provide your password'),
  ]),
  loginUser
);
router.get('/me', protect, getMe);

export default router;
