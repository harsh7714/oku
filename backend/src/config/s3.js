import { S3Client } from '@aws-sdk/client-s3';

let s3Client;

// Built lazily so process.env is populated by dotenv.config() (called in
// server.js) before we read AWS_* vars, regardless of module import order.
const getS3Client = () => {
  if (!s3Client) {
    s3Client = new S3Client({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });
  }
  return s3Client;
};

export default getS3Client;
