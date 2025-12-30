import express from "express";
import {
  registerUser,
  loginUser,
  syncUser,
  getUserProfile,
} from "../controllers/userController.js";
import { verifyToken } from "../middleware/authMiddleware.js";

const userRoutes = express.Router();

// post
userRoutes.post("/register", registerUser);
userRoutes.post("/login", loginUser);
// (sync route)
userRoutes.post("/sync", syncUser);

// get
userRoutes.get("/profile", verifyToken, getUserProfile);

export default userRoutes;
