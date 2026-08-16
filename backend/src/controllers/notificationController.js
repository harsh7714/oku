import Notification from '../models/Notification.js';

// @desc    Get user notifications
// @route   GET /api/notifications
// @access  Private
export const getNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ recipientId: req.user._id })
      .sort({ createdAt: -1 })
      .populate('senderId', 'username profilePicture')
      .populate('postId', 'content media mediaType');

    // A notification whose sender account was since deleted populates
    // senderId as null — drop those rather than showing an unattributable
    // notification (and crashing the page that assumes it's always there).
    const validNotifications = notifications.filter((n) => n.senderId);
    res.json(validNotifications);
  } catch (error) {
    console.error('getNotifications Error:', error);
    res.status(500).json({ message: 'Server error retrieving notifications' });
  }
};

// @desc    Mark notifications as read
// @route   PUT /api/notifications/read
// @access  Private
export const markNotificationsAsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { recipientId: req.user._id, isRead: false },
      { $set: { isRead: true } }
    );
    res.json({ message: 'Notifications marked as read' });
  } catch (error) {
    console.error('markNotificationsAsRead Error:', error);
    res.status(500).json({ message: 'Server error updating notifications' });
  }
};
