import crypto from 'crypto';
import path from 'path';
import { PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import getS3Client from '../config/s3.js';

// @desc  Upload a multer memory-storage file to S3 and return its public URL
export const uploadFileToS3 = async (file, folder = 'uploads') => {
  const bucket = process.env.AWS_S3_BUCKET_NAME;
  const region = process.env.AWS_REGION;
  const key = `${folder}/${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`;

  await getS3Client().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    })
  );

  return { key, url: `https://${bucket}.s3.${region}.amazonaws.com/${key}` };
};

// @desc  Delete a file from S3 given its public URL. No-ops on URLs that
//        aren't from our bucket (e.g. legacy local /uploads/ paths).
export const deleteFileFromS3 = async (fileUrl) => {
  const key = extractKeyFromUrl(fileUrl);
  if (!key) return;

  try {
    await getS3Client().send(
      new DeleteObjectCommand({ Bucket: process.env.AWS_S3_BUCKET_NAME, Key: key })
    );
  } catch (error) {
    console.error('deleteFileFromS3 Error:', error);
  }
};

const extractKeyFromUrl = (fileUrl) => {
  if (!fileUrl) return null;
  const marker = '.amazonaws.com/';
  const idx = fileUrl.indexOf(marker);
  if (idx === -1) return null;
  return decodeURIComponent(fileUrl.slice(idx + marker.length));
};
