import mongoose from "mongoose";
import { apiLogger } from "../../common/utils/logger.js";

const connectDB = async () => {
  const serverName = process.env.SERVER_NAME || "server2";

  try {
    await mongoose.connect(process.env.MONGODB_URI);

    apiLogger.server.dbConnected(serverName);

    console.log("MongoDB Connected:", process.env.SERVER_NAME);
  } catch (err) {
    apiLogger.server.dbError(err, serverName);

    console.error("MongoDB error", err);
    process.exit(1);
  }
};

export default connectDB;
