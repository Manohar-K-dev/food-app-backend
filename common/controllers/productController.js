import Product from "../models/Product.js";
import axios from "axios";
import { apiLogger } from "../utils/logger.js";
import {
  validateProduct,
  validateProductUpdate,
} from "../validators/productValidator.js";

// Generate unique sync ID for products
const generateSyncId = (serverName) => {
  return `${serverName}_product_${Date.now()}_${Math.random()
    .toString(36)
    .substr(2, 9)}`;
};

// Create Product
export const createProduct = async (req, res) => {
  const productData = req.body;
  const currentServer = process.env.SERVER_NAME || "unknown";

  try {
    apiLogger.product.create.start(
      productData.name || "Unknown",
      currentServer
    );

    // Validate product data
    const validation = validateProduct(productData);
    if (!validation.isValid) {
      apiLogger.product.create.validationFailed(
        validation.errors,
        currentServer
      );
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validation.errors,
      });
    }

    const syncId = generateSyncId(currentServer);

    const newProduct = await Product.create({
      ...productData,
      syncId,
      serverOrigin: currentServer,
    });

    apiLogger.product.create.success(
      newProduct._id,
      newProduct.name,
      currentServer
    );

    // Sync to other server
    const otherServerUrl = process.env.OTHER_SERVER_URL;
    if (otherServerUrl) {
      setTimeout(async () => {
        try {
          apiLogger.sync.sending(
            newProduct.name,
            currentServer,
            otherServerUrl
          );

          await axios.post(`${otherServerUrl}/api/products/sync`, {
            ...newProduct.toObject(),
            syncId: newProduct.syncId,
            serverOrigin: newProduct.serverOrigin,
            originalServerId: newProduct._id.toString(),
          });

          apiLogger.sync.success(newProduct.name, currentServer);
        } catch (error) {
          apiLogger.sync.failed(error, newProduct.name, currentServer);
        }
      }, 100);
    }

    res.status(201).json({
      success: true,
      message: "Product created successfully",
      data: newProduct,
    });
  } catch (error) {
    apiLogger.product.create.error(
      error,
      productData.name || "Unknown",
      currentServer
    );
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get All Products
export const getAllProducts = async (req, res) => {
  const currentServer = process.env.SERVER_NAME || "unknown";
  const {
    category,
    minPrice,
    maxPrice,
    available,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = req.query;

  try {
    apiLogger.info("Fetching all products", {
      currentServer,
      filters: req.query,
    });

    // Build filter
    const filter = {};

    if (category) filter.category = category;
    if (available !== undefined) filter.available = available === "true";
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = parseFloat(minPrice);
      if (maxPrice) filter.price.$lte = parseFloat(maxPrice);
    }

    // Build sort
    const sort = {};
    sort[sortBy] = sortOrder === "desc" ? -1 : 1;

    const products = await Product.find(filter).sort(sort).select("-__v");

    apiLogger.product.fetch.all(products.length, currentServer);

    res.status(200).json({
      success: true,
      message: "Products fetched successfully",
      count: products.length,
      data: products,
    });
  } catch (error) {
    apiLogger.product.fetch.error(error, currentServer);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get Single Product
export const getProductById = async (req, res) => {
  const { id } = req.params;
  const currentServer = process.env.SERVER_NAME || "unknown";

  try {
    apiLogger.product.fetch.single(id, currentServer);

    const product = await Product.findById(id).select("-__v");

    if (!product) {
      apiLogger.product.fetch.notFound(id, currentServer);
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    apiLogger.info("Product fetched successfully", {
      productId: id,
      name: product.name,
      currentServer,
    });

    res.status(200).json({
      success: true,
      message: "Product fetched successfully",
      data: product,
    });
  } catch (error) {
    apiLogger.error("Failed to fetch product", {
      error: error.message,
      productId: id,
      currentServer,
    });
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Update Product
export const updateProduct = async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;
  const currentServer = process.env.SERVER_NAME || "unknown";

  try {
    apiLogger.product.update.start(id, currentServer);

    // Validate update data
    const validation = validateProductUpdate(updateData);
    if (!validation.isValid) {
      apiLogger.warn("Product update validation failed", {
        errors: validation.errors,
        productId: id,
        currentServer,
      });
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validation.errors,
      });
    }

    const product = await Product.findById(id);

    if (!product) {
      apiLogger.warn("Product not found for update", {
        productId: id,
        currentServer,
      });
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Update product
    Object.keys(updateData).forEach((key) => {
      product[key] = updateData[key];
    });

    await product.save();

    apiLogger.product.update.success(id, product.name, currentServer);

    // Sync update to other server
    const otherServerUrl = process.env.OTHER_SERVER_URL;
    if (otherServerUrl && product.syncId) {
      setTimeout(async () => {
        try {
          await axios.put(
            `${otherServerUrl}/api/products/sync/${product.syncId}`,
            {
              updates: updateData,
            }
          );
          apiLogger.sync.success(`Update for ${product.name}`, currentServer);
        } catch (error) {
          apiLogger.sync.failed(
            error,
            `Update for ${product.name}`,
            currentServer
          );
        }
      }, 100);
    }

    res.status(200).json({
      success: true,
      message: "Product updated successfully",
      data: product,
    });
  } catch (error) {
    apiLogger.product.update.error(error, id, currentServer);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Delete Product
export const deleteProduct = async (req, res) => {
  const { id } = req.params;
  const currentServer = process.env.SERVER_NAME || "unknown";

  try {
    apiLogger.product.delete.start(id, currentServer);

    const product = await Product.findByIdAndDelete(id);

    if (!product) {
      apiLogger.warn("Product not found for deletion", {
        productId: id,
        currentServer,
      });
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    apiLogger.product.delete.success(id, product.name, currentServer);

    // Sync delete to other server
    const otherServerUrl = process.env.OTHER_SERVER_URL;
    if (otherServerUrl && product.syncId) {
      setTimeout(async () => {
        try {
          await axios.delete(
            `${otherServerUrl}/api/products/sync/${product.syncId}`
          );
          apiLogger.sync.success(`Delete for ${product.name}`, currentServer);
        } catch (error) {
          apiLogger.sync.failed(
            error,
            `Delete for ${product.name}`,
            currentServer
          );
        }
      }, 100);
    }

    res.status(200).json({
      success: true,
      message: "Product deleted successfully",
    });
  } catch (error) {
    apiLogger.product.delete.error(error, id, currentServer);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Sync Product (create/update from other server)
export const syncProduct = async (req, res) => {
  const productData = req.body;
  const currentServer = process.env.SERVER_NAME || "unknown";

  try {
    apiLogger.sync.received(
      productData.name || "Unknown product",
      productData.serverOrigin,
      currentServer
    );

    const { syncId, serverOrigin, originalServerId, ...productInfo } =
      productData;

    // Check if product exists by syncId
    const existingProduct = await Product.findOne({ syncId });
    if (existingProduct) {
      // Update existing product
      Object.keys(productInfo).forEach((key) => {
        if (productInfo[key] !== undefined) {
          existingProduct[key] = productInfo[key];
        }
      });

      await existingProduct.save();
      apiLogger.sync.duplicate(productData.name, syncId, currentServer);

      return res.status(200).json({
        success: true,
        message: "Product updated via sync",
        data: existingProduct,
      });
    }

    // Check if product exists by originalServerId (for updates)
    if (originalServerId) {
      const productByOriginalId = await Product.findOne({
        originalServerId,
        serverOrigin,
      });
      if (productByOriginalId) {
        productByOriginalId.syncId = syncId;
        Object.keys(productInfo).forEach((key) => {
          if (productInfo[key] !== undefined) {
            productByOriginalId[key] = productInfo[key];
          }
        });

        await productByOriginalId.save();
        apiLogger.info("Product updated with syncId", {
          name: productData.name,
          syncId,
          currentServer,
        });

        return res.status(200).json({
          success: true,
          message: "Product updated with syncId",
          data: productByOriginalId,
        });
      }
    }

    // Create new product from sync
    const newProduct = await Product.create({
      ...productInfo,
      syncId,
      serverOrigin,
      originalServerId,
    });

    apiLogger.sync.success(productData.name, currentServer);

    res.status(201).json({
      success: true,
      message: "Product synced successfully",
      data: newProduct,
    });
  } catch (error) {
    apiLogger.sync.failed(error, productData.name || "Unknown", currentServer);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Sync Product Update (from other server)
export const syncProductUpdate = async (req, res) => {
  const { syncId } = req.params;
  const { updates } = req.body;
  const currentServer = process.env.SERVER_NAME || "unknown";

  try {
    apiLogger.info("Sync update received", { syncId, updates, currentServer });

    const product = await Product.findOne({ syncId });

    if (!product) {
      apiLogger.warn("Product not found for sync update", {
        syncId,
        currentServer,
      });
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    Object.keys(updates).forEach((key) => {
      product[key] = updates[key];
    });

    await product.save();

    apiLogger.info("Product updated via sync", {
      syncId,
      name: product.name,
      currentServer,
    });

    res.status(200).json({
      success: true,
      message: "Product updated via sync",
      data: product,
    });
  } catch (error) {
    apiLogger.error("Sync update failed", {
      error: error.message,
      syncId,
      currentServer,
    });
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Sync Product Delete (from other server)
export const syncProductDelete = async (req, res) => {
  const { syncId } = req.params;
  const currentServer = process.env.SERVER_NAME || "unknown";

  try {
    apiLogger.info("Sync delete received", { syncId, currentServer });

    const product = await Product.findOneAndDelete({ syncId });

    if (!product) {
      apiLogger.warn("Product not found for sync delete", {
        syncId,
        currentServer,
      });
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    apiLogger.info("Product deleted via sync", {
      syncId,
      name: product.name,
      currentServer,
    });

    res.status(200).json({
      success: true,
      message: "Product deleted via sync",
    });
  } catch (error) {
    apiLogger.error("Sync delete failed", {
      error: error.message,
      syncId,
      currentServer,
    });
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get Products by Category
export const getProductsByCategory = async (req, res) => {
  const { category } = req.params;
  const currentServer = process.env.SERVER_NAME || "unknown";

  try {
    apiLogger.info("Fetching products by category", {
      category,
      currentServer,
    });

    const validCategories = [
      "VEG",
      "NON_VEG",
      "TIFFIN",
      "MEALS",
      "FAST_FOOD",
      "JUICE",
      "SWEETS",
    ];
    if (!validCategories.includes(category)) {
      apiLogger.warn("Invalid category requested", { category, currentServer });
      return res.status(400).json({
        success: false,
        message: `Invalid category. Must be one of: ${validCategories.join(
          ", "
        )}`,
      });
    }

    const products = await Product.find({
      category,
      available: true,
    })
      .sort({ createdAt: -1 })
      .select("-__v");

    apiLogger.product.fetch.category(category, products.length, currentServer);

    res.status(200).json({
      success: true,
      message: `Products in ${category} category`,
      count: products.length,
      data: products,
    });
  } catch (error) {
    apiLogger.error("Failed to fetch category products", {
      error: error.message,
      category,
      currentServer,
    });
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Search Products by Name
export const searchProducts = async (req, res) => {
  const { query } = req.query;
  const currentServer = process.env.SERVER_NAME || "unknown";

  try {
    apiLogger.info("Searching products", { query, currentServer });

    if (!query || query.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "Search query is required",
      });
    }

    const products = await Product.find({
      $or: [
        { name: { $regex: query, $options: "i" } },
        { description: { $regex: query, $options: "i" } },
      ],
      available: true,
    })
      .sort({ createdAt: -1 })
      .select("-__v");

    apiLogger.info("Products search completed", {
      query,
      count: products.length,
      currentServer,
    });

    res.status(200).json({
      success: true,
      message: `Search results for "${query}"`,
      count: products.length,
      data: products,
    });
  } catch (error) {
    apiLogger.error("Product search failed", {
      error: error.message,
      query,
      currentServer,
    });
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
