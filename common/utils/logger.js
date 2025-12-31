import winston from "winston";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let log = `${timestamp} [${level.toUpperCase()}] ${message}`;

    if (Object.keys(meta).length > 0) {
      log += ` ${JSON.stringify(meta)}`;
    }

    return log;
  })
);

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: logFormat,
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), logFormat),
    }),
    new winston.transports.File({
      filename: path.join(__dirname, "../../logs/error.log"),
      level: "error",
      maxsize: 5242880,
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: path.join(__dirname, "../../logs/combined.log"),
      maxsize: 5242880,
      maxFiles: 10,
    }),
  ],
});

export const requestLogger = (req, res, next) => {
  const start = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - start;
    const logLevel = res.statusCode >= 400 ? "warn" : "info";

    logger.log(logLevel, "HTTP Request", {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get("user-agent"),
    });
  });

  next();
};

export const apiLogger = {
  // User logs (register)
  register: {
    start: (email, server) => {
      logger.info("User registration started", { email, server });
    },
    success: (userId, email, server) => {
      logger.info("User registered successfully", { userId, email, server });
    },
    validationFailed: (fields, server) => {
      logger.warn("Registration validation failed", { fields, server });
    },
    userExists: (email, server) => {
      logger.warn("Registration failed - user already exists", {
        email,
        server,
      });
    },
    error: (error, email, server) => {
      logger.error("Registration error", {
        error: error.message,
        email,
        server,
      });
    },
  },

  // User logs (login)
  login: {
    start: (email, server) => {
      logger.info("Login attempt started", { email, server });
    },
    success: (userId, email, server) => {
      logger.info("Login successful", { userId, email, server });
    },
    invalidCredentials: (email, server) => {
      logger.warn("Invalid login credentials", { email, server });
    },
    userNotFound: (email, server) => {
      logger.warn("Login failed - user not found", { email, server });
    },
    error: (error, email, server) => {
      logger.error("Login error", { error: error.message, email, server });
    },
  },

  // User logs (Sync)
  sync: {
    sending: (email, fromServer, toServer) => {
      logger.info("Sending sync request", { email, fromServer, toServer });
    },
    received: (email, fromServer, currentServer) => {
      logger.info("Sync request received", {
        email,
        fromServer,
        currentServer,
      });
    },
    success: (email, server) => {
      logger.info("Sync successful", { email, server });
    },
    duplicate: (email, syncId, server) => {
      logger.info("Sync skipped - duplicate user", { email, syncId, server });
    },
    failed: (error, email, server) => {
      logger.error("Sync failed", { error: error.message, email, server });
    },
  },

  // User logs (get Profile)
  profile: {
    accessed: (userId, server) => {
      logger.info("Profile accessed", { userId, server });
    },
    notFound: (userId, server) => {
      logger.warn("Profile not found", { userId, server });
    },
    unauthorized: (ip, endpoint) => {
      logger.warn("Unauthorized access attempt", { ip, endpoint });
    },
  },

  // Product logs
  product: {
    create: {
      start: (productName, server) => {
        logger.info("Product creation started", { productName, server });
      },
      success: (productId, productName, server) => {
        logger.info("Product created successfully", {
          productId,
          productName,
          server,
        });
      },
      validationFailed: (errors, server) => {
        logger.warn("Product validation failed", { errors, server });
      },
      error: (error, productName, server) => {
        logger.error("Product creation error", {
          error: error.message,
          productName,
          server,
        });
      },
    },

    fetch: {
      all: (count, server) => {
        logger.info("All products fetched", { count, server });
      },
      single: (productId, server) => {
        logger.info("Single product fetched", { productId, server });
      },
      category: (category, count, server) => {
        logger.info("Category products fetched", { category, count, server });
      },
      notFound: (productId, server) => {
        logger.warn("Product not found", { productId, server });
      },
      error: (error, server) => {
        logger.error("Product fetch error", { error: error.message, server });
      },
    },

    update: {
      start: (productId, server) => {
        logger.info("Product update started", { productId, server });
      },
      success: (productId, productName, server) => {
        logger.info("Product updated successfully", {
          productId,
          productName,
          server,
        });
      },
      error: (error, productId, server) => {
        logger.error("Product update error", {
          error: error.message,
          productId,
          server,
        });
      },
    },

    delete: {
      start: (productId, server) => {
        logger.info("Product deletion started", { productId, server });
      },
      success: (productId, productName, server) => {
        logger.info("Product deleted successfully", {
          productId,
          productName,
          server,
        });
      },
      error: (error, productId, server) => {
        logger.error("Product deletion error", {
          error: error.message,
          productId,
          server,
        });
      },
    },
  },

  // Cart logs
  cart: {
    // Get cart
    get: {
      start: (userId, server) => {
        logger.info("Fetching user cart started", { userId, server });
      },
      success: (userId, itemsCount, server) => {
        logger.info("Cart fetched successfully", {
          userId,
          itemsCount,
          server,
        });
      },
      empty: (userId, server) => {
        logger.info("Empty cart created", { userId, server });
      },
      error: (error, userId, server) => {
        logger.error("Failed to fetch cart", {
          error: error.message,
          userId,
          server,
        });
      },
    },

    // Add to cart
    add: {
      start: (userId, productId, quantity, server) => {
        logger.info("Adding item to cart started", {
          userId,
          productId,
          quantity,
          server,
        });
      },
      success: (userId, productId, quantity, server) => {
        logger.info("Item added to cart", {
          userId,
          productId,
          quantity,
          server,
        });
      },
      productNotFound: (productId, server) => {
        logger.warn("Product not found for cart", { productId, server });
      },
      productUnavailable: (productId, server) => {
        logger.warn("Product unavailable", { productId, server });
      },
      error: (error, userId, server) => {
        logger.error("Failed to add item to cart", {
          error: error.message,
          userId,
          server,
        });
      },
    },

    // Update cart
    update: {
      start: (userId, productId, quantity, server) => {
        logger.info("Updating cart item started", {
          userId,
          productId,
          quantity,
          server,
        });
      },
      success: (userId, productId, newQuantity, server) => {
        logger.info("Cart item updated", {
          userId,
          productId,
          newQuantity,
          server,
        });
      },
      cartNotFound: (userId, server) => {
        logger.warn("Cart not found for update", { userId, server });
      },
      itemNotFound: (userId, productId, server) => {
        logger.warn("Item not found in cart", { userId, productId, server });
      },
      error: (error, userId, server) => {
        logger.error("Failed to update cart item", {
          error: error.message,
          userId,
          server,
        });
      },
    },

    // Remove from cart
    remove: {
      start: (userId, productId, server) => {
        logger.info("Removing item from cart started", {
          userId,
          productId,
          server,
        });
      },
      success: (userId, productId, server) => {
        logger.info("Item removed from cart", {
          userId,
          productId,
          server,
        });
      },
      cartNotFound: (userId, server) => {
        logger.warn("Cart not found for removal", { userId, server });
      },
      itemNotFound: (userId, productId, server) => {
        logger.warn("Item not found in cart for removal", {
          userId,
          productId,
          server,
        });
      },
      error: (error, userId, server) => {
        logger.error("Failed to remove item from cart", {
          error: error.message,
          userId,
          server,
        });
      },
    },

    // Clear cart
    clear: {
      start: (userId, server) => {
        logger.info("Clearing cart started", { userId, server });
      },
      success: (userId, server) => {
        logger.info("Cart cleared", { userId, server });
      },
      cartNotFound: (userId, server) => {
        logger.warn("Cart not found for clearing", { userId, server });
      },
      error: (error, userId, server) => {
        logger.error("Failed to clear cart", {
          error: error.message,
          userId,
          server,
        });
      },
    },
  },

  // Server logs
  server: {
    started: (port, serverName) => {
      logger.info("Server started", { port, serverName });
    },
    dbConnected: (serverName) => {
      logger.info("Database connected", { serverName });
    },
    dbError: (error, serverName) => {
      logger.error("Database connection error", {
        error: error.message,
        serverName,
      });
    },
  },

  info: (message, meta = {}) => {
    logger.info(message, meta);
  },

  warn: (message, meta = {}) => {
    logger.warn(message, meta);
  },

  error: (message, meta = {}) => {
    logger.error(message, meta);
  },

  debug: (message, meta = {}) => {
    logger.debug(message, meta);
  },
};

export default logger;
