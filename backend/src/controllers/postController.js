import Post from '../models/Post.js';
import User from '../models/User.js';
import { uploadFileToS3, deleteFileFromS3 } from '../utils/s3Upload.js';
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
      const { url } = await uploadFileToS3(req.file, 'posts');
      media = url;
      const extension = req.file.originalname.split('.').pop().toLowerCase();
      if (['mp4', 'mov', 'avi'].includes(extension)) {
        mediaType = 'video';
      } else {
        mediaType = 'image';
      }
    }

    if (!content && !media) {
      return res.status(400).json({ message: 'Post must have content or media' });
    }

    const hashtags = content
      ? [...new Set((content.match(/#(\w+)/g) || []).map((tag) => tag.slice(1).toLowerCase()))]
      : [];

    const post = await Post.create({
      userId: req.user._id,
      content,
      media,
      mediaType,
      hashtags,
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

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));

    // Get posts of user + posts of users they follow
    const posts = await Post.find({
      userId: { $in: [req.user._id, ...followingIds] },
    })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit + 1)
      .populate('userId', 'username profilePicture bio');

    const hasMore = posts.length > limit;
    res.json({ posts: posts.slice(0, limit), hasMore, page });
  } catch (error) {
    console.error('getFeedPosts Error:', error);
    res.status(500).json({ message: 'Server error retrieving feed' });
  }
};

// @desc    Get explore posts (public timeline), optionally sorted by
//          trending engagement and/or filtered by hashtag
// @route   GET /api/posts/explore
// @access  Private
export const getExplorePosts = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const sort = req.query.sort === 'trending' ? 'trending' : 'latest';
    const tag = req.query.tag ? req.query.tag.toLowerCase().trim() : null;

    const pipeline = [];

    if (tag) {
      pipeline.push({ $match: { hashtags: tag } });
    }

    if (sort === 'trending') {
      pipeline.push({
        $addFields: {
          trendingScore: { $add: [{ $multiply: [{ $size: '$likes' }, 2] }, '$commentsCount'] },
        },
      });
      pipeline.push({ $sort: { trendingScore: -1, createdAt: -1 } });
    } else {
      pipeline.push({ $sort: { createdAt: -1 } });
    }

    pipeline.push({ $skip: (page - 1) * limit }, { $limit: limit + 1 });

    // $lookup replaces .populate() in an aggregation pipeline
    pipeline.push(
      { $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'userId' } },
      { $unwind: '$userId' },
      {
        $project: {
          content: 1,
          media: 1,
          mediaType: 1,
          likes: 1,
          commentsCount: 1,
          hashtags: 1,
          createdAt: 1,
          updatedAt: 1,
          'userId._id': 1,
          'userId.username': 1,
          'userId.profilePicture': 1,
          'userId.bio': 1,
        },
      }
    );

    const posts = await Post.aggregate(pipeline);
    const hasMore = posts.length > limit;
    res.json({ posts: posts.slice(0, limit), hasMore, page });
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

    // Delete media file from S3 if it exists
    if (post.media) {
      await deleteFileFromS3(post.media);
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
