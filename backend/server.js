import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import http from 'http';
import path from 'path';
import multer from 'multer';
import { fileURLToPath } from 'url';

import connectDB from './src/config/db.js';
import { MAX_UPLOAD_SIZE_BYTES } from './src/middleware/upload.js';
import authRoutes from './src/routes/authRoutes.js';
import userRoutes from './src/routes/userRoutes.js';
import postRoutes from './src/routes/postRoutes.js';
import messageRoutes from './src/routes/messageRoutes.js';
import notificationRoutes from './src/routes/notificationRoutes.js';
import pushRoutes from './src/routes/pushRoutes.js';
import initSocket from './src/utils/socket.js';
import { generalLimiter } from './src/middleware/rateLimiters.js';

// Resolve __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

// Connect to Database
connectDB();

const app = express();
const server = http.createServer(app);

// Trust the first hop (Render/Railway/etc. reverse proxy) so express-rate-limit
// and req.ip see the real client IP instead of collapsing every user onto the
// proxy's IP, which would share one rate-limit bucket across all users.
app.set('trust proxy', 1);

// Initialize Socket.io
initSocket(server);

// Middleware
app.use(cors({ origin: '*' })); // Allow cross-origin requests
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev')); // Logger

// Configure Helmet with CORS-friendly settings for media loading
app.use(
  helmet({
    crossOriginResourcePolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);

// Serve uploads folder static files
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

app.use('/api', generalLimiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/push', pushRoutes);

// Base route
app.get('/', (req, res) => {
  res.send('Oku Social Media API is running...');
});

// 404 handler for unmatched routes
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    const message =
      err.code === 'LIMIT_FILE_SIZE'
        ? `File is too large. Maximum size is ${MAX_UPLOAD_SIZE_BYTES / (1024 * 1024)}MB.`
        : err.message;
    return res.status(400).json({ message });
  }

  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(statusCode);
  res.json({
    message: err.message,
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});
