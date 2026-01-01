import Order from "../models/Order.js";
import Cart from "../models/Cart.js";
import User from "../models/User.js";
import axios from "axios";
import { apiLogger } from "../utils/logger.js";
import {
  validateCreateOrder,
  validateUpdateStatus,
  validatePagination,
  validateSyncOrder,
} from "../validators/orderValidator.js";

// Generate unique sync ID
const generateSyncId = (serverName) => {
  return `${serverName}_order_${Date.now()}_${Math.random()
    .toString(36)
    .substr(2, 9)}`;
};

// Create Order from Cart
export const createOrder = async (req, res) => {
  const user = req.user;
  const { shippingAddress, paymentMethod, instructions, estimatedDelivery } =
    req.body;
  const currentServer = process.env.SERVER_NAME || "unknown";

  try {
    apiLogger.order.create.start(user._id, currentServer);

    // Validate request body
    const validation = validateCreateOrder(req.body);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validation.errors,
      });
    }

    // Find local user by email
    const localUser = await User.findOne({ email: user.email });
    if (!localUser) {
      return res.status(404).json({
        success: false,
        message: "User not found on this server",
      });
    }

    // Get user's cart
    const cart = await Cart.findOne({ user: localUser._id }).populate(
      "items.product",
      "name price available category"
    );

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Cart is empty. Add items before placing order.",
      });
    }

    // Prepare order items
    const orderItems = cart.items
      .map((item) => {
        // Skip if product doesn't exist
        if (!item.product) {
          return null;
        }

        // Check if product is available
        if (!item.product.available) {
          return null;
        }

        return {
          product: item.product._id,
          name: item.product.name,
          price: item.product.price,
          quantity: item.quantity,
          total: item.price * item.quantity,
        };
      })
      .filter((item) => item !== null);

    if (orderItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid items in cart.",
      });
    }

    // Calculate totals
    const subtotal = orderItems.reduce((sum, item) => sum + item.total, 0);
    const tax = subtotal * 0.05;
    const deliveryFee = subtotal > 500 ? 0 : 49;
    const totalAmount = subtotal + tax + deliveryFee;

    // Create order object
    const orderData = {
      user: localUser._id,
      items: orderItems,
      shippingAddress,
      paymentMethod: paymentMethod || "cash_on_delivery",
      subtotal,
      tax,
      deliveryFee,
      totalAmount,
      instructions,
      estimatedDelivery:
        estimatedDelivery || new Date(Date.now() + 45 * 60 * 1000),
      syncId: generateSyncId(currentServer),
      serverOrigin: currentServer,
    };

    // Create and save order

    const order = new Order(orderData);

    try {
      await order.save();
    } catch (saveError) {
      throw saveError;
    }

    // Clear cart locally
    cart.items = [];
    cart.subTotal = 0;
    cart.totalItems = 0;
    await cart.save();

    // Clear cart to other server
    const otherServerUrl = process.env.OTHER_SERVER_URL;
    if (otherServerUrl && cart.syncId) {
      setTimeout(async () => {
        try {
          await axios.post(`${otherServerUrl}/api/carts/sync/clear`, {
            syncId: cart.syncId,
          });

          apiLogger.sync.success(
            `Cart cleared for user ${localUser._id}`,
            currentServer
          );
        } catch (error) {
          apiLogger.sync.failed(
            error,
            `Cart clear sync for user ${localUser._id}`,
            currentServer
          );
        }
      }, 100);
    }

    // Sync to other server
    if (otherServerUrl) {
      setTimeout(async () => {
        try {
          await axios.post(`${otherServerUrl}/api/orders/sync`, {
            orderData: order.toObject(),
            syncId: order.syncId,
            serverOrigin: order.serverOrigin,
            userEmail: localUser.email,
          });
        } catch (syncError) {
          console.log(syncError.message);
        }
      }, 100);
    }

    res.status(201).json({
      success: true,
      message: "Order placed successfully",
      data: order,
    });
  } catch (error) {
    // Check if it's a validation error
    if (error.name === "ValidationError") {
      console.log("Validation errors:", error.errors);
    }

    res.status(500).json({
      success: false,
      message: "Failed to create order. Please try again.",
      error: error.message,
    });
  }
};

