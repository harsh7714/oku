import Message from '../models/Message.js';
import User from '../models/User.js';
import { uploadFileToS3, deleteFileFromS3 } from '../utils/s3Upload.js';

// @desc    Send a message
// @route   POST /api/messages
// @access  Private
export const sendMessage = async (req, res) => {
  try {
    const { receiverId, content } = req.body;

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

    if (!content && !media) {
      return res.status(400).json({ message: 'Message must have content or media' });
    }

    const message = await Message.create({
      senderId: req.user._id,
      receiverId,
      content,
      media,
      mediaType,
    });

    const populatedMessage = await Message.findById(message._id)
      .populate('senderId', 'username profilePicture lastSeen')
      .populate('receiverId', 'username profilePicture lastSeen');

    // Notify real-time socket server (if set up)
    if (global.io) {
      const recipientSocketId = global.onlineUsers?.get(receiverId);
      if (recipientSocketId) {
        global.io.to(recipientSocketId).emit('receiveMessage', populatedMessage);
      }
    }

    res.status(201).json(populatedMessage);
  } catch (error) {
    console.error('sendMessage Error:', error);
    res.status(500).json({ message: 'Server error sending message' });
  }
};

// @desc    Delete a message (and its media, if any) permanently
// @route   DELETE /api/messages/:id
// @access  Private
export const deleteMessage = async (req, res) => {
  try {
    const message = await Message.findById(req.params.id);

    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    if (message.senderId.toString() !== req.user._id.toString() && !req.user.isAdmin) {
      return res.status(401).json({ message: 'Action not authorized' });
    }

    if (message.media) {
      await deleteFileFromS3(message.media);
    }

    await message.deleteOne();

    // Notify the other participant in real time
    if (global.io) {
      const otherUserId =
        message.senderId.toString() === req.user._id.toString()
          ? message.receiverId.toString()
          : message.senderId.toString();
      const otherSocketId = global.onlineUsers?.get(otherUserId);
      if (otherSocketId) {
        global.io.to(otherSocketId).emit('messageDeleted', {
          messageId: message._id,
          senderId: message.senderId,
          receiverId: message.receiverId,
        });
      }
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

    // Get messages
    const messages = await Message.find({
      $or: [
        { senderId: currentUserId, receiverId: chatPartnerId },
        { senderId: chatPartnerId, receiverId: currentUserId },
      ],
    })
      .sort({ createdAt: 1 })
      .populate('senderId', 'username profilePicture lastSeen')
      .populate('receiverId', 'username profilePicture lastSeen');

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

    // Find all messages sent or received by user
    const messages = await Message.find({
      $or: [{ senderId: currentUserId }, { receiverId: currentUserId }],
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

// @desc    Permanently delete an entire conversation (and its media) with another user
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
    };

    const messages = await Message.find(filter);

    await Promise.all(
      messages.filter((m) => m.media).map((m) => deleteFileFromS3(m.media))
    );

    await Message.deleteMany(filter);

    if (global.io) {
      const partnerSocketId = global.onlineUsers?.get(partnerId);
      if (partnerSocketId) {
        global.io.to(partnerSocketId).emit('conversationDeleted', { partnerId: currentUserId });
      }
    }

    res.json({ message: 'Conversation deleted successfully' });
  } catch (error) {
    console.error('deleteConversation Error:', error);
    res.status(500).json({ message: 'Server error deleting conversation' });
  }
};
