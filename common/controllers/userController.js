import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import axios from "axios";
import validator from "validator";
import User from "../models/User.js";
import { apiLogger } from "../utils/logger.js";

// Generate unique sync ID
const generateSyncId = (serverName) => {
  return `${serverName}_${Date.now()}_${Math.random()
    .toString(36)
    .substr(2, 9)}`;
};

// Register User
export const registerUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const currentServer = process.env.SERVER_NAME || "unknown";

    apiLogger.register.start(email, currentServer);

    if (!name || !email || !password) {
      apiLogger.register.validationFailed(
        { name, email, password },
        currentServer
      );

      return res.status(400).json({ message: "All fields required" });
    }

    const userExists = await User.findOne({ email });
    if (userExists) {
      apiLogger.register.userExists(email, currentServer);

      return res.status(400).json({ message: "User already exists" });
    }

    // Validate: email format
    if (!validator.isEmail(email)) {
      apiLogger.warn("Invalid email format", { email, currentServer });

      return res.status(400).json({
        success: false,
        message: "Please enter a valid email address",
      });
    }

    // Validate: password strength
    if (!validator.isStrongPassword(password)) {
      apiLogger.warn("Weak password", { email, currentServer });

      return res.status(400).json({
        success: false,
        message:
          "Password must be at least 8 characters long and include Lower, uppercase, number and symbol",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const syncId = generateSyncId(currentServer);

    const newUser = await User.create({
      name,
      email,
      password: hashedPassword,
      syncId,
      serverOrigin: currentServer,
    });

    const token = jwt.sign({ email: newUser.email }, process.env.JWT_SECRET, {
      expiresIn: "1d",
    });

    apiLogger.register.success(newUser._id, email, currentServer);

    // Sync to other server in background
    const otherServerUrl = process.env.OTHER_SERVER_URL;
    if (otherServerUrl) {
      setTimeout(async () => {
        try {
          apiLogger.sync.sending(email, currentServer, otherServerUrl);

          await axios.post(`${otherServerUrl}/api/users/sync`, {
            name: newUser.name,
            email: newUser.email,
            password: newUser.password,
            syncId: newUser.syncId,
            serverOrigin: newUser.serverOrigin,
          });

          apiLogger.sync.success(email, currentServer);
        } catch (error) {
          apiLogger.sync.failed(error, email, currentServer);

          console.log("Sync failed:", error.message);
        }
      }, 100);
    }

    res.status(201).json({
      message: "User registered",
      user: { id: newUser._id, email: newUser.email, name: newUser.name },
      token,
    });
  } catch (error) {
    apiLogger.register.error(error, email, currentServer);

    res.status(500).json({ message: error.message });
  }
};

// Sync User
export const syncUser = async (req, res) => {
  try {
    const { name, email, password, syncId, serverOrigin } = req.body;
    const currentServer = process.env.SERVER_NAME || "unknown";

    apiLogger.sync.received(email, serverOrigin, currentServer);

    // Check if user already exists by syncId
    const existingUser = await User.findOne({ syncId });
    if (existingUser) {
      apiLogger.sync.duplicate(email, syncId, currentServer);

      return res.status(200).json({
        message: "User already synced",
      });
    }

    // Check if user exists by email
    const userByEmail = await User.findOne({ email });
    if (userByEmail) {
      apiLogger.info("User exists, updating syncId", {
        email,
        syncId,
        currentServer,
      });

      userByEmail.syncId = syncId;
      userByEmail.serverOrigin = serverOrigin;
      await userByEmail.save();

      return res.status(200).json({
        message: "User updated with syncId",
      });
    }

    // Create new synced user
    await User.create({
      name,
      email,
      password,
      syncId,
      serverOrigin,
    });

    apiLogger.sync.success(email, currentServer);

    res.status(201).json({
      message: "User synced successfully",
    });
  } catch (error) {
    apiLogger.sync.failed(error, email, currentServer);

    res.status(500).json({ message: error.message });
  }
};

// Login User
export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    const currentServer = process.env.SERVER_NAME || "unknown";

    apiLogger.login.start(email, currentServer);

    if (!email || !password) {
      apiLogger.login.invalidCredentials(email, currentServer);

      return res.status(400).json({ message: "All fields required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      apiLogger.login.userNotFound(email, currentServer);

      return res.status(400).json({ message: "Invalid credentials" });
    }

    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    if (!isPasswordCorrect) {
      apiLogger.login.invalidCredentials(email, currentServer);

      return res.status(400).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign({ email: user.email }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    apiLogger.login.success(user._id, email, currentServer);

    res.status(200).json({
      message: "Login successful",
      user: { id: user._id, email: user.email, name: user.name },
      token,
    });
  } catch (error) {
    apiLogger.login.error(error, email, currentServer);

    res.status(500).json({ message: error.message });
  }
};

// Get Profile
export const getUserProfile = async (req, res) => {
  try {
    const user = req.user;
    const currentServer = process.env.SERVER_NAME || "unknown";

    apiLogger.profile.accessed(user._id, currentServer);

    res.status(200).json({
      message: "Profile retrieved",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        serverOrigin: user.serverOrigin,
      },
    });
  } catch (error) {
    apiLogger.error("Profile access error", {
      error: error.message,
      userId: user._id,
      currentServer,
    });

    res.status(500).json({ message: error.message });
  }
};