// Get User Orders
export const getUserOrders = async (req, res) => {
  const user = req.user;
  const { page = 1, limit = 10, status, startDate, endDate } = req.query;
  const currentServer = process.env.SERVER_NAME || "unknown";

  try {
    apiLogger.order.get.start(user._id, currentServer);

    // Validate query parameters
    const validation = validatePagination(req.query);
    if (!validation.isValid) {
      apiLogger.order.get.validationError(
        user._id,
        validation.errors,
        currentServer
      );
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validation.errors,
      });
    }

    // Find local user by email
    const localUser = await User.findOne({ email: user.email });

    if (!localUser) {
      return res.status(404).json({
        success: false,
        message: "User not found on this server",
      });
    }

    const query = { user: localUser._id };

    if (status) query.status = status;

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .populate("items.product", "name image category");

    const total = await Order.countDocuments(query);

    apiLogger.order.get.success(localUser._id, orders.length, currentServer);

    res.status(200).json({
      success: true,
      data: orders,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    apiLogger.order.get.error(error, user._id, currentServer);
    res.status(500).json({
      success: false,
      message: "Failed to fetch orders. Please try again.",
    });
  }
};

// Get Single Order by ID
export const getOrderById = async (req, res) => {
  const user = req.user;
  const { orderId } = req.params;
  const currentServer = process.env.SERVER_NAME || "unknown";

  try {
    apiLogger.order.getById.start(orderId, user._id, currentServer);

    // Find local user by email
    const localUser = await User.findOne({ email: user.email });
    if (!localUser) {
      return res.status(404).json({
        success: false,
        message: "User not found on this server",
      });
    }

    const order = await Order.findOne({
      _id: orderId,
      user: localUser._id,
    })
      .populate("items.product", "name description image category price")
      .populate("user", "name email");

    if (!order) {
      apiLogger.order.getById.notFound(orderId, localUser._id, currentServer);
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    apiLogger.order.getById.success(orderId, localUser._id, currentServer);

    res.status(200).json({
      success: true,
      data: order,
    });
  } catch (error) {
    apiLogger.order.getById.error(error, orderId, currentServer);
    res.status(500).json({
      success: false,
      message: "Failed to fetch order details. Please try again.",
    });
  }
};

// Update Order Status
export const updateOrderStatus = async (req, res) => {
  const user = req.user;
  const { orderId } = req.params;
  const { status, notes } = req.body;
  const currentServer = process.env.SERVER_NAME || "unknown";

  try {
    apiLogger.order.update.start(orderId, user._id, status, currentServer);

    // Validate request body
    const validation = validateUpdateStatus(req.body);
    if (!validation.isValid) {
      apiLogger.order.update.validationError(
        orderId,
        validation.errors,
        currentServer
      );
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validation.errors,
      });
    }

    // Find local user by email
    const localUser = await User.findOne({ email: user.email });
    if (!localUser) {
      return res.status(404).json({
        success: false,
        message: "User not found on this server",
      });
    }

    const order = await Order.findOne({
      _id: orderId,
      user: localUser._id,
    });

    if (!order) {
      apiLogger.order.update.notFound(orderId, localUser._id, currentServer);
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Users can only cancel their own orders
    if (status === "cancelled") {
      // Only allow cancellation if order is pending or confirmed
      if (!["pending", "confirmed"].includes(order.status)) {
        apiLogger.order.update.cancelRestricted(
          orderId,
          order.status,
          currentServer
        );
        return res.status(400).json({
          success: false,
          message: `Cannot cancel order with status: ${order.status}`,
        });
      }
    } else {
      // Users cannot update to other statuses
      apiLogger.order.update.statusUpdateRestricted(
        orderId,
        status,
        currentServer
      );
      return res.status(403).json({
        success: false,
        message:
          "You can only cancel your orders. For other status updates, contact support.",
      });
    }

    const oldStatus = order.status;
    order.status = status;
    if (notes) order.notes = notes;

    if (status === "cancelled") {
      order.actualDelivery = new Date();
      order.paymentStatus = "failed";
    }

    await order.save();

    apiLogger.order.update.success(orderId, oldStatus, status, currentServer);

    // Sync status update to other server
    const otherServerUrl = process.env.OTHER_SERVER_URL;
    if (otherServerUrl && order.syncId) {
      setTimeout(async () => {
        try {
          await axios.put(`${otherServerUrl}/api/orders/sync/${order.syncId}`, {
            status,
            action: "update_status",
          });
          apiLogger.sync.success(
            `Order status ${order.orderNumber}`,
            currentServer
          );
        } catch (error) {
          apiLogger.sync.failed(
            error,
            `Order status ${order.orderNumber}`,
            currentServer
          );
        }
      }, 100);
    }

    res.status(200).json({
      success: true,
      message: "Order status updated successfully",
      data: order,
    });
  } catch (error) {
    apiLogger.order.update.error(error, orderId, currentServer);
    res.status(500).json({
      success: false,
      message: "Failed to update order status. Please try again.",
    });
  }
};

