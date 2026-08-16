import express from 'express';
import { body } from 'express-validator';
import {
  createPost,
  getFeedPosts,
  getExplorePosts,
  getUserPosts,
  getReels,
  deletePost,
  likePost,
} from '../controllers/postController.js';
import {
  addComment,
  getPostComments,
  deleteComment,
} from '../controllers/commentController.js';
import { protect } from '../middleware/auth.js';
import upload, { verifyFileContents } from '../middleware/upload.js';
import { validate } from '../middleware/validate.js';

const router = express.Router();

router.use(protect); // Secure all post routes

// Timeline & explore routes
router.get('/feed', getFeedPosts);
router.get('/explore', getExplorePosts);
router.get('/reels', getReels);
router.get('/user/:username', getUserPosts);

// Base CRUDS
router.post(
  '/',
  upload.single('media'),
  verifyFileContents,
  validate([
    body('content')
      .optional({ checkFalsy: true })
      .isLength({ max: 2000 })
      .withMessage('Post content cannot exceed 2000 characters'),
  ]),
  createPost
);
router.delete('/:id', deletePost);
router.put('/:id/like', likePost);

// Comments subroutes
router.post(
  '/:postId/comments',
  validate([
    body('content')
      .trim()
      .notEmpty()
      .withMessage('Comment content is required')
      .isLength({ max: 500 })
      .withMessage('Comment content cannot exceed 500 characters'),
  ]),
  addComment
);
router.get('/:postId/comments', getPostComments);
router.delete('/:postId/comments/:id', deleteComment);

export default router;
