import express from 'express';
import {
  getNotifications,
  markNotificationsAsRead,
} from '../controllers/notificationController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.use(protect); // Secure all notification routes

router.get('/', getNotifications);
router.put('/read', markNotificationsAsRead);

export default router;
