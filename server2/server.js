import dotenv from "dotenv";
dotenv.config({ path: ".env.server2" });

import express from "express";
import connectDB from "./config/dbConfig.js";
import userRoutes from "../common/routes/userRoutes.js";
import productRoutes from "../common/routes/productRoutes.js";
import cartRoutes from "../common/routes/cartRoutes.js";
import orderRoutes from "../common/routes/orderRoutes.js";
import { requestLogger, apiLogger } from "../common/utils/logger.js";

const app = express();
app.use(express.json());
app.use(requestLogger);

const PORT = process.env.PORT;

// Database
connectDB();

// Routes
app.use("/api/users", userRoutes);
app.use("/api/products", productRoutes);
app.use("/api/carts", cartRoutes);
app.use("/api/orders", orderRoutes);

app.get("/", (req, res) => {
  res.send("Server 2 running");
});

app.listen(PORT, () => {
  apiLogger.server.started(PORT, process.env.SERVER_NAME);
  console.log(`Server 2 running on ${PORT}`);
  console.log("SERVER_NAME:", process.env.SERVER_NAME);
  console.log("OTHER_SERVER_URL:", process.env.OTHER_SERVER_URL);
});
