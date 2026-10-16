import express from 'express';
import { getTurnIceServers } from '../controllers/turnController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.get('/ice-servers', protect, getTurnIceServers);

export default router;
