import 'dotenv/config';
import mongoose from 'mongoose';

const uri = process.env.MONGO_URI;
if (!uri) throw new Error('Set MONGO_URI before running the post media migration');

try {
  await mongoose.connect(uri);
  const posts = mongoose.connection.collection('posts');
  let migrated = 0;

  const cursor = posts.find({ media: { $type: 'string', $ne: '' } });
  for await (const post of cursor) {
    const type = post.mediaType === 'video' ? 'video' : 'image';
    const result = await posts.updateOne(
      { _id: post._id, media: post.media },
      { $set: { media: { url: post.media, type } } }
    );
    migrated += result.modifiedCount;
  }

  console.log(`Migrated ${migrated} post media record(s). New metadata will be added on future uploads.`);
} finally {
  await mongoose.disconnect();
}
