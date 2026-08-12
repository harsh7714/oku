import Message from '../models/Message.js';
import User from '../models/User.js';

// @desc    Send a message
// @route   POST /api/messages
// @access  Private
export const sendMessage = async (req, res) => {
  try {
    const { receiverId, content } = req.body;

    if (!receiverId || !content) {
      return res.status(400).json({ message: 'Receiver and content are required' });
    }

    const message = await Message.create({
      senderId: req.user._id,
      receiverId,
      content,
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
