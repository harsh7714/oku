import Message from '../models/Message.js';
import Post from '../models/Post.js';
import User from '../models/User.js';
import { uploadFileToS3, deleteFileFromS3 } from '../utils/s3Upload.js';
import { sendPushToUser } from '../utils/webpush.js';

// Shared populate shape for a message doc: sender/receiver profile bits,
// plus a lightweight preview of whatever it replies to or shares.
const MESSAGE_POPULATE = [
  { path: 'senderId', select: 'username profilePicture lastSeen' },
  { path: 'receiverId', select: 'username profilePicture lastSeen' },
  {
    path: 'replyTo',
    select: 'content media mediaType senderId',
    populate: { path: 'senderId', select: 'username' },
  },
  {
    path: 'sharedPost',
    select: 'content media mediaType userId',
    populate: { path: 'userId', select: 'username profilePicture' },
  },
];

// @desc    Send a message
// @route   POST /api/messages
// @access  Private
export const sendMessage = async (req, res) => {
  try {
    const { receiverId, content, replyTo, sharedPostId } = req.body;

    if (!receiverId) {
      return res.status(400).json({ message: 'Receiver is required' });
    }

    let media = '';
    let mediaType = 'none';

    if (req.file) {
      const { url } = await uploadFileToS3(req.file, 'messages');
      media = url;
      const extension = req.file.originalname.split('.').pop().toLowerCase();
      mediaType = ['mp4', 'mov', 'avi'].includes(extension) ? 'video' : 'image';
    }

    if (!content && !media && !sharedPostId) {
      return res.status(400).json({ message: 'Message must have content, media, or a shared post' });
    }

    let sharedPost = null;
    if (sharedPostId) {
      const post = await Post.findById(sharedPostId);
      if (!post) {
        return res.status(404).json({ message: 'Shared post not found' });
      }
      sharedPost = post._id;
    }

    let replyToId = null;
    if (replyTo) {
      const original = await Message.findById(replyTo);
      if (original) replyToId = original._id;
    }

    const message = await Message.create({
      senderId: req.user._id,
      receiverId,
      content,
      media,
      mediaType,
      replyTo: replyToId,
      sharedPost,
    });

    const populatedMessage = await Message.findById(message._id).populate(MESSAGE_POPULATE);

    // Notify real-time socket server (if set up)
    if (global.io) {
      const recipientSocketId = global.onlineUsers?.get(receiverId);
      if (recipientSocketId) {
        global.io.to(recipientSocketId).emit('receiveMessage', populatedMessage);
      }
    }

    // Best-effort browser/OS push, so the recipient is notified even when
    // they have no live socket connection (app closed/backgrounded). Kept
    // separate from the Notification/bell system rather than routed
    // through createNotification, so DMs don't clutter the activity feed —
    // messages already have their own unread badge in the sidebar. Not
    // awaited — push-service round trips can take a second or more, and
    // sending a message shouldn't wait on that.
    if (receiverId !== req.user._id.toString()) {
      sendPushToUser(receiverId, {
        title: 'Oku',
        body: sharedPost
          ? `${req.user.username} shared a post with you`
          : media
            ? `${req.user.username} sent you ${mediaType === 'image' ? 'a photo' : 'a video'}`
            : `${req.user.username} sent you a message`,
        icon: '/favicon.svg',
        url: `/messages?user=${req.user.username}`,
      }).catch((err) => console.error('Push send error:', err.message));
    }

    res.status(201).json(populatedMessage);
  } catch (error) {
    console.error('sendMessage Error:', error);
    res.status(500).json({ message: 'Server error sending message' });
  }
};

// @desc    Add, change, or remove your reaction on a message. Sending the
//          same emoji you already reacted with removes it; a different
//          emoji replaces it — one reaction per user per message.
// @route   PUT /api/messages/:id/react
// @access  Private
export const reactToMessage = async (req, res) => {
  try {
    const { emoji } = req.body;
    if (!emoji) {
      return res.status(400).json({ message: 'Emoji is required' });
    }

    const message = await Message.findById(req.params.id);
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    const userId = req.user._id.toString();
    const isParticipant =
      message.senderId.toString() === userId || message.receiverId.toString() === userId;
    if (!isParticipant) {
      return res.status(401).json({ message: 'Action not authorized' });
    }

    const existingIndex = message.reactions.findIndex((r) => r.userId.toString() === userId);
    if (existingIndex !== -1 && message.reactions[existingIndex].emoji === emoji) {
      message.reactions.splice(existingIndex, 1);
    } else if (existingIndex !== -1) {
      message.reactions[existingIndex].emoji = emoji;
    } else {
      message.reactions.push({ userId: req.user._id, emoji });
    }

    await message.save();

    const partnerId =
      message.senderId.toString() === userId
        ? message.receiverId.toString()
        : message.senderId.toString();

    if (global.io) {
      const partnerSocketId = global.onlineUsers?.get(partnerId);
      if (partnerSocketId) {
        global.io.to(partnerSocketId).emit('messageReaction', {
          messageId: message._id,
          reactions: message.reactions,
        });
      }
    }

    res.json({ messageId: message._id, reactions: message.reactions });
  } catch (error) {
    console.error('reactToMessage Error:', error);
    res.status(500).json({ message: 'Server error updating reaction' });
  }
};

