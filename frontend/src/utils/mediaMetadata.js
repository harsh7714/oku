export function getMediaDescriptor(media, fallbackType = 'image') {
  if (typeof media === 'string') return { url: media, type: fallbackType };
  if (!media || typeof media !== 'object') return { url: '', type: fallbackType };
  return { ...media, url: media.url || '', type: media.type || fallbackType };
}

export function getAspectRatio(media) {
  const storedRatio = Number(media?.aspectRatio);
  if (Number.isFinite(storedRatio) && storedRatio > 0) return storedRatio;

  const width = Number(media?.width);
  const height = Number(media?.height);
  if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
    return width / height;
  }

  return null;
}

export function getOrientation(aspectRatio) {
  if (aspectRatio < 0.95) return 'portrait';
  if (aspectRatio > 1.05) return 'landscape';
  return 'square';
}

export const MAX_VIDEO_DURATION_SECONDS = 60;
export const MAX_VIDEO_SIZE_BYTES = 100 * 1024 * 1024;
export const MAX_VIDEO_BYTES_PER_SECOND = MAX_VIDEO_SIZE_BYTES / MAX_VIDEO_DURATION_SECONDS;

export function readLocalMediaDimensions(file, type) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const cleanUp = (element) => {
      if (element) {
        element.onload = null;
        element.onerror = null;
        element.onloadedmetadata = null;
        if (element instanceof HTMLVideoElement) {
          element.removeAttribute('src');
          element.load();
        }
      }
      URL.revokeObjectURL(objectUrl);
    };

    if (type === 'video') {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        const width = video.videoWidth;
        const height = video.videoHeight;
        const duration = video.duration;
        cleanUp(video);
        if (!width || !height || !Number.isFinite(duration) || duration <= 0) {
          return reject(new Error('Unable to read video metadata'));
        }
        if (duration > MAX_VIDEO_DURATION_SECONDS) {
          return reject(new Error('Videos must be 60 seconds or shorter'));
        }
        const aspectRatio = width / height;
        resolve({ width, height, duration, aspectRatio, orientation: getOrientation(aspectRatio) });
      };
      video.onerror = () => {
        cleanUp(video);
        reject(new Error('Unable to read video metadata'));
      };
      video.src = objectUrl;
      video.load();
      return;
    }

    const image = new Image();
    image.onload = () => {
      const width = image.naturalWidth;
      const height = image.naturalHeight;
      cleanUp(image);
      if (!width || !height) return reject(new Error('Unable to read image dimensions'));
      const aspectRatio = width / height;
      resolve({ width, height, aspectRatio, orientation: getOrientation(aspectRatio) });
    };
    image.onerror = () => {
      cleanUp(image);
      reject(new Error('Unable to read image dimensions'));
    };
    image.src = objectUrl;
  });
}
