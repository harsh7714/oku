import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import api from '../services/api';
import { getAvatarUrl } from '../utils/mediaUrl';
import './MentionInput.css';

// Detects an in-progress "@mention" token ending at the cursor (e.g. typing
// "hey @jo") and shows a matching-user dropdown, reusing the existing
// /users/search endpoint. Renders as either a single-line <input> (comments)
// or a <textarea> (post captions) depending on `as`, sharing the same
// autocomplete logic either way.
const detectMention = (text, cursor) => {
  const upToCursor = text.slice(0, cursor);
  const match = upToCursor.match(/(?:^|\s)@(\w*)$/);
  if (!match) return null;
  const query = match[1];
  return { start: cursor - query.length - 1, end: cursor, query };
};

const MentionInput = ({ as = 'input', value, onChange, className, ...rest }) => {
  const elRef = useRef(null);
  const [suggestions, setSuggestions] = useState([]);
  const [activeToken, setActiveToken] = useState(null);
  const [dropdownRect, setDropdownRect] = useState(null);

  const captureDropdownRect = () => {
    const rect = elRef.current?.getBoundingClientRect();
    if (rect) setDropdownRect(rect);
  };

  const handleChange = async (e) => {
    const text = e.target.value;
    const cursor = e.target.selectionStart;
    onChange(e);

    const mention = detectMention(text, cursor);
    if (mention && mention.query.length > 0) {
      setActiveToken(mention);
      captureDropdownRect();
      try {
        const { data } = await api.get(`/users/search?q=${mention.query}`);
        setSuggestions(data);
      } catch (err) {
        console.error('Mention search error:', err);
        setSuggestions([]);
      }
    } else {
      setActiveToken(null);
      setSuggestions([]);
    }
  };

  const selectMention = (username) => {
    if (!activeToken) return;
    const before = value.slice(0, activeToken.start);
    const after = value.slice(activeToken.end);
    const next = `${before}@${username} ${after}`;
    onChange({ target: { value: next } });
    setActiveToken(null);
    setSuggestions([]);

    const caretPos = before.length + username.length + 2;
    requestAnimationFrame(() => {
      elRef.current?.focus();
      elRef.current?.setSelectionRange(caretPos, caretPos);
    });
  };

  const Tag = as;
  const showDropdown = activeToken && suggestions.length > 0 && dropdownRect;

  return (
    <div className="mention-input-wrap">
      <Tag ref={elRef} value={value} onChange={handleChange} className={className} {...rest} />
      {showDropdown &&
        createPortal(
          <div
            className="mention-dropdown glass"
            style={{
              left: dropdownRect.left,
              top: dropdownRect.top,
              width: Math.max(dropdownRect.width, 220),
            }}
          >
            {suggestions.map((u) => (
              <div
                key={u._id}
                className="mention-dropdown-item"
                onMouseDown={(e) => {
                  e.preventDefault();
                  selectMention(u.username);
                }}
              >
                <img src={getAvatarUrl(u)} alt="" className="avatar" width="24" height="24" />
                <span>{u.username}</span>
              </div>
            ))}
          </div>,
          document.body
        )}
    </div>
  );
};

export default MentionInput;
