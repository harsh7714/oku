import React, { useEffect, useRef, useState } from 'react';
import { getMediaUrl } from '../utils/mediaUrl';
import { getAspectRatio } from '../utils/mediaMetadata';
import './MediaRenderer.css';

const FEED_MIN_RATIO = 0.8;
const FEED_MAX_RATIO = 1.91;
const REEL_RATIO = 9 / 16;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const MediaRenderer = ({
  src,
  type = 'image',
  aspectRatio,
  width,
  height,
  mode = 'feed',
  className = '',
  mediaClassName = '',
  onClick,
  mediaRef,
  active = true,
  controls = false,
  muted = false,
  loop = false,
  playsInline = true,
  autoPlay = false,
  loading = 'lazy',
  preload,
}) => {
  const backgroundVideoRef = useRef(null);
  const [measuredRatio, setMeasuredRatio] = useState(null);
  const mediaUrl = getMediaUrl(src);
  const sourceRatio = getAspectRatio({ aspectRatio, width, height }) || measuredRatio;
  const frameRatio = mode === 'reel'
    ? REEL_RATIO
    : mode === 'thumbnail'
      ? 1
      : clamp(sourceRatio || 1, FEED_MIN_RATIO, FEED_MAX_RATIO);
  const ratioMatchesFrame = sourceRatio && Math.abs(sourceRatio - frameRatio) < 0.001;
  const reelPortrait = sourceRatio ? sourceRatio < 0.95 : false;
  const reelCloseToFrame = sourceRatio
    ? Math.abs(Math.log(sourceRatio / REEL_RATIO)) < 0.08
    : false;
  const fit = mode === 'thumbnail'
    ? 'cover'
    : mode === 'reel'
      ? (reelPortrait && reelCloseToFrame ? 'cover' : 'contain')
      : (ratioMatchesFrame ? 'cover' : 'contain');
  const showBackdrop = mode === 'reel' && Boolean(sourceRatio) && !(reelPortrait && reelCloseToFrame);

  useEffect(() => {
    setMeasuredRatio(null);
  }, [mediaUrl]);

  useEffect(() => {
    if (mode !== 'reel' || type !== 'video') return;
    const videos = [mediaRef?.current, backgroundVideoRef.current].filter(Boolean);
    videos.forEach((video) => {
      if (active) video.play().catch(() => {});
      else video.pause();
    });
  }, [active, mediaRef, mode, type, showBackdrop]);

  const updateRatio = (element) => {
    const mediaWidth = type === 'video' ? element.videoWidth : element.naturalWidth;
    const mediaHeight = type === 'video' ? element.videoHeight : element.naturalHeight;
    if (mediaWidth && mediaHeight) setMeasuredRatio(mediaWidth / mediaHeight);
  };

  const style = { aspectRatio: `${frameRatio} / 1` };
  const sharedMediaProps = {
    className: `media-renderer__content ${mediaClassName}`.trim(),
    style: { objectFit: fit },
    onClick,
  };

  return (
    <div
      className={`media-renderer media-renderer--${mode} ${className}`.trim()}
      style={style}
      data-fit={fit}
      data-type={type}
    >
      {showBackdrop && (
        <div className="media-renderer__backdrop" aria-hidden="true">
          {type === 'video' ? (
            <video
              ref={backgroundVideoRef}
              src={mediaUrl}
              muted
              loop
              playsInline
              autoPlay={active}
              preload="metadata"
              tabIndex={-1}
            />
          ) : (
            <img src={mediaUrl} alt="" />
          )}
        </div>
      )}
      {type === 'video' ? (
        <video
          {...sharedMediaProps}
          ref={mediaRef}
          src={mediaUrl}
          controls={controls}
          autoPlay={mode === 'reel' ? active : autoPlay}
          muted={muted}
          loop={loop}
          playsInline={playsInline}
          preload={preload || (mode === 'reel' ? 'auto' : 'metadata')}
          onLoadedMetadata={(event) => updateRatio(event.currentTarget)}
        />
      ) : (
        <img
          {...sharedMediaProps}
          src={mediaUrl}
          alt=""
          loading={mode === 'reel' ? 'eager' : loading}
          onLoad={(event) => updateRatio(event.currentTarget)}
        />
      )}
    </div>
  );
};

export default MediaRenderer;
