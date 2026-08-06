import mongoose from 'mongoose';

const connectDB = async () => {
  try {
    let uri = process.env.MONGO_URI;

    // Local dev convenience: spin up a real in-memory MongoDB binary instead
    // of requiring a system-installed or hosted MongoDB. Data does not persist
    // across restarts. Set USE_MEMORY_DB=false once a real MONGO_URI is available.
    if (process.env.USE_MEMORY_DB === 'true') {
      const { MongoMemoryServer } = await import('mongodb-memory-server');
      const memoryServer = await MongoMemoryServer.create();
      uri = memoryServer.getUri();
      console.log('Using in-memory MongoDB for local development');
    }

    const conn = await mongoose.connect(uri);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Database Connection Error: ${error.message}`);
    process.exit(1);
  }
};

export default connectDB;
