import express from 'express';
import { body } from 'express-validator';
import {
  sendMessage,
  getMessages,
  getConversations,
  deleteMessage,
  deleteConversation,
  reactToMessage,
} from '../controllers/messageController.js';
import { protect } from '../middleware/auth.js';
import upload, { verifyFileContents } from '../middleware/upload.js';
import { validate } from '../middleware/validate.js';

const router = express.Router();

router.use(protect); // Secure all message routes

router.get('/conversations/list', getConversations);
router.post(
  '/',
  upload.single('media'),
  verifyFileContents,
  validate([
    body('receiverId').notEmpty().withMessage('Receiver is required'),
    body('content')
      .optional({ checkFalsy: true })
      .isLength({ max: 2000 })
      .withMessage('Message cannot exceed 2000 characters'),
  ]),
  sendMessage
);
router.delete('/conversation/:userId', deleteConversation);
router.delete('/:id', deleteMessage);
router.put('/:id/react', reactToMessage);
router.get('/:userId', getMessages);

export default router;
