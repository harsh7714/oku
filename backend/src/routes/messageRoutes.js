import express from 'express';
import {
  sendMessage,
  getMessages,
  getConversations,
} from '../controllers/messageController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.use(protect); // Secure all message routes

router.get('/conversations/list', getConversations);
router.post('/', sendMessage);
router.get('/:userId', getMessages);

export default router;
