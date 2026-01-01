import validator from "validator";

// Validation for creating an order
export const validateCreateOrder = (data) => {
  const errors = {};

  // Validate shipping address
  if (!data.shippingAddress) {
    errors.shippingAddress = "Shipping address is required";
  } else {
    const { name, phone, street, city, state, pincode, country } =
      data.shippingAddress;

    if (!name || !validator.isLength(name, { min: 2, max: 100 })) {
      errors.name = "Name must be between 2 and 100 characters";
    }

    if (!phone) {
      errors.phone = "Phone number is required";
    } else {
      const cleanPhone = phone.replace(/\D/g, "");
      if (cleanPhone.length < 10) {
        errors.phone = "Phone number must be at least 10 digits";
      }
    }

    if (!street || !validator.isLength(street, { min: 5, max: 200 })) {
      errors.street = "Street address must be between 5 and 200 characters";
    }

    if (!city || !validator.isLength(city, { min: 2, max: 50 })) {
      errors.city = "City must be between 2 and 50 characters";
    }

    if (!state || !validator.isLength(state, { min: 2, max: 50 })) {
      errors.state = "State must be between 2 and 50 characters";
    }

    if (!pincode) {
      errors.pincode = "Pincode is required";
    } else {
      const cleanPincode = pincode.replace(/\D/g, "");
      if (cleanPincode.length < 5) {
        errors.pincode = "Pincode must be at least 5 digits";
      }
    }

    if (country && !validator.isLength(country, { min: 2, max: 50 })) {
      errors.country = "Country must be between 2 and 50 characters";
    }
  }

  // Validate payment method
  const validPaymentMethods = ["cash_on_delivery", "online_payment"];
  if (data.paymentMethod && !validPaymentMethods.includes(data.paymentMethod)) {
    errors.paymentMethod = `Payment method must be one of: ${validPaymentMethods.join(
      ", "
    )}`;
  }

  // Validate instructions
  if (
    data.instructions &&
    !validator.isLength(data.instructions, { max: 500 })
  ) {
    errors.instructions = "Instructions cannot exceed 500 characters";
  }

  // Validate estimated delivery date
  if (data.estimatedDelivery) {
    const date = new Date(data.estimatedDelivery);
    if (isNaN(date.getTime())) {
      errors.estimatedDelivery = "Invalid estimated delivery date format";
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

// Validation for updating order status
export const validateUpdateStatus = (data) => {
  const errors = {};

  const validStatuses = [
    "pending",
    "confirmed",
    "preparing",
    "ready",
    "out_for_delivery",
    "delivered",
    "cancelled",
    "failed",
  ];

  if (!data.status || !validStatuses.includes(data.status)) {
    errors.status = `Status must be one of: ${validStatuses.join(", ")}`;
  }

  if (data.notes && !validator.isLength(data.notes, { max: 500 })) {
    errors.notes = "Notes cannot exceed 500 characters";
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

// Validation for pagination
export const validatePagination = (data) => {
  const errors = {};

  if (data.page) {
    const page = parseInt(data.page);
    if (isNaN(page) || page < 1) {
      errors.page = "Page must be a positive number";
    }
  }

  if (data.limit) {
    const limit = parseInt(data.limit);
    if (isNaN(limit) || limit < 1 || limit > 100) {
      errors.limit = "Limit must be between 1 and 100";
    }
  }

  if (data.status) {
    const validStatuses = [
      "pending",
      "confirmed",
      "preparing",
      "ready",
      "out_for_delivery",
      "delivered",
      "cancelled",
      "failed",
    ];
    if (!validStatuses.includes(data.status)) {
      errors.status = `Status must be one of: ${validStatuses.join(", ")}`;
    }
  }

  if (data.startDate) {
    const date = new Date(data.startDate);
    if (isNaN(date.getTime())) {
      errors.startDate = "Invalid start date format";
    }
  }

  if (data.endDate) {
    const date = new Date(data.endDate);
    if (isNaN(date.getTime())) {
      errors.endDate = "Invalid end date format";
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

// Validation for sync order
export const validateSyncOrder = (data) => {
  const errors = {};

  if (!data.orderData) {
    errors.orderData = "Order data is required";
    return { isValid: false, errors };
  }

  const { orderData } = data;

  // Validate order number
  if (
    !orderData.orderNumber ||
    !validator.isLength(orderData.orderNumber, { min: 10, max: 50 })
  ) {
    errors.orderNumber = "Valid order number is required (10-50 characters)";
  }

  // Validate items array
  if (
    !orderData.items ||
    !Array.isArray(orderData.items) ||
    orderData.items.length === 0
  ) {
    errors.items = "At least one order item is required";
  }

  // Validate shipping address
  if (!orderData.shippingAddress) {
    errors.shippingAddress = "Shipping address is required";
  }

  // Validate sync fields
  if (!data.syncId || !validator.isLength(data.syncId, { min: 10, max: 100 })) {
    errors.syncId = "Valid sync ID is required (10-100 characters)";
  }

  if (
    !data.serverOrigin ||
    !["server1", "server2"].includes(data.serverOrigin)
  ) {
    errors.serverOrigin = "Server origin must be either 'server1' or 'server2'";
  }

  if (!data.userEmail || !validator.isEmail(data.userEmail)) {
    errors.userEmail = "Valid user email is required";
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

// Simple validation helpers
export const validateOrderId = (orderId) => {
  const errors = {};

  if (!orderId || !validator.isMongoId(orderId.toString())) {
    errors.orderId = "Valid order ID is required";
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

export const validateOrderNumber = (orderNumber) => {
  const errors = {};

  if (!orderNumber || !validator.isLength(orderNumber, { min: 10, max: 50 })) {
    errors.orderNumber = "Valid order number is required (10-50 characters)";
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};
