import express from 'express';
import { body } from 'express-validator';
import {
  sendMessage,
  getMessages,
  getConversations,
} from '../controllers/messageController.js';
import { protect } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = express.Router();

router.use(protect); // Secure all message routes

router.get('/conversations/list', getConversations);
router.post(
  '/',
  validate([
    body('receiverId').notEmpty().withMessage('Receiver is required'),
    body('content').trim().notEmpty().withMessage('Message content is required'),
  ]),
  sendMessage
);
router.get('/:userId', getMessages);

export default router;
