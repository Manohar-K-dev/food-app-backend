import mongoose from "mongoose";

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("MongoDB Connected:", process.env.SERVER_NAME);
  } catch (err) {
    console.error("MongoDB error", err);
    process.exit(1);
  }
};

export default connectDB;
