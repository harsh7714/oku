import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { SERVER_URL } from '../utils/serverUrl';

const SocketContext = createContext();

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const { user } = useAuth();
  const userId = user?._id;

  useEffect(() => {
    let newSocket;

    if (userId) {
      newSocket = io(SERVER_URL, {
        transports: ['websocket', 'polling'],
        reconnection: true,
      });
      setSocket(newSocket);

      newSocket.on('connect', () => {
        console.log('Connected to socket server');
        newSocket.emit('setup', userId);
      });

      newSocket.on('onlineUsers', (users) => {
        setOnlineUsers(users);
      });

      // Handle reconnect
      newSocket.on('reconnect', () => {
        newSocket.emit('setup', userId);
      });

      newSocket.on('connect_error', (error) => {
        console.error('Socket connection failed:', error.message);
      });
    }

    return () => {
      if (newSocket) {
        newSocket.disconnect();
        setSocket(null);
      }
    };
  }, [userId]);

  return (
    <SocketContext.Provider value={{ socket, onlineUsers }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
