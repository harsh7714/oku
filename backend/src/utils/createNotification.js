import Notification from '../models/Notification.js';
import { sendPushToUser } from './webpush.js';

const PUSH_BODY_BY_TYPE = {
  like: (sender) => `${sender.username} liked your post`,
  comment: (sender) => `${sender.username} commented on your post`,
  follow: (sender) => `${sender.username} started following you`,
};

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

    // Best-effort browser/OS push, so the recipient is notified even when
    // they have no live socket connection (app closed/backgrounded). Not
    // awaited — push-service round trips can take a second or more, and
    // the like/comment/follow response shouldn't wait on that.
    const buildBody = PUSH_BODY_BY_TYPE[type];
    if (buildBody) {
      const sender = populatedNotification.senderId;
      sendPushToUser(recipientId, {
        title: 'Oku',
        body: buildBody(sender),
        icon: '/favicon.svg',
        url: `/profile/${sender.username}`,
      }).catch((err) => console.error('Push send error:', err.message));
    }
  } catch (error) {
    console.error('Error creating notification:', error);
  }
};
