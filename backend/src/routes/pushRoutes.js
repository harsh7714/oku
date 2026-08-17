import express from 'express';
import { getVapidPublicKey, subscribe, unsubscribe } from '../controllers/pushController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

router.get('/vapid-public-key', getVapidPublicKey);
router.post('/subscribe', subscribe);
router.post('/unsubscribe', unsubscribe);

export default router;
