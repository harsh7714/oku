# OKU — Real-Time Social Media Platform
## Project Report

**Built on the MERN stack with Socket.IO**  
*August 2026*

---

## Table of Contents
1. [Introduction](#1-introduction)
2. [Objectives](#2-objectives)
3. [Technology Stack](#3-technology-stack)
4. [System Architecture](#4-system-architecture)
5. [Database Schema](#5-database-schema)
6. [Core Features](#6-core-features)
7. [API Reference](#7-api-reference)
8. [Real-Time & Web Push Events](#8-real-time--web-push-events)
9. [Security Measures](#9-security-measures)
10. [Challenges & Solutions](#10-challenges--solutions)
11. [Future Enhancements](#11-future-enhancements)
12. [Conclusion](#12-conclusion)

---

## 1. Introduction

Oku is a full-stack, real-time social media web application built on the MERN stack (MongoDB, Express, React 19, Node.js) augmented with Socket.IO for low-latency bidirectional communication and Web Push notifications (VAPID). It provides the core mechanics of a modern social network: user accounts with full lifecycle management (including **Delete Account**), a personalized home feed, media-rich posts, likes and comments, social graph management (followers/following), real-time direct messaging, and instant notification delivery.

The application is organized as two independently deployable services — a React single-page frontend and an Express REST + WebSocket backend — sharing a MongoDB database and an AWS S3 bucket for cloud object storage.

---

## 2. Objectives

The project set out to:
- Build a complete, production-shaped social platform end-to-end — frontend, backend, and database.
- Implement secure authentication and authorization using JSON Web Tokens (JWT) with stateless session verification.
- Provide user control over account data, including a full **Delete Account** option with cascade cleanup of posts, media, comments, messages, and social connections.
- Support rich media posts and attachments (images and video) via AWS S3 cloud object storage.
- Provide real-time messaging, typing indicators, online/offline presence, and Web Push notifications.
- Implement a responsive UI across Desktop (> 1024px), Tablet (768px – 1024px), and Mobile (< 768px) views with post scroll & layout optimizations.
- Apply industry-standard security practices: password hashing (bcrypt), rate limiting, input validation, and secure HTTP headers.

---

## 3. Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | React 19, React Router 7, Vite | Single-page application, client-side routing, dev/build tooling |
| Frontend | Axios | REST API communication |
| Frontend | Socket.IO Client | Real-time messaging, notifications, presence tracking |
| Frontend | Lucide React | Icon set |
| Backend | Node.js, Express 4 | HTTP server and REST API routing |
| Backend | Mongoose 8 | MongoDB object modeling (ODM) |
| Backend | Socket.IO | WebSocket server for real-time events |
| Backend | web-push | VAPID Web Push notification server |
| Backend | jsonwebtoken, bcryptjs | Authentication, JWT issuance, password hashing |
| Backend | Multer + AWS SDK v3 (S3) | Media upload handling and cloud storage |
| Database | MongoDB (Atlas / Memory Server) | Primary data store |
| Security | Helmet, CORS, express-rate-limit, express-validator | HTTP hardening, rate limiting, input validation |
| Tooling | Nodemon, oxlint, mongodb-memory-server | Dev auto-restart, linting, zero-setup local DB |

---

## 4. System Architecture

Oku follows a three-tier architecture: a React client, an Express + Socket.IO application server, and a MongoDB data layer, with AWS S3 as a dedicated media store.

### 4.1 Request — Response Flow
- **REST Channel**: The React client communicates with Express over REST (via Axios) for CRUD operations. Every authenticated request carries a JWT in the `Authorization: Bearer <token>` header.
- **WebSocket Channel**: Socket.IO maintains a persistent connection for instant events (chat messages, typing indicators, notification badges, presence changes).
- **Web Push Channel**: The backend dispatches Web Push notifications using VAPID keys even when the browser client is offline or closed.
- **Media Upload Flow**: Multipart form uploads are received by Multer, validated for MIME type and file size, streamed to AWS S3, and only the S3 URL is stored in MongoDB.

### 4.2 Component Responsibilities

| Component | Responsibility |
|---|---|
| React SPA (`frontend/`) | Routing, UI rendering, responsive grid layouts, Auth/Socket/Toast/Call contexts, optimistic UI updates |
| Express API (`backend/`) | Route handling, input validation, business logic, JWT verification, account deletion handling |
| Socket.IO server | Real-time message/notification delivery, typing indicators, online presence tracking |
| MongoDB | Persistent storage for users, posts, comments, messages, notifications, push subscriptions |
| AWS S3 | Durable object storage for user avatars, covers, post media, and chat attachments |

---

## 5. Database Schema

### 5.1 User Model (`User`)
- `username`: String (Required, unique, lowercase, trimmed, min 3 chars)
- `email`: String (Required, unique, lowercase, trimmed, regex-validated)
- `password`: String (Required, min 6 chars, bcrypt-hashed; stripped from JSON output)
- `profilePicture`: String (S3 URL, defaults to empty string)
- `coverPicture`: String (S3 URL, defaults to empty string)
- `bio`: String (Max 160 chars)
- `website`: String (Max 100 chars)
- `followers`: `[ObjectId] -> User`
- `following`: `[ObjectId] -> User`
- `isAdmin`: Boolean (Default false)
- `lastSeen`: Date (Updated on socket disconnect)
- `pushSubscriptions`: `[{ endpoint, keys: { p256dh, auth } }]`

### 5.2 Post Model (`Post`)
- `userId`: `ObjectId -> User` (Required, author)
- `content`: String (Max 2000 chars)
- `media`: String (S3 URL)
- `mediaType`: String enum ('image' | 'video' | 'none')
- `likes`: `[ObjectId] -> User`
- `commentsCount`: Number (Default 0)
- `hashtags`: `[String]` (Indexed for tag search)

### 5.3 Comment Model (`Comment`)
- `postId`: `ObjectId -> Post` (Required, parent post)
- `userId`: `ObjectId -> User` (Required, comment author)
- `content`: String (Required, max 500 chars)

### 5.4 Message Model (`Message`)
- `senderId`: `ObjectId -> User` (Required)
- `receiverId`: `ObjectId -> User` (Required)
- `content`: String (Max 2000 chars)
- `media`: String (S3 URL)
- `mediaType`: String enum ('image' | 'video' | 'none')
- `isRead`: Boolean (Default false)

### 5.5 Notification Model (`Notification`)
- `recipientId`: `ObjectId -> User` (Required)
- `senderId`: `ObjectId -> User` (Required)
- `type`: String enum ('like' | 'comment' | 'follow' | 'message')
- `postId`: `ObjectId -> Post` (Nullable)
- `isRead`: Boolean (Default false)

---

## 6. Core Features

### 6.1 Account Lifecycle & Delete Account
- User registration and login with JWT session management.
- **Delete Account**: Users can permanently delete their account from the Edit Profile section. Triggers a full cascade deletion:
  1. Deletes user's profile and cover photos from S3.
  2. Deletes user's post media attachments from S3.
  3. Removes all posts authored by the user (`Post.deleteMany`).
  4. Removes all comments authored by the user or on the user's posts (`Comment.deleteMany`).
  5. Removes user ID from followers/following lists of all other users (`User.updateMany`).
  6. Removes user likes from all posts (`Post.updateMany`).
  7. Cleans up notifications (`Notification.deleteMany`) and direct messages (`Message.deleteMany`).
  8. Deletes the user record (`User.findByIdAndDelete`).

### 6.2 Responsive UI & Post View Optimization
- **Responsive Layout**:
  - **Desktop** (> 1024px): 3-column grid (`240px 1fr 320px`).
  - **Tablet** (768px – 1024px): 2-column grid (`80px 1fr`), hiding heavy right sidebar and giving ~85% width to the main feed.
  - **Mobile** (< 768px): 1-column grid (`1fr`) with sticky header and bottom tab navigation rail.
- **Feed Scroll Optimization**:
  - Reorganized feed hierarchy placing CreatePostBox immediately after stories so posts appear front-and-center on load without forced scrolling.
  - Scaled post card media dimensions (`max-height: 380px` desktop, `300px` tablet/mobile) for balanced viewport fit.

### 6.3 Social Graph, Messaging & Real-Time Notifications
- Follow/unfollow mechanics with follower count sync and searchable list modals.
- Real-time 1-on-1 chat with typing indicators, media attachments, and online presence badges.
- Live in-app toast feedback and Web Push notifications for likes, comments, and follows.

---

## 7. API Reference

All routes mounted under `/api`. Protected routes require `Authorization: Bearer <JWT>`.

### 7.1 Auth (`/api/auth`)
- `POST /register`: Register user
- `POST /login`: Authenticate and receive JWT
- `GET /me`: Get authenticated user profile

### 7.2 Users (`/api/users`)
- `GET /search?q=`: Search users by username
- `GET /suggestions`: Get suggested users to follow
- `GET /profile/:username`: Get public profile
- `GET /:id`: Get user by ID
- `PUT /profile`: Update profile info & images
- `PUT /:id/follow`: Follow user
- `PUT /:id/unfollow`: Unfollow user
- `DELETE /account`: **Delete account permanently (Cascade delete)**

### 7.3 Posts (`/api/posts`)
- `GET /feed`: Paginated feed of followed users' posts
- `GET /explore`: Paginated public posts (latest/trending, tag filter)
- `GET /user/:username`: Get posts by username
- `POST /`: Create post (with optional image/video upload)
- `DELETE /:id`: Delete post
- `PUT /:id/like`: Toggle like on post
- `POST /:postId/comments`: Add comment
- `GET /:postId/comments`: List comments
- `DELETE /:postId/comments/:id`: Delete comment

### 7.4 Messages (`/api/messages`)
- `GET /conversations/list`: List conversations with last message preview
- `GET /:userId`: Fetch direct chat history with a user
- `POST /`: Send message
- `DELETE /:id`: Delete message
- `DELETE /conversation/:userId`: Delete conversation

### 7.5 Notifications & Push (`/api/notifications` & `/api/push`)
- `GET /api/notifications`: List user notifications
- `PUT /api/notifications/read`: Mark notifications read
- `GET /api/push/public-key`: Get VAPID public key
- `POST /api/push/subscribe`: Save push subscription
- `POST /api/push/unsubscribe`: Remove push subscription

---

## 8. Real-Time & Web Push Events

### 8.1 Socket.IO Events
- `setup` (Client -> Server): Register connected socket to user ID
- `onlineUsers` (Server -> Clients): Broadcast active user IDs
- `joinChat` / `typing` / `stopTyping`: Chat room & typing state
- `receiveMessage` (Server -> Client): Deliver live message
- `receiveNotification` (Server -> Client): Deliver live notification
- `disconnect`: Update user `lastSeen` timestamp

### 8.2 Web Push Notifications
- Integrated via `web-push` library with VAPID keys.
- Delivers push notifications for new messages, likes, and follows directly to user devices/browsers even when offline.

---

## 9. Security Measures

- **Password Hashing**: Hashed via bcrypt (10 rounds) before DB persistence; excluded from JSON serializations via custom `toJSON` hook.
- **JWT Protection**: Stateless verification via `protect` middleware on all private endpoints.
- **Input Validation**: `express-validator` sanitizes and validates request parameters and payloads.
- **Rate Limiting**: `express-rate-limit` prevents brute-force login attempts (10 requests / 15 min on auth routes, 300 / 15 min globally).
- **HTTP Hardening**: Helmet sets security headers tuned for cross-origin media embedding.
- **File Upload Security**: Extension & MIME-type checks restricting uploads to images and videos capped at 25MB.

---

## 10. Challenges & Solutions

| Challenge | Solution |
|---|---|
| **Account Deletion Cleanup**: Preventing orphaned database records or invalid follower references when an account is deleted. | Built an atomic cascade deletion handler in `userController.js` that removes S3 files, user posts, comments, likes, notifications, and user references in parallel. |
| **Responsive Grid Misalignment on Tablets (768px–1024px)**: Right sidebar squeezed center feed into cramped space. | Shifted right sidebar hiding threshold from 900px to 1024px and set tablet layout to a clean 2-column grid (`80px 1fr`). |
| **Excessive Feed Scrolling on Mobile**: Feed header, stories, suggestions, and tall create box pushed posts below screen fold. | Reordered HomeFeed layout, made story rail compact, and constrained post image/video heights (`max-height: 300px` on mobile). |
| **Media Modal Viewport Overflow**: 100vh modals overflowing past address bars on mobile browsers. | Implemented `dvh` (dynamic viewport height) units in `PostViewerModal.css` for robust mobile browser support. |

---

## 11. Future Enhancements

- Post bookmarking & saved collections.
- Hashtag trending analytics dashboard.
- End-to-end encrypted direct messaging.
- Admin moderation portal with content flagging.
- Automated end-to-end test suite (Playwright / Cypress).

---

## 12. Conclusion

Oku delivers a modern, production-grade social platform with rich features: secure JWT authentication, complete account lifecycle control with permanent account deletion, real-time messaging, Web Push notifications, and a responsive UI tailored for desktop, tablet, and mobile devices.
