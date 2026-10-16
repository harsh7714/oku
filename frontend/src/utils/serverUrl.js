const configuredUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// Accept both the documented server URL and the common value people paste
// from an API deployment (https://host.example/api). REST adds /api itself;
// Socket.IO and media URLs must always use the origin without that suffix.
export const SERVER_URL = configuredUrl.replace(/\/api\/?$/, '');
