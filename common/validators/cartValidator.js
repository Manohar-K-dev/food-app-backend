export const validateCartItem = (itemData) => {
  const errors = {};

  if (!itemData.product) {
    errors.product = "Product ID is required";
  }

  if (!itemData.quantity || itemData.quantity < 1) {
    errors.quantity = "Quantity must be at least 1";
  } else if (itemData.quantity > 100) {
    errors.quantity = "Quantity cannot exceed 100";
  }

  if (!itemData.price || itemData.price < 0) {
    errors.price = "Valid price is required";
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

export const validateCartUpdate = (updateData) => {
  const errors = {};

  if (updateData.quantity !== undefined) {
    if (updateData.quantity < 1) {
      errors.quantity = "Quantity must be at least 1";
    } else if (updateData.quantity > 100) {
      errors.quantity = "Quantity cannot exceed 100";
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};
