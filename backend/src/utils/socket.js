import { Server } from 'socket.io';

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
      }
    });
  });

  return io;
};

export default initSocket;
