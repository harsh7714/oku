# Oku

Oku is a full-stack real-time social media application — a feed, profiles, follows, comments, likes, direct messaging, and live notifications, built on the MERN stack with Socket.IO.

## Tech Stack

**Frontend** — React 19, React Router 7, Vite, Axios, Socket.IO client, Lucide icons
**Backend** — Node.js, Express 4, MongoDB with Mongoose, Socket.IO, JWT auth, Multer + AWS S3 for media storage
**Security** — bcrypt password hashing, Helmet, CORS, express-rate-limit, express-validator

## Features

- Email/username + password auth with JWT sessions
- Home feed and Explore (latest / trending, hashtag filtering) with infinite scroll
- Posts with text, image, or video, likes, and threaded comments
- Follow / unfollow, followers & following lists, suggested users, user search
- Profiles with editable bio, avatar, and cover photo
- Real-time direct messaging with typing indicators, read receipts, and online presence
- Real-time notifications for likes, comments, and follows
- Toast notifications for all user-facing success/error feedback, with in-app confirmation dialogs in place of native browser alerts

## Project Structure

```
social media/
├── backend/               # Express + MongoDB API
│   └── src/
│       ├── config/        # DB and AWS S3 clients
│       ├── controllers/   # Route handlers (auth, users, posts, comments, messages, notifications)
│       ├── middleware/    # JWT auth guard, upload (Multer), validation, rate limiting
│       ├── models/        # Mongoose schemas: User, Post, Comment, Message, Notification
│       ├── routes/        # Express routers, mounted under /api
│       └── utils/         # Socket.IO setup, JWT signing, S3 upload helper, notification helper
│   └── server.js          # App entrypoint
│
└── frontend/               # React SPA (Vite)
    └── src/
        ├── components/     # Reusable UI (PostCard, Sidebar, Navbar, ToastContainer, ConfirmDialog, ...)
        ├── context/         # Auth, Socket, and Toast providers
        ├── hooks/           # useInfiniteScroll
        ├── pages/           # Route-level pages (Auth, HomeFeed, Explore, Profile, Messages, Notifications)
        ├── services/        # Axios API client
        └── utils/           # Media URL resolution, relative time formatting
```

## Getting Started

### Prerequisites
- Node.js 18+
- A MongoDB connection string (Atlas or local)
- An AWS S3 bucket (for media uploads)

### Backend setup

```bash
cd backend
npm install
```

Create `backend/.env`:

```
PORT=5000
MONGO_URI=<your MongoDB connection string>
JWT_SECRET=<a long random secret>
USE_MEMORY_DB=false

AWS_REGION=<your S3 bucket region>
AWS_ACCESS_KEY_ID=<your AWS access key>
AWS_SECRET_ACCESS_KEY=<your AWS secret key>
AWS_S3_BUCKET_NAME=<your S3 bucket name>
```

> Set `USE_MEMORY_DB=true` to skip MongoDB entirely and run against a throwaway in-memory database for local development.

```bash
npm run dev
```

The API runs on `http://localhost:5000`.

### Frontend setup

```bash
cd frontend
npm install
npm run dev
```

The app runs on `http://localhost:5173`.

## Scripts

| Location | Command | Description |
|---|---|---|
| `backend` | `npm run dev` | Start the API with nodemon (auto-restart) |
| `backend` | `npm start` | Start the API in production mode |
| `frontend` | `npm run dev` | Start the Vite dev server |
| `frontend` | `npm run build` | Production build |
| `frontend` | `npm run lint` | Lint with oxlint |

## API Overview

All endpoints are mounted under `/api` and (aside from `auth/register` and `auth/login`) require a `Bearer` JWT.

| Base | Handles |
|---|---|
| `/api/auth` | Register, login, current-session lookup |
| `/api/users` | Profiles, follow/unfollow, search, suggestions |
| `/api/posts` | Feed, explore, create/delete, likes, comments |
| `/api/messages` | Conversations, send/delete messages |
| `/api/notifications` | List and mark-as-read |

Real-time events (likes/comments/follows/messages/typing/presence) are delivered over Socket.IO alongside the REST API.
