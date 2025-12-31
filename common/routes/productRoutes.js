import express from "express";
import {
  createProduct,
  getAllProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  syncProduct,
  syncProductUpdate,
  syncProductDelete,
  getProductsByCategory,
  searchProducts,
} from "../controllers/productController.js";
import { verifyToken } from "../middleware/authMiddleware.js";

const router = express.Router();

// Public routes
router.get("/", getAllProducts);
router.get("/search", searchProducts);
router.get("/category/:category", getProductsByCategory);
router.get("/:id", getProductById);

// Protected routes (Admin only - add admin check if needed)
router.post("/", verifyToken, createProduct);
router.put("/:id", verifyToken, updateProduct);
router.delete("/:id", verifyToken, deleteProduct);

// Sync routes (server-to-server)
router.post("/sync", syncProduct);
router.put("/sync/:syncId", syncProductUpdate);
router.delete("/sync/:syncId", syncProductDelete);

export default router;
