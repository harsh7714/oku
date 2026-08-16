import User from '../models/User.js';
import { uploadFileToS3, deleteFileFromS3 } from '../utils/s3Upload.js';
import { createNotification } from '../utils/createNotification.js';

// @desc    Get user profile by username
// @route   GET /api/users/profile/:username
// @access  Private
export const getUserProfile = async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username.toLowerCase() })
      .populate('followers', 'username profilePicture bio')
      .populate('following', 'username profilePicture bio');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('getUserProfile Error:', error);
    res.status(500).json({ message: 'Server error retrieving profile' });
  }
};

// @desc    Get user profile by ID
// @route   GET /api/users/:id
// @access  Private
export const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password')
      .populate('followers', 'username profilePicture bio')
      .populate('following', 'username profilePicture bio');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    console.error('getUserById Error:', error);
    res.status(500).json({ message: 'Server error retrieving user' });
  }
};

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
export const updateUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if updating username and if it's already taken
    if (req.body.username && req.body.username.toLowerCase() !== user.username) {
      const usernameExists = await User.findOne({ username: req.body.username.toLowerCase() });
      if (usernameExists) {
        return res.status(400).json({ message: 'Username is already taken' });
      }
      user.username = req.body.username.toLowerCase();
    }

    user.bio = req.body.bio !== undefined ? req.body.bio : user.bio;

    // Check if file uploads exist (handled by multer in routes)
    if (req.files) {
      if (req.files.profilePicture) {
        const oldProfilePicture = user.profilePicture;
        const { url } = await uploadFileToS3(req.files.profilePicture[0], 'avatars');
        user.profilePicture = url;
        await deleteFileFromS3(oldProfilePicture);
      }
      if (req.files.coverPicture) {
        const oldCoverPicture = user.coverPicture;
        const { url } = await uploadFileToS3(req.files.coverPicture[0], 'covers');
        user.coverPicture = url;
        await deleteFileFromS3(oldCoverPicture);
      }
    }

    const updatedUser = await user.save();
    
    res.json({
      _id: updatedUser._id,
      username: updatedUser.username,
      email: updatedUser.email,
      profilePicture: updatedUser.profilePicture,
      coverPicture: updatedUser.coverPicture,
      bio: updatedUser.bio,
      followers: updatedUser.followers,
      following: updatedUser.following,
      isAdmin: updatedUser.isAdmin,
    });
  } catch (error) {
    console.error('updateUserProfile Error:', error);
    res.status(500).json({ message: error.message || 'Server error updating profile' });
  }
};

// @desc    Follow a user
// @route   PUT /api/users/:id/follow
// @access  Private
export const followUser = async (req, res) => {
  try {
    if (req.params.id === req.user._id.toString()) {
      return res.status(400).json({ message: 'You cannot follow yourself' });
    }

    const userToFollow = await User.findById(req.params.id);
    const currentUser = await User.findById(req.user._id);

    if (!userToFollow || !currentUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if already following
    if (currentUser.following.includes(req.params.id)) {
      return res.status(400).json({ message: 'You are already following this user' });
    }

    // Add to following/followers list
    await currentUser.updateOne({ $push: { following: req.params.id } });
    await userToFollow.updateOne({ $push: { followers: req.user._id } });

    // Notify followed user
    await createNotification(userToFollow._id, req.user._id, 'follow');

    res.json({ message: 'User followed successfully' });
  } catch (error) {
    console.error('followUser Error:', error);
    res.status(500).json({ message: 'Server error trying to follow user' });
  }
};

// @desc    Unfollow a user
// @route   PUT /api/users/:id/unfollow
// @access  Private
export const unfollowUser = async (req, res) => {
  try {
    if (req.params.id === req.user._id.toString()) {
      return res.status(400).json({ message: 'You cannot unfollow yourself' });
    }

    const userToUnfollow = await User.findById(req.params.id);
    const currentUser = await User.findById(req.user._id);

    if (!userToUnfollow || !currentUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if following
    if (!currentUser.following.includes(req.params.id)) {
      return res.status(400).json({ message: 'You are not following this user' });
    }

    // Remove from lists
    await currentUser.updateOne({ $pull: { following: req.params.id } });
    await userToUnfollow.updateOne({ $pull: { followers: req.user._id } });

    res.json({ message: 'User unfollowed successfully' });
  } catch (error) {
    console.error('unfollowUser Error:', error);
    res.status(500).json({ message: 'Server error trying to unfollow user' });
  }
};

// @desc    Search users by username
// @route   GET /api/users/search
// @access  Private
export const searchUsers = async (req, res) => {
  try {
    const query = req.query.q;
    if (!query) {
      return res.status(400).json({ message: 'Search query is required' });
    }

    const users = await User.find({
      username: { $regex: query, $options: 'i' },
      _id: { $ne: req.user._id }, // Exclude self
    })
      .select('username profilePicture bio')
      .limit(10);

    res.json(users);
  } catch (error) {
    console.error('searchUsers Error:', error);
    res.status(500).json({ message: 'Server error performing search' });
  }
};

// @desc    Get suggested users to follow
// @route   GET /api/users/suggestions
// @access  Private
export const getSuggestedUsers = async (req, res) => {
  try {
    const currentUser = await User.findById(req.user._id);

    // Find users who are NOT followed by the current user and not the current user itself
    const excludedIds = [...currentUser.following, currentUser._id];

    const suggestions = await User.find({ _id: { $nin: excludedIds } })
      .select('username profilePicture bio')
      .limit(5);

    res.json(suggestions);
  } catch (error) {
    console.error('getSuggestedUsers Error:', error);
    res.status(500).json({ message: 'Server error getting suggestions' });
  }
};
