import mongoose from 'mongoose';

const postMediaSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    type: { type: String, enum: ['image', 'video'], required: true },
    width: { type: Number, min: 1 },
    height: { type: Number, min: 1 },
    aspectRatio: { type: Number, min: 0 },
    orientation: { type: String, enum: ['portrait', 'landscape', 'square'] },
  },
  { _id: false }
);

const postSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Post must belong to a user'],
    },
    content: {
      type: String,
      trim: true,
      maxlength: [2000, 'Post content cannot exceed 2000 characters'],
    },
    media: { type: postMediaSchema, default: null },
    mediaType: {
      type: String,
      enum: ['image', 'video', 'none'],
      default: 'none',
    },
    likes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    commentsCount: {
      type: Number,
      default: 0,
    },
    hashtags: [
      {
        type: String,
        index: true,
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Convert legacy string URLs while hydrating old documents. The metadata is
// intentionally left empty so the client can derive the ratio from the
// loaded image/video until the one-time migration is run.
postSchema.pre('init', function preserveLegacyMedia(rawPost) {
  if (typeof rawPost.media === 'string' && rawPost.media) {
    rawPost.media = {
      url: rawPost.media,
      type: rawPost.mediaType === 'video' ? 'video' : 'image',
    };
  }
});

const Post = mongoose.model('Post', postSchema);
export default Post;
