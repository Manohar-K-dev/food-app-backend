import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { apiLogger } from "../utils/logger.js";

// Verify JWT token
export const verifyToken = async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  const currentServer = process.env.SERVER_NAME || "unknown";

  try {
    // Check if token exists
    if (!token) {
      apiLogger.profile.unauthorized(req.ip, req.originalUrl);
      return res.status(401).json({
        success: false,
        message: "No token provided",
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!decoded.email) {
      apiLogger.warn("Token missing email", { currentServer });
      return res.status(401).json({
        success: false,
        message: "Invalid token format",
      });
    }

    // Find user by email ONLY
    const user = await User.findOne({ email: decoded.email });

    // User not found
    if (!user) {
      apiLogger.warn("User not found by email", {
        email: decoded.email,
        currentServer,
      });

      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    // Attach user to request
    req.user = user;

    apiLogger.info("Token verification successful", {
      userId: user._id,
      email: user.email,
      currentServer,
    });

    next();
  } catch (error) {
    // Handle specific JWT errors
    if (error.name === "TokenExpiredError") {
      apiLogger.warn("Token expired", {
        ip: req.ip,
        endpoint: req.originalUrl,
      });

      return res.status(401).json({
        success: false,
        message: "Token expired",
      });
    }

    if (error.name === "JsonWebTokenError") {
      apiLogger.warn("Invalid token", {
        ip: req.ip,
        endpoint: req.originalUrl,
      });

      return res.status(401).json({
        success: false,
        message: "Invalid token",
      });
    }

    // Handle other errors
    apiLogger.error("Token verification error", {
      error: error.message,
      ip: req.ip,
      endpoint: req.originalUrl,
    });

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};
