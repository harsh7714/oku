import Post from '../models/Post.js';
import User from '../models/User.js';
import fs from 'fs';
import { createNotification } from '../utils/createNotification.js';

// @desc    Create a new post
// @route   POST /api/posts
// @access  Private
export const createPost = async (req, res) => {
  try {
    const { content } = req.body;
    let media = '';
    let mediaType = 'none';

    if (req.file) {
      media = `/uploads/${req.file.filename}`;
      const extension = req.file.filename.split('.').pop().toLowerCase();
      if (['mp4', 'mov', 'avi'].includes(extension)) {
        mediaType = 'video';
      } else {
        mediaType = 'image';
      }
    }

    if (!content && !media) {
      return res.status(400).json({ message: 'Post must have content or media' });
    }

    const post = await Post.create({
      userId: req.user._id,
      content,
      media,
      mediaType,
    });

    const populatedPost = await Post.findById(post._id).populate('userId', 'username profilePicture bio');

    res.status(201).json(populatedPost);
  } catch (error) {
    console.error('createPost Error:', error);
    res.status(500).json({ message: 'Server error creating post' });
  }
};

// @desc    Get user's personalized home feed (self + followed users)
// @route   GET /api/posts/feed
// @access  Private
export const getFeedPosts = async (req, res) => {
  try {
    const currentUser = await User.findById(req.user._id);
    const followingIds = currentUser.following;

    // Get posts of user + posts of users they follow
    const posts = await Post.find({
      userId: { $in: [req.user._id, ...followingIds] },
    })
      .sort({ createdAt: -1 })
      .populate('userId', 'username profilePicture bio');

    res.json(posts);
  } catch (error) {
    console.error('getFeedPosts Error:', error);
    res.status(500).json({ message: 'Server error retrieving feed' });
  }
};

// @desc    Get explore posts (public timeline)
// @route   GET /api/posts/explore
// @access  Private
export const getExplorePosts = async (req, res) => {
  try {
    // Get general timeline posts
    const posts = await Post.find()
      .sort({ createdAt: -1 })
      .populate('userId', 'username profilePicture bio')
      .limit(50);

    res.json(posts);
  } catch (error) {
    console.error('getExplorePosts Error:', error);
    res.status(500).json({ message: 'Server error retrieving explore posts' });
  }
};

// @desc    Get posts by username
// @route   GET /api/posts/user/:username
// @access  Private
export const getUserPosts = async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username.toLowerCase() });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const posts = await Post.find({ userId: user._id })
      .sort({ createdAt: -1 })
      .populate('userId', 'username profilePicture bio');

    res.json(posts);
  } catch (error) {
    console.error('getUserPosts Error:', error);
    res.status(500).json({ message: 'Server error retrieving user posts' });
  }
};

// @desc    Delete a post
// @route   DELETE /api/posts/:id
// @access  Private
export const deletePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    // Check if post owner is current user (or user is admin)
    if (post.userId.toString() !== req.user._id.toString() && !req.user.isAdmin) {
      return res.status(401).json({ message: 'Action not authorized' });
    }

    // Delete media file locally if it exists
    if (post.media) {
      const filePath = `./public${post.media}`;
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    await post.deleteOne();
    res.json({ message: 'Post deleted successfully' });
  } catch (error) {
    console.error('deletePost Error:', error);
    res.status(500).json({ message: 'Server error deleting post' });
  }
};

// @desc    Like or unlike a post
// @route   PUT /api/posts/:id/like
// @access  Private
export const likePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const hasLiked = post.likes.includes(req.user._id);

    if (hasLiked) {
      // Unlike post
      await post.updateOne({ $pull: { likes: req.user._id } });
      res.json({ liked: false, likesCount: post.likes.length - 1 });
    } else {
      // Like post
      await post.updateOne({ $push: { likes: req.user._id } });
      
      // Notify post author
      await createNotification(post.userId, req.user._id, 'like', post._id);

      res.json({ liked: true, likesCount: post.likes.length + 1 });
    }
  } catch (error) {
    console.error('likePost Error:', error);
    res.status(500).json({ message: 'Server error updating post likes' });
  }
};
