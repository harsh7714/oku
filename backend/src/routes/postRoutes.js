import express from 'express';
import {
  createPost,
  getFeedPosts,
  getExplorePosts,
  getUserPosts,
  deletePost,
  likePost,
} from '../controllers/postController.js';
import {
  addComment,
  getPostComments,
  deleteComment,
} from '../controllers/commentController.js';
import { protect } from '../middleware/auth.js';
import upload from '../middleware/upload.js';

const router = express.Router();

router.use(protect); // Secure all post routes

// Timeline & explore routes
router.get('/feed', getFeedPosts);
router.get('/explore', getExplorePosts);
router.get('/user/:username', getUserPosts);

// Base CRUDS
router.post('/', upload.single('media'), createPost);
router.delete('/:id', deletePost);
router.put('/:id/like', likePost);

// Comments subroutes
router.post('/:postId/comments', addComment);
router.get('/:postId/comments', getPostComments);
router.delete('/:postId/comments/:id', deleteComment);

export default router;
