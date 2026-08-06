import Comment from '../models/Comment.js';
import Post from '../models/Post.js';
import { createNotification } from '../utils/createNotification.js';

// @desc    Add a comment to a post
// @route   POST /api/posts/:postId/comments
// @access  Private
export const addComment = async (req, res) => {
  try {
    const { content } = req.body;
    const { postId } = req.params;

    if (!content) {
      return res.status(400).json({ message: 'Comment content is required' });
    }

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const comment = await Comment.create({
      postId,
      userId: req.user._id,
      content,
    });

    // Update post comments count
    await Post.findByIdAndUpdate(postId, { $inc: { commentsCount: 1 } });

    // Notify post author
    await createNotification(post.userId, req.user._id, 'comment', post._id);

    const populatedComment = await Comment.findById(comment._id).populate('userId', 'username profilePicture');

    res.status(201).json(populatedComment);
  } catch (error) {
    console.error('addComment Error:', error);
    res.status(500).json({ message: 'Server error adding comment' });
  }
};

// @desc    Get all comments for a post
// @route   GET /api/posts/:postId/comments
// @access  Private
export const getPostComments = async (req, res) => {
  try {
    const { postId } = req.params;

    const comments = await Comment.find({ postId })
      .sort({ createdAt: -1 })
      .populate('userId', 'username profilePicture');

    res.json(comments);
  } catch (error) {
    console.error('getPostComments Error:', error);
    res.status(500).json({ message: 'Server error retrieving comments' });
  }
};

// @desc    Delete a comment
// @route   DELETE /api/posts/:postId/comments/:id
// @access  Private
export const deleteComment = async (req, res) => {
  try {
    const { postId, id } = req.params;

    const comment = await Comment.findById(id);
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    // Verify ownership of comment or parent post, or admin status
    const post = await Post.findById(postId);
    if (
      comment.userId.toString() !== req.user._id.toString() &&
      post?.userId.toString() !== req.user._id.toString() &&
      !req.user.isAdmin
    ) {
      return res.status(401).json({ message: 'Action not authorized' });
    }

    await comment.deleteOne();

    // Decrement post comments count
    await Post.findByIdAndUpdate(postId, { $inc: { commentsCount: -1 } });

    res.json({ message: 'Comment deleted successfully' });
  } catch (error) {
    console.error('deleteComment Error:', error);
    res.status(500).json({ message: 'Server error deleting comment' });
  }
};
