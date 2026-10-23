import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import ffprobeStatic from 'ffprobe-static';
import sharp from 'sharp';

const execFileAsync = promisify(execFile);
const ffprobePath = typeof ffprobeStatic === 'string' ? ffprobeStatic : ffprobeStatic.path;

export const MAX_VIDEO_DURATION_SECONDS = 60;
export const MAX_VIDEO_SIZE_BYTES = 100 * 1024 * 1024;

export const getOrientation = (aspectRatio) => {
  if (aspectRatio < 0.95) return 'portrait';
  if (aspectRatio > 1.05) return 'landscape';
  return 'square';
};

const buildMetadata = (type, width, height) => {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error('Could not read media dimensions');
  }

  const aspectRatio = width / height;
  return { type, width, height, aspectRatio, orientation: getOrientation(aspectRatio) };
};

const readImageMetadata = async (buffer) => {
  const metadata = await sharp(buffer, { failOn: 'error' }).metadata();
  let { width, height } = metadata;

  // EXIF orientations 5–8 rotate the displayed image by 90 degrees.
  if (metadata.orientation >= 5 && metadata.orientation <= 8) {
    [width, height] = [height, width];
  }

  return buildMetadata('image', width, height);
};

const readVideoMetadata = async (file) => {
  if (!ffprobePath) throw new Error('Video metadata reader is unavailable');

  const tempDirectory = await mkdtemp(path.join(os.tmpdir(), 'oku-media-'));
  const tempFile = path.join(tempDirectory, 'upload');

  try {
    await writeFile(tempFile, file.buffer);
    const { stdout } = await execFileAsync(
      ffprobePath,
      [
        '-v', 'error',
        '-select_streams', 'v:0',
        '-show_entries', 'stream=width,height,duration:stream_tags=rotate:format=duration',
        '-of', 'json',
        tempFile,
      ],
      { maxBuffer: 1024 * 1024, timeout: 30000, windowsHide: true }
    );

    const stream = JSON.parse(stdout).streams?.[0];
    if (!stream) throw new Error('Uploaded video has no readable video stream');

    const sideDataRotation = stream.side_data_list?.find((item) => Number.isFinite(Number(item.rotation)))?.rotation;
    const rotation = Number(sideDataRotation ?? stream.tags?.rotate ?? 0);
    let { width, height } = stream;
    if (Math.round(Math.abs(rotation)) % 180 === 90) [width, height] = [height, width];

    const parsedOutput = JSON.parse(stdout);
    const streamDuration = Number(stream.duration);
    const formatDuration = Number(parsedOutput.format?.duration);
    const duration = Number.isFinite(streamDuration) && streamDuration > 0
      ? streamDuration
      : formatDuration;
    if (!Number.isFinite(duration) || duration <= 0) throw new Error('Uploaded video has no readable duration');
    if (duration > MAX_VIDEO_DURATION_SECONDS) throw new Error('Videos must be 60 seconds or shorter');

    return { ...buildMetadata('video', Number(width), Number(height)), duration };
  } finally {
    await rm(tempDirectory, { recursive: true, force: true });
  }
};

export const readMediaMetadata = async (file) => {
  const mimeType = file.detectedMime || file.mimetype;
  if (mimeType?.startsWith('image/')) return readImageMetadata(file.buffer);
  if (mimeType?.startsWith('video/')) return readVideoMetadata(file);
  throw new Error('Only image and video uploads are supported for posts');
};
