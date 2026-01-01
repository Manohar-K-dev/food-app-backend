import express from "express";
import {
  createOrder,
  getUserOrders,
  getOrderById,
  updateOrderStatus,
  getOrderByNumber,
  getOrderSummary,
  trackOrder,
  syncOrder,
  syncOrderUpdate,
} from "../controllers/orderController.js";
import { verifyToken } from "../middleware/authMiddleware.js";

const router = express.Router();

// User order routes
router.post("/create", verifyToken, createOrder);
router.get("/my-orders", verifyToken, getUserOrders);
router.get("/summary", verifyToken, getOrderSummary);
router.get("/:orderId", verifyToken, getOrderById);
router.get("/number/:orderNumber", verifyToken, getOrderByNumber);
router.get("/:orderId/track", verifyToken, trackOrder);
router.put("/:orderId/status", verifyToken, updateOrderStatus);

// Sync routes
router.post("/sync", syncOrder);
router.put("/sync/:syncId", syncOrderUpdate);

export default router;
