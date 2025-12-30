import dotenv from "dotenv";
dotenv.config({ path: ".env.server2" });

import express from "express";
import connectDB from "./config/dbConfig.js";
import userRoutes from "../common/routes/userRoutes.js";

const app = express();
app.use(express.json());

const PORT = process.env.PORT;

// Database
connectDB();

// Routes
app.use("/api/users", userRoutes);

app.get("/", (req, res) => {
  res.send("Server 2 running");
});

app.listen(PORT, () => {
  console.log(`Server 2 running on ${PORT}`);
  console.log("SERVER_NAME:", process.env.SERVER_NAME);
  console.log("OTHER_SERVER_URL:", process.env.OTHER_SERVER_URL);
});