// Get Order by Order Number
export const getOrderByNumber = async (req, res) => {
  const user = req.user;
  const { orderNumber } = req.params;
  const currentServer = process.env.SERVER_NAME || "unknown";

  try {
    apiLogger.order.getByNumber.start(orderNumber, user._id, currentServer);

    // Find local user by email
    const localUser = await User.findOne({ email: user.email });
    if (!localUser) {
      return res.status(404).json({
        success: false,
        message: "User not found on this server",
      });
    }

    const order = await Order.findOne({
      orderNumber,
      user: localUser._id,
    })
      .populate("items.product", "name image category")
      .populate("user", "name email phone");

    if (!order) {
      apiLogger.order.getByNumber.notFound(
        orderNumber,
        localUser._id,
        currentServer
      );
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    apiLogger.order.getByNumber.success(
      orderNumber,
      localUser._id,
      currentServer
    );

    res.status(200).json({
      success: true,
      data: order,
    });
  } catch (error) {
    apiLogger.order.getByNumber.error(error, orderNumber, currentServer);
    res.status(500).json({
      success: false,
      message: "Failed to fetch order. Please try again.",
    });
  }
};

// Get Order Summary
export const getOrderSummary = async (req, res) => {
  const user = req.user;
  const currentServer = process.env.SERVER_NAME || "unknown";

  try {
    apiLogger.order.summary.start(user._id, currentServer);

    // Find local user by email
    const localUser = await User.findOne({ email: user.email });
    if (!localUser) {
      return res.status(404).json({
        success: false,
        message: "User not found on this server",
      });
    }

    const today = new Date();
    const startOfToday = new Date(today.setHours(0, 0, 0, 0));
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const stats = {
      totalOrders: await Order.countDocuments({ user: localUser._id }),
      pendingOrders: await Order.countDocuments({
        user: localUser._id,
        status: {
          $in: [
            "pending",
            "confirmed",
            "preparing",
            "ready",
            "out_for_delivery",
          ],
        },
      }),
      deliveredOrders: await Order.countDocuments({
        user: localUser._id,
        status: "delivered",
      }),
      cancelledOrders: await Order.countDocuments({
        user: localUser._id,
        status: "cancelled",
      }),
      todayOrders: await Order.countDocuments({
        user: localUser._id,
        createdAt: { $gte: startOfToday },
      }),
      monthlyOrders: await Order.countDocuments({
        user: localUser._id,
        createdAt: { $gte: startOfMonth },
      }),
      totalSpent: await Order.aggregate([
        { $match: { user: localUser._id, status: "delivered" } },
        { $group: { _id: null, total: { $sum: "$totalAmount" } } },
      ]).then((result) => result[0]?.total || 0),
      recentOrders: await Order.find({ user: localUser._id })
        .sort({ createdAt: -1 })
        .limit(5)
        .select("orderNumber status totalAmount createdAt items")
        .populate("items.product", "name"),
    };

    apiLogger.order.summary.success(localUser._id, currentServer);

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    apiLogger.order.summary.error(error, user._id, currentServer);
    res.status(500).json({
      success: false,
      message: "Failed to fetch order summary. Please try again.",
    });
  }
};

// Sync Order
export const syncOrder = async (req, res) => {
  const { orderData, syncId, serverOrigin, userEmail } = req.body;
  const currentServer = process.env.SERVER_NAME || "unknown";

  try {
    apiLogger.sync.received(
      `Order ${orderData.orderNumber}`,
      serverOrigin,
      currentServer
    );

    // Validate sync request
    const validation = validateSyncOrder(req.body);
    if (!validation.isValid) {
      apiLogger.sync.validationError(validation.errors, currentServer);
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validation.errors,
      });
    }

    // Find local user by email on Server 2
    const localUser = await User.findOne({ email: userEmail });

    if (!localUser) {
      apiLogger.error("Local user not found for order sync", {
        userEmail,
        serverOrigin,
        currentServer,
      });
      return res.status(404).json({
        success: false,
        message: "User not found on this server",
      });
    }

    // Find cart using LOCAL user's ID
    const cart = await Cart.findOne({ user: localUser._id });

    if (cart) {
      if (cart.items.length > 0) {
        cart.items = [];
        cart.totalQuantity = 0;
        cart.totalPrice = 0;
        await cart.save();
        apiLogger.info(`Cart cleared during order sync on ${currentServer}`, {
          userId: localUser._id,
          userEmail: userEmail,
          server: currentServer,
          syncId: syncId,
        });
      } else {
        console.log(`Cart already empty on ${currentServer}`);
      }
    } else {
      console.log(
        `No cart found for user ${localUser._id} on ${currentServer}`
      );
    }

    // Check if order exists by syncId
    let order = await Order.findOne({ syncId });

    if (order) {
      // Update existing order
      Object.assign(order, orderData);
      order.user = localUser._id;
      await order.save();

      apiLogger.sync.duplicate(
        `Order ${orderData.orderNumber}`,
        syncId,
        currentServer
      );
    } else {
      // Check if order exists by orderNumber
      order = await Order.findOne({ orderNumber: orderData.orderNumber });

      if (order) {
        // Update existing order with syncId
        order.syncId = syncId;
        order.serverOrigin = serverOrigin;
        order.user = localUser._id;
        Object.assign(order, orderData);
        await order.save();

        apiLogger.sync.merged(
          `Order ${orderData.orderNumber}`,
          syncId,
          currentServer
        );
      } else {
        // Create new order from sync
        order = await Order.create({
          ...orderData,
          syncId,
          serverOrigin,
          user: localUser._id,
        });

        apiLogger.sync.success(`Order ${orderData.orderNumber}`, currentServer);
      }
    }

    res.status(200).json({
      success: true,
      message: "Order synced and cart cleared successfully",
      data: order,
    });
  } catch (error) {
    apiLogger.sync.failed(error, `Order sync`, currentServer);
    console.error("Sync order error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Sync Order Update
export const syncOrderUpdate = async (req, res) => {
  const { syncId } = req.params;
  const { status, action } = req.body;
  const currentServer = process.env.SERVER_NAME || "unknown";

  try {
    apiLogger.sync.update.start(syncId, action, currentServer);

    const order = await Order.findOne({ syncId });

    if (!order) {
      apiLogger.sync.update.notFound(syncId, currentServer);
      return res.status(404).json({
        success: false,
        message: "Order not found for sync",
      });
    }

    if (action === "update_status" && status) {
      order.status = status;

      if (status === "delivered") {
        order.actualDelivery = new Date();
        order.paymentStatus = "completed";
      }

      await order.save();

      apiLogger.sync.update.success(
        syncId,
        order.status,
        status,
        currentServer
      );
    }

    res.status(200).json({
      success: true,
      message: "Order updated via sync",
      data: order,
    });
  } catch (error) {
    apiLogger.sync.update.error(error, syncId, currentServer);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Track Order
export const trackOrder = async (req, res) => {
  const user = req.user;
  const { orderId } = req.params;
  const currentServer = process.env.SERVER_NAME || "unknown";

  try {
    apiLogger.info("Tracking order", {
      orderId,
      userId: user._id,
      email: user.email,
      currentServer,
    });

    // Find local user by email
    const localUser = await User.findOne({ email: user.email });
    if (!localUser) {
      return res.status(404).json({
        success: false,
        message: "User not found on this server",
      });
    }

    const order = await Order.findOne({
      _id: orderId,
      user: localUser._id,
    })
      .select(
        "orderNumber status items shippingAddress estimatedDelivery actualDelivery createdAt"
      )
      .populate("items.product", "name image");

    if (!order) {
      apiLogger.warn("Order not found for tracking", {
        orderId,
        userId: localUser._id,
        email: localUser.email,
        currentServer,
      });
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Calculate estimated time remaining
    let timeRemaining = null;
    if (
      order.estimatedDelivery &&
      order.status !== "delivered" &&
      order.status !== "cancelled"
    ) {
      const now = new Date();
      const estimated = new Date(order.estimatedDelivery);
      const diffMs = estimated - now;

      if (diffMs > 0) {
        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMinutes / 60);
        const remainingMinutes = diffMinutes % 60;

        timeRemaining = {
          minutes: diffMinutes,
          hours: diffHours,
          display:
            diffHours > 0
              ? `${diffHours}h ${remainingMinutes}m`
              : `${remainingMinutes}m`,
        };
      }
    }

    const trackingInfo = {
      orderNumber: order.orderNumber,
      status: order.status,
      statusDescription: getStatusDescription(order.status),
      items: order.items,
      shippingAddress: order.shippingAddress,
      estimatedDelivery: order.estimatedDelivery,
      actualDelivery: order.actualDelivery,
      orderDate: order.createdAt,
      timeRemaining,
      nextPossibleStatus: getNextStatus(order.status),
    };

    res.status(200).json({
      success: true,
      data: trackingInfo,
    });
  } catch (error) {
    apiLogger.error("Failed to track order", {
      error: error.message,
      orderId,
      userId: user._id,
      email: user.email,
      currentServer,
    });

    res.status(500).json({
      success: false,
      message: "Failed to track order. Please try again.",
    });
  }
};

// Helper functions
const getStatusDescription = (status) => {
  const descriptions = {
    pending: "Order received. Waiting for restaurant confirmation.",
    confirmed: "Order confirmed by restaurant.",
    preparing: "Food is being prepared.",
    ready: "Order is ready for pickup/delivery.",
    out_for_delivery: "Order is on its way to you.",
    delivered: "Order has been delivered successfully.",
    cancelled: "Order has been cancelled.",
    failed: "Order failed due to unforeseen circumstances.",
  };
  return descriptions[status] || "Unknown status";
};

const getNextStatus = (currentStatus) => {
  const statusFlow = {
    pending: ["confirmed", "cancelled"],
    confirmed: ["preparing", "cancelled"],
    preparing: ["ready", "cancelled"],
    ready: ["out_for_delivery", "cancelled"],
    out_for_delivery: ["delivered", "failed"],
    delivered: [],
    cancelled: [],
    failed: [],
  };
  return statusFlow[currentStatus] || [];
};
