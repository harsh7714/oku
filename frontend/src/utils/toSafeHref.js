// Normalizes user-entered URLs (bio website, post links) into a safe href.
// Adds https:// to bare domains and rejects any non-http(s) scheme (e.g.
// javascript:) so they can be dropped straight into an <a href>.
export function toSafeHref(rawUrl) {
  if (!rawUrl) return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return parsed.href;
  } catch {
    return null;
  }
}