// @desc    Delete a message for the current user only ("delete for me").
//          The document (and its media) is permanently removed once both
//          participants have deleted it on their end.
// @route   DELETE /api/messages/:id
// @access  Private
export const deleteMessage = async (req, res) => {
  try {
    const message = await Message.findById(req.params.id);

    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    const userId = req.user._id.toString();
    const isParticipant =
      message.senderId.toString() === userId || message.receiverId.toString() === userId;

    if (!isParticipant && !req.user.isAdmin) {
      return res.status(401).json({ message: 'Action not authorized' });
    }

    // Admin moderation removes the message outright, regardless of what the
    // participants have individually deleted.
    if (req.user.isAdmin && !isParticipant) {
      if (message.media) {
        await deleteFileFromS3(message.media);
      }
      await message.deleteOne();
      return res.json({ message: 'Message deleted successfully', messageId: message._id });
    }

    const alreadyDeletedFor = message.deletedFor.map((id) => id.toString());
    if (!alreadyDeletedFor.includes(userId)) {
      message.deletedFor.push(req.user._id);
    }

    const bothParticipantsDeleted =
      message.deletedFor.some((id) => id.toString() === message.senderId.toString()) &&
      message.deletedFor.some((id) => id.toString() === message.receiverId.toString());

    if (bothParticipantsDeleted) {
      if (message.media) {
        await deleteFileFromS3(message.media);
      }
      await message.deleteOne();
    } else {
      await message.save();
    }

    res.json({ message: 'Message deleted successfully', messageId: message._id });
  } catch (error) {
    console.error('deleteMessage Error:', error);
    res.status(500).json({ message: 'Server error deleting message' });
  }
};

// @desc    Get chat history between two users
// @route   GET /api/messages/:userId
// @access  Private
export const getMessages = async (req, res) => {
  try {
    const chatPartnerId = req.params.userId;
    const currentUserId = req.user._id;

    // Get messages, excluding ones this user has "deleted for me"
    const messages = await Message.find({
      $or: [
        { senderId: currentUserId, receiverId: chatPartnerId },
        { senderId: chatPartnerId, receiverId: currentUserId },
      ],
      deletedFor: { $ne: currentUserId },
    })
      .sort({ createdAt: 1 })
      .populate(MESSAGE_POPULATE);

    // Mark partner's messages as read
    await Message.updateMany(
      { senderId: chatPartnerId, receiverId: currentUserId, isRead: false },
      { $set: { isRead: true } }
    );

    res.json(messages);
  } catch (error) {
    console.error('getMessages Error:', error);
    res.status(500).json({ message: 'Server error retrieving messages' });
  }
};

// @desc    Get list of active conversations
// @route   GET /api/messages/conversations/list
// @access  Private
export const getConversations = async (req, res) => {
  try {
    const currentUserId = req.user._id;

    // Find all messages sent or received by user, excluding ones they've
    // "deleted for me"
    const messages = await Message.find({
      $or: [{ senderId: currentUserId }, { receiverId: currentUserId }],
      deletedFor: { $ne: currentUserId },
    })
      .sort({ createdAt: -1 })
      .populate('senderId', 'username profilePicture lastSeen')
      .populate('receiverId', 'username profilePicture lastSeen');

    // Filter unique conversation partners and extract their last message
    const conversationMap = new Map();

    for (const msg of messages) {
      const partner = msg.senderId._id.toString() === currentUserId.toString()
        ? msg.receiverId
        : msg.senderId;

      const partnerId = partner._id.toString();

      if (!conversationMap.has(partnerId)) {
        conversationMap.set(partnerId, {
          user: partner,
          lastMessage: {
            content: msg.content,
            mediaType: msg.mediaType,
            sharedPost: !!msg.sharedPost,
            createdAt: msg.createdAt,
            senderId: msg.senderId._id,
            isRead: msg.isRead,
          },
        });
      }
    }

    const conversations = Array.from(conversationMap.values());
    res.json(conversations);
  } catch (error) {
    console.error('getConversations Error:', error);
    res.status(500).json({ message: 'Server error retrieving conversations' });
  }
};

// @desc    Delete an entire conversation for the current user only
//          ("delete for me"). Each message (and its media) is permanently
//          removed only once both participants have deleted it.
// @route   DELETE /api/messages/conversation/:userId
// @access  Private
export const deleteConversation = async (req, res) => {
  try {
    const partnerId = req.params.userId;
    const currentUserId = req.user._id;

    const filter = {
      $or: [
        { senderId: currentUserId, receiverId: partnerId },
        { senderId: partnerId, receiverId: currentUserId },
      ],
      deletedFor: { $ne: currentUserId },
    };

    const messages = await Message.find(filter);

    const toHardDelete = [];
    const toSoftDelete = [];

    for (const message of messages) {
      message.deletedFor.push(currentUserId);
      const bothParticipantsDeleted =
        message.deletedFor.some((id) => id.toString() === message.senderId.toString()) &&
        message.deletedFor.some((id) => id.toString() === message.receiverId.toString());

      if (bothParticipantsDeleted) {
        toHardDelete.push(message);
      } else {
        toSoftDelete.push(message);
      }
    }

    await Promise.all(
      toHardDelete.filter((m) => m.media).map((m) => deleteFileFromS3(m.media))
    );

    await Promise.all([
      toHardDelete.length
        ? Message.deleteMany({ _id: { $in: toHardDelete.map((m) => m._id) } })
        : Promise.resolve(),
      ...toSoftDelete.map((m) => m.save()),
    ]);

    res.json({ message: 'Conversation deleted successfully' });
  } catch (error) {
    console.error('deleteConversation Error:', error);
    res.status(500).json({ message: 'Server error deleting conversation' });
  }
};
