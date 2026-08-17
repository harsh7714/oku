const SERVER_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// Post/profile media is now stored as an absolute S3 URL, but older records
// (or a local dev server without AWS configured) may still hold a relative
// /uploads/... path, so pass those through the backend origin.
export function getMediaUrl(mediaPath) {
  if (!mediaPath) return '';
  if (/^https?:\/\//i.test(mediaPath)) return mediaPath;
  return `${SERVER_URL}${mediaPath}`;
}

// Shared avatar resolver: any user-shaped object with a profilePicture, or
// a plain generic silhouette (Instagram-style) when none is set.
export function getAvatarUrl(user) {
  return user?.profilePicture ? getMediaUrl(user.profilePicture) : '/default-avatar.svg';
}
