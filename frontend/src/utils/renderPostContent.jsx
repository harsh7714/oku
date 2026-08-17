import { toSafeHref } from './toSafeHref';

// Splits post/caption content on #hashtag, @mention, and URL tokens,
// rendering hashtags as clickable links into Explore's tag filter,
// @mentions as clickable links to the tagged user's profile, and URLs as
// external links, leaving the rest as plain text. Shared by PostCard,
// PostViewerModal, and ReelsPage so captions link consistently everywhere.
export const renderPostContent = (content, navigate) => {
  const parts = content.split(/(#\w+|@\w+|https?:\/\/\S+|www\.\S+)/g);
  return parts.map((part, i) => {
    if (/^#\w+$/.test(part)) {
      const tag = part.slice(1).toLowerCase();
      return (
        <span
          key={i}
          className="post-hashtag"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/explore?tag=${tag}`);
          }}
        >
          {part}
        </span>
      );
    }
    if (/^@\w+$/.test(part)) {
      const username = part.slice(1);
      return (
        <span
          key={i}
          className="post-mention"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/profile/${username}`);
          }}
        >
          {part}
        </span>
      );
    }
    if (/^(https?:\/\/|www\.)\S+$/.test(part)) {
      const href = toSafeHref(part);
      if (href) {
        return (
          <a
            key={i}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="post-link"
            onClick={(e) => e.stopPropagation()}
          >
            {part}
          </a>
        );
      }
    }
    return part;
  });
};
