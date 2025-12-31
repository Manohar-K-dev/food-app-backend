import Cart from "../models/Cart.js";
import Product from "../models/Product.js";
import axios from "axios";
import { apiLogger } from "../utils/logger.js";

// Generate unique sync ID for cart
const generateSyncId = (serverName, userId) => {
  return `${serverName}_cart_${userId}_${Date.now()}`;
};

// Get user's cart
export const getCart = async (req, res) => {
  const user = req.user;
  const currentServer = process.env.SERVER_NAME || "unknown";

  try {
    apiLogger.cart.get.start(user._id, currentServer);

    const cart = await Cart.findOne({ user: user._id })
      .populate("items.product", "name price category available")
      .select("-__v");

    if (!cart) {
      // Create empty cart if doesn't exist
      const newCart = await Cart.create({
        user: user._id,
        items: [],
        syncId: generateSyncId(currentServer, user._id),
        serverOrigin: currentServer,
      });

      apiLogger.cart.get.empty(user._id, currentServer);

      return res.status(200).json({
        success: true,
        message: "Cart fetched successfully",
        data: newCart,
      });
    }

    apiLogger.cart.get.success(user._id, cart.items.length, currentServer);

    res.status(200).json({
      success: true,
      message: "Cart fetched successfully",
      data: cart,
    });
  } catch (error) {
    apiLogger.cart.get.error(error, user._id, currentServer);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Add item to cart
export const addToCart = async (req, res) => {
  const user = req.user;
  const { productId, quantity = 1 } = req.body;
  const currentServer = process.env.SERVER_NAME || "unknown";

  try {
    apiLogger.cart.add.start(user._id, productId, quantity, currentServer);
    // Validate input
    if (!productId) {
      apiLogger.warn("Missing productId in cart add", {
        userId: user._id,
        currentServer,
      });
      return res.status(400).json({
        success: false,
        message: "Product ID is required",
      });
    }

    if (quantity < 1) {
      apiLogger.warn("Invalid quantity in cart add", {
        userId: user._id,
        quantity,
        currentServer,
      });
      return res.status(400).json({
        success: false,
        message: "Quantity must be at least 1",
      });
    }

    // Check if product exists and is available
    const product = await Product.findById(productId);

    if (!product) {
      apiLogger.cart.add.productNotFound(productId, currentServer);
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    if (!product.available) {
      apiLogger.cart.add.productUnavailable(productId, currentServer);
      return res.status(400).json({
        success: false,
        message: "Product is not available",
      });
    }

    // Find or create cart
    let cart = await Cart.findOne({ user: user._id });

    if (!cart) {
      cart = await Cart.create({
        user: user._id,
        items: [],
        syncId: generateSyncId(currentServer, user._id),
        serverOrigin: currentServer,
      });
      apiLogger.info("New cart created for user", {
        userId: user._id,
        currentServer,
      });
    }

    // Check if product already in cart
    const existingItemIndex = cart.items.findIndex(
      (item) => item.product.toString() === productId
    );

    if (existingItemIndex > -1) {
      // Update quantity if already exists
      cart.items[existingItemIndex].quantity += quantity;
      cart.items[existingItemIndex].price = product.price;
      cart.items[existingItemIndex].total =
        cart.items[existingItemIndex].quantity * product.price;
      apiLogger.info("Product quantity updated in cart", {
        userId: user._id,
        productId,
        newQuantity: cart.items[existingItemIndex].quantity,
        currentServer,
      });
    } else {
      // Add new item
      cart.items.push({
        product: productId,
        quantity,
        price: product.price,
        total: quantity * product.price,
      });
      apiLogger.info("New product added to cart", {
        userId: user._id,
        productId,
        quantity,
        currentServer,
      });
    }

    await cart.save();

    // Populate product details for response
    await cart.populate("items.product", "name price category");

    apiLogger.cart.add.success(user._id, productId, quantity, currentServer);
    apiLogger.info("Cart saved successfully", {
      userId: user._id,
      itemsCount: cart.items.length,
      subTotal: cart.subTotal,
      currentServer,
    });

    // Sync to other server
    const otherServerUrl = process.env.OTHER_SERVER_URL;
    if (otherServerUrl && cart.syncId) {
      setTimeout(async () => {
        try {
          apiLogger.info("Starting cart sync to other server", {
            userId: user._id,
            otherServerUrl,
            currentServer,
          });

          await axios.post(`${otherServerUrl}/api/carts/sync`, {
            cartData: cart.toObject(),
            syncId: cart.syncId,
            serverOrigin: cart.serverOrigin,
            userId: user._id.toString(),
          });

          apiLogger.sync.success(
            `Cart update for user ${user._id}`,
            currentServer
          );
          apiLogger.info("Cart sync completed successfully", {
            userId: user._id,
            currentServer,
          });
        } catch (error) {
          apiLogger.sync.failed(
            error,
            `Cart update for user ${user._id}`,
            currentServer
          );
          apiLogger.error("Cart sync failed", {
            error: error.message,
            userId: user._id,
            currentServer,
          });
        }
      }, 100);
    } else {
      apiLogger.info("Cart sync skipped - no other server URL or syncId", {
        userId: user._id,
        currentServer,
      });
    }

    res.status(200).json({
      success: true,
      message: "Item added to cart",
      data: cart,
    });
  } catch (error) {
    apiLogger.cart.add.error(error, user._id, currentServer);
    apiLogger.error("Cart operation failed", {
      error: error.message,
      userId: user._id,
      productId,
      currentServer,
    });
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Update cart item quantity
export const updateCartItem = async (req, res) => {
  const user = req.user;
  const { productId } = req.params;
  const { quantity } = req.body;
  const currentServer = process.env.SERVER_NAME || "unknown";

  try {
    apiLogger.cart.update.start(user._id, productId, quantity, currentServer);

    // Validate quantity
    if (!quantity || quantity < 1) {
      apiLogger.warn("Invalid quantity in cart update", {
        userId: user._id,
        quantity,
        currentServer,
      });
      return res.status(400).json({
        success: false,
        message: "Quantity must be at least 1",
      });
    }

    if (quantity > 100) {
      apiLogger.warn("Quantity exceeds limit in cart update", {
        userId: user._id,
        quantity,
        currentServer,
      });
      return res.status(400).json({
        success: false,
        message: "Quantity cannot exceed 100",
      });
    }

    // Find cart
    const cart = await Cart.findOne({ user: user._id });

    if (!cart) {
      apiLogger.cart.update.cartNotFound(user._id, currentServer);
      return res.status(404).json({
        success: false,
        message: "Cart not found",
      });
    }

    // Find item in cart
    const itemIndex = cart.items.findIndex(
      (item) => item.product.toString() === productId
    );

    if (itemIndex === -1) {
      apiLogger.cart.update.itemNotFound(user._id, productId, currentServer);
      return res.status(404).json({
        success: false,
        message: "Item not found in cart",
      });
    }

    // Get current product price
    const product = await Product.findById(productId);
    if (!product) {
      apiLogger.warn("Product not found for cart update", {
        productId,
        currentServer,
      });
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Update item
    cart.items[itemIndex].quantity = quantity;
    cart.items[itemIndex].price = product.price;
    cart.items[itemIndex].total = quantity * product.price;

    await cart.save();

    // Populate product details
    await cart.populate("items.product", "name price category");

    apiLogger.cart.update.success(user._id, productId, quantity, currentServer);
    apiLogger.info("Cart item quantity updated", {
      userId: user._id,
      productId,
      oldQuantity: cart.items[itemIndex].quantity,
      newQuantity: quantity,
      currentServer,
    });

    // Sync to other server
    const otherServerUrl = process.env.OTHER_SERVER_URL;
    if (otherServerUrl && cart.syncId) {
      setTimeout(async () => {
        try {
          await axios.put(`${otherServerUrl}/api/carts/sync/${cart.syncId}`, {
            productId,
            quantity,
            action: "update",
          });
          apiLogger.sync.success(
            `Cart update for user ${user._id}`,
            currentServer
          );
        } catch (error) {
          apiLogger.sync.failed(
            error,
            `Cart update for user ${user._id}`,
            currentServer
          );
        }
      }, 100);
    }

    res.status(200).json({
      success: true,
      message: "Cart item updated",
      data: cart,
    });
  } catch (error) {
    apiLogger.cart.update.error(error, user._id, currentServer);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Remove item from cart
export const removeFromCart = async (req, res) => {
  const user = req.user;
  const { productId } = req.params;
  const currentServer = process.env.SERVER_NAME || "unknown";

  try {
    apiLogger.cart.remove.start(user._id, productId, currentServer);

    // Find cart
    const cart = await Cart.findOne({ user: user._id });

    if (!cart) {
      apiLogger.cart.remove.cartNotFound(user._id, currentServer);
      return res.status(404).json({
        success: false,
        message: "Cart not found",
      });
    }

    // Find item index
    const itemIndex = cart.items.findIndex(
      (item) => item.product.toString() === productId
    );

    if (itemIndex === -1) {
      apiLogger.cart.remove.itemNotFound(user._id, productId, currentServer);
      return res.status(404).json({
        success: false,
        message: "Item not found in cart",
      });
    }

    // Get product name before removing (for logging)
    const product = await Product.findById(productId);
    const productName = product ? product.name : "Unknown";

    // Remove item
    cart.items.splice(itemIndex, 1);

    await cart.save();

    // Populate product details
    await cart.populate("items.product", "name price category");

    apiLogger.cart.remove.success(user._id, productId, currentServer);
    apiLogger.info("Product removed from cart", {
      userId: user._id,
      productId,
      productName,
      currentServer,
    });

    // Sync to other server
    const otherServerUrl = process.env.OTHER_SERVER_URL;
    if (otherServerUrl && cart.syncId) {
      setTimeout(async () => {
        try {
          await axios.delete(
            `${otherServerUrl}/api/carts/sync/${cart.syncId}`,
            {
              data: { productId },
            }
          );
          apiLogger.sync.success(
            `Cart item removed for user ${user._id}`,
            currentServer
          );
        } catch (error) {
          apiLogger.sync.failed(
            error,
            `Cart item removed for user ${user._id}`,
            currentServer
          );
        }
      }, 100);
    }

    res.status(200).json({
      success: true,
      message: "Item removed from cart",
      data: cart,
    });
  } catch (error) {
    apiLogger.cart.remove.error(error, user._id, currentServer);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Clear entire cart
export const clearCart = async (req, res) => {
  const user = req.user;
  const currentServer = process.env.SERVER_NAME || "unknown";

  try {
    apiLogger.cart.clear.start(user._id, currentServer);

    const cart = await Cart.findOne({ user: user._id });

    if (!cart) {
      apiLogger.cart.clear.cartNotFound(user._id, currentServer);
      return res.status(404).json({
        success: false,
        message: "Cart not found",
      });
    }

    // Store cart info before clearing
    const itemsCount = cart.items.length;
    const subTotal = cart.subTotal;

    // Clear all items
    cart.items = [];

    await cart.save();

    apiLogger.cart.clear.success(user._id, currentServer);
    apiLogger.info("Cart cleared completely", {
      userId: user._id,
      itemsRemoved: itemsCount,
      previousSubTotal: subTotal,
      currentServer,
    });

    // Sync to other server
    const otherServerUrl = process.env.OTHER_SERVER_URL;
    if (otherServerUrl && cart.syncId) {
      setTimeout(async () => {
        try {
          await axios.post(`${otherServerUrl}/api/carts/sync/clear`, {
            syncId: cart.syncId,
          });
          apiLogger.sync.success(
            `Cart cleared for user ${user._id}`,
            currentServer
          );
        } catch (error) {
          apiLogger.sync.failed(
            error,
            `Cart cleared for user ${user._id}`,
            currentServer
          );
        }
      }, 100);
    }

    res.status(200).json({
      success: true,
      message: "Cart cleared successfully",
      data: cart,
    });
  } catch (error) {
    apiLogger.cart.clear.error(error, user._id, currentServer);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Sync Cart (from other server)
export const syncCart = async (req, res) => {
  const { cartData, syncId, serverOrigin, userId } = req.body;
  const currentServer = process.env.SERVER_NAME || "unknown";

  try {
    apiLogger.sync.received(
      `Cart for user ${userId}`,
      serverOrigin,
      currentServer
    );

    apiLogger.info("Cart sync request received", {
      userId,
      syncId,
      serverOrigin,
      itemsCount: cartData.items?.length || 0,
      currentServer,
    });

    // Check if cart exists by syncId
    const existingCart = await Cart.findOne({ syncId });
    if (existingCart) {
      // Update existing cart
      const previousItemsCount = existingCart.items.length;
      existingCart.items = cartData.items || [];
      existingCart.subTotal = cartData.subTotal || 0;
      existingCart.totalItems = cartData.totalItems || 0;

      await existingCart.save();
      await existingCart.populate("items.product", "name price category");

      apiLogger.sync.duplicate(
        `Cart for user ${userId}`,
        syncId,
        currentServer
      );
      apiLogger.info("Cart updated via sync", {
        userId,
        syncId,
        previousItemsCount,
        newItemsCount: existingCart.items.length,
        currentServer,
      });

      return res.status(200).json({
        success: true,
        message: "Cart updated via sync",
        data: existingCart,
      });
    }

    // Create new cart from sync
    const newCart = await Cart.create({
      user: userId,
      items: cartData.items || [],
      subTotal: cartData.subTotal || 0,
      totalItems: cartData.totalItems || 0,
      syncId,
      serverOrigin,
    });

    await newCart.populate("items.product", "name price category");

    apiLogger.sync.success(`Cart for user ${userId}`, currentServer);
    apiLogger.info("New cart created via sync", {
      userId,
      syncId,
      itemsCount: newCart.items.length,
      serverOrigin,
      currentServer,
    });

    res.status(201).json({
      success: true,
      message: "Cart synced successfully",
      data: newCart,
    });
  } catch (error) {
    apiLogger.sync.failed(error, `Cart for user ${userId}`, currentServer);
    apiLogger.error("Cart sync operation failed", {
      error: error.message,
      userId,
      syncId,
      currentServer,
    });
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Sync Cart Update (from other server)
export const syncCartUpdate = async (req, res) => {
  const { syncId } = req.params;
  const { productId, quantity, action } = req.body;
  const currentServer = process.env.SERVER_NAME || "unknown";

  try {
    apiLogger.info("Cart sync update received", {
      syncId,
      productId,
      action,
      currentServer,
    });

    const cart = await Cart.findOne({ syncId });

    if (!cart) {
      apiLogger.warn("Cart not found for sync update", {
        syncId,
        currentServer,
      });
      return res.status(404).json({
        success: false,
        message: "Cart not found",
      });
    }

    if (action === "update") {
      // Update item quantity
      const itemIndex = cart.items.findIndex(
        (item) => item.product.toString() === productId
      );

      if (itemIndex > -1) {
        const product = await Product.findById(productId);
        if (product) {
          const oldQuantity = cart.items[itemIndex].quantity;
          cart.items[itemIndex].quantity = quantity;
          cart.items[itemIndex].price = product.price;
          cart.items[itemIndex].total = quantity * product.price;

          apiLogger.info("Cart item updated via sync", {
            syncId,
            productId,
            oldQuantity,
            newQuantity: quantity,
            currentServer,
          });
        }
      }
    } else if (action === "remove") {
      // Remove item
      const itemIndex = cart.items.findIndex(
        (item) => item.product.toString() === productId
      );

      if (itemIndex > -1) {
        cart.items.splice(itemIndex, 1);
        apiLogger.info("Cart item removed via sync", {
          syncId,
          productId,
          currentServer,
        });
      }
    }

    await cart.save();
    await cart.populate("items.product", "name price category");

    apiLogger.info("Cart updated via sync", { syncId, currentServer });

    res.status(200).json({
      success: true,
      message: "Cart updated via sync",
      data: cart,
    });
  } catch (error) {
    apiLogger.error("Cart sync update failed", {
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

// Sync Cart Clear (from other server)
export const syncCartClear = async (req, res) => {
  const { syncId } = req.body;
  const currentServer = process.env.SERVER_NAME || "unknown";

  try {
    apiLogger.info("Cart sync clear received", { syncId, currentServer });

    const cart = await Cart.findOne({ syncId });

    if (!cart) {
      apiLogger.warn("Cart not found for sync clear", {
        syncId,
        currentServer,
      });
      return res.status(404).json({
        success: false,
        message: "Cart not found",
      });
    }

    // Store info before clearing
    const itemsCount = cart.items.length;
    const subTotal = cart.subTotal;

    // Clear cart
    cart.items = [];
    await cart.save();

    apiLogger.info("Cart cleared via sync", {
      syncId,
      itemsCleared: itemsCount,
      previousSubTotal: subTotal,
      currentServer,
    });

    res.status(200).json({
      success: true,
      message: "Cart cleared via sync",
    });
  } catch (error) {
    apiLogger.error("Cart sync clear failed", {
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
