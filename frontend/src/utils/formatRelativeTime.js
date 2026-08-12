// Converts a date into a short "time ago" string, e.g. "just now", "5m ago".
export const formatRelativeTime = (dateInput) => {
  if (!dateInput) return 'a while ago';

  const diffMs = Date.now() - new Date(dateInput).getTime();
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 60) return 'just now';

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;

  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;

  return new Date(dateInput).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};
