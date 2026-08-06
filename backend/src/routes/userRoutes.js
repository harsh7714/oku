import express from 'express';
import {
  getUserProfile,
  getUserById,
  updateUserProfile,
  followUser,
  unfollowUser,
  searchUsers,
  getSuggestedUsers,
} from '../controllers/userController.js';
import { protect } from '../middleware/auth.js';
import upload from '../middleware/upload.js';

const router = express.Router();

router.use(protect); // Secure all user routes

router.get('/search', searchUsers);
router.get('/suggestions', getSuggestedUsers);
router.get('/profile/:username', getUserProfile);
router.get('/:id', getUserById);

router.put(
  '/profile',
  upload.fields([
    { name: 'profilePicture', maxCount: 1 },
    { name: 'coverPicture', maxCount: 1 },
  ]),
  updateUserProfile
);

router.put('/:id/follow', followUser);
router.put('/:id/unfollow', unfollowUser);

export default router;
