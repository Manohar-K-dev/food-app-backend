import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import axios from "axios";
import User from "../models/User.js";

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

    if (!name || !email || !password) {
      return res.status(400).json({ message: "All fields required" });
    }

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const currentServer = process.env.SERVER_NAME;
    const syncId = generateSyncId(currentServer);

    const newUser = await User.create({
      name,
      email,
      password: hashedPassword,
      syncId,
      serverOrigin: currentServer,
    });

    const token = jwt.sign(
      { id: newUser._id, email: newUser.email },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    // Sync to other server in background
    const otherServerUrl = process.env.OTHER_SERVER_URL;
    if (otherServerUrl) {
      setTimeout(async () => {
        try {
          await axios.post(`${otherServerUrl}/api/users/sync`, {
            name: newUser.name,
            email: newUser.email,
            password: newUser.password,
            syncId: newUser.syncId,
            serverOrigin: newUser.serverOrigin,
          });
        } catch (error) {
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
    res.status(500).json({ message: error.message });
  }
};

// Sync User
export const syncUser = async (req, res) => {
  try {
    const { name, email, password, syncId, serverOrigin } = req.body;

    // Check if user already exists by syncId
    const existingUser = await User.findOne({ syncId });
    if (existingUser) {
      return res.status(200).json({
        message: "User already synced",
      });
    }

    // Check if user exists by email
    const userByEmail = await User.findOne({ email });
    if (userByEmail) {
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

    res.status(201).json({
      message: "User synced successfully",
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Login User
export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "All fields required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    if (!isPasswordCorrect) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(200).json({
      message: "Login successful",
      user: { id: user._id, email: user.email, name: user.name },
      token,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get Profile
export const getUserProfile = async (req, res) => {
  try {
    const user = req.user;

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
    res.status(500).json({ message: error.message });
  }
};
