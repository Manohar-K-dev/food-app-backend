import express from "express";
import {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart,
  syncCart,
  syncCartUpdate,
  syncCartClear,
} from "../controllers/cartController.js";
import { verifyToken } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", verifyToken, getCart);
router.post("/add", verifyToken, addToCart);
router.put("/update/:productId", verifyToken, updateCartItem);
router.delete("/remove/:productId", verifyToken, removeFromCart);
router.delete("/clear", verifyToken, clearCart);

router.post("/sync", syncCart);
router.put("/sync/:syncId", syncCartUpdate);
router.post("/sync/clear", syncCartClear);

export default router;
