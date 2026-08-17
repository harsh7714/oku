import { Server } from 'socket.io';
import User from '../models/User.js';

const initSocket = (server) => {
  const io = new Server(server, {
    pingTimeout: 60000,
    cors: {
      origin: '*', // In production, replace with specific frontend URL
      methods: ['GET', 'POST'],
    },
  });

  global.io = io;
  const onlineUsers = new Map(); // userId -> socketId
  global.onlineUsers = onlineUsers;

  io.on('connection', (socket) => {
    console.log('Connected to socket.io');

    socket.on('setup', (userId) => {
      if (!userId) return;
      socket.join(userId);
      socket.userId = userId;
      onlineUsers.set(userId, socket.id);
      
      console.log(`User ${userId} registered and joined room`);
      io.emit('onlineUsers', Array.from(onlineUsers.keys()));
    });

    socket.on('joinChat', (room) => {
      socket.join(room);
      console.log(`User joined chat room: ${room}`);
    });

    socket.on('typing', (room) => socket.in(room).emit('typing', room));
    socket.on('stopTyping', (room) => socket.in(room).emit('stopTyping', room));

    // WebRTC voice/video call signaling — the server only ever relays SDP
    // offers/answers and ICE candidates between the two participants' rooms
    // (each user already has a room named after their own userId, joined on
    // 'setup'); media itself flows peer-to-peer once connected.
    socket.on('callUser', ({ to, offer, callType, caller }) => {
      if (!to) return;
      io.to(to).emit('incomingCall', { from: socket.userId, offer, callType, caller });
    });

    socket.on('answerCall', ({ to, answer }) => {
      if (!to) return;
      io.to(to).emit('callAnswered', { from: socket.userId, answer });
    });

    socket.on('iceCandidate', ({ to, candidate }) => {
      if (!to) return;
      io.to(to).emit('iceCandidate', { from: socket.userId, candidate });
    });

    socket.on('rejectCall', ({ to }) => {
      if (!to) return;
      io.to(to).emit('callRejected', { from: socket.userId });
    });

    socket.on('endCall', ({ to }) => {
      if (!to) return;
      io.to(to).emit('callEnded', { from: socket.userId });
    });

    socket.on('sendMessage', (message) => {
      const chat = message.receiverId;
      if (!chat) return console.log('chat.receiverId not defined');

      // Emit to the receiver's room (userId)
      socket.in(chat._id).emit('receiveMessage', message);
    });

    socket.on('disconnect', () => {
      console.log('User disconnected from socket');
      if (socket.userId) {
        onlineUsers.delete(socket.userId);
        io.emit('onlineUsers', Array.from(onlineUsers.keys()));
        User.findByIdAndUpdate(socket.userId, { lastSeen: new Date() }).catch((err) =>
          console.error('Error updating lastSeen:', err)
        );
      }
    });
  });

  return io;
};

export default initSocket;
