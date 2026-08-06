import Notification from '../models/Notification.js';

export const createNotification = async (recipientId, senderId, type, postId = null) => {
  try {
    // Do not notify if performing action on self
    if (recipientId.toString() === senderId.toString()) return;

    // Check if notification already exists for similar actions (e.g. liking multiple times, follow/unfollow)
    if (type === 'follow' || type === 'like') {
      const existing = await Notification.findOne({
        recipientId,
        senderId,
        type,
        postId,
      });
      if (existing) return; // Avoid duplicate follow or like notifications
    }

    const notification = await Notification.create({
      recipientId,
      senderId,
      type,
      postId,
    });

    const populatedNotification = await Notification.findById(notification._id)
      .populate('senderId', 'username profilePicture')
      .populate('postId', 'content media mediaType');

    // Emit live event via Socket.io
    if (global.io) {
      const recipientSocketId = global.onlineUsers?.get(recipientId.toString());
      if (recipientSocketId) {
        global.io.to(recipientSocketId).emit('receiveNotification', populatedNotification);
      }
    }
  } catch (error) {
    console.error('Error creating notification:', error);
  }
};
