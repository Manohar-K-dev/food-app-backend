import validator from "validator";

export const validateProduct = (productData) => {
  const errors = {};

  // Name validation
  if (!productData.name || productData.name.trim().length === 0) {
    errors.name = "Product name is required";
  } else if (productData.name.length < 3) {
    errors.name = "Product name must be at least 3 characters";
  } else if (productData.name.length > 100) {
    errors.name = "Product name cannot exceed 100 characters";
  }

  // Description validation
  if (!productData.description || productData.description.trim().length === 0) {
    errors.description = "Description is required";
  } else if (productData.description.length < 10) {
    errors.description = "Description must be at least 10 characters";
  } else if (productData.description.length > 500) {
    errors.description = "Description cannot exceed 500 characters";
  }

  // Price validation
  if (!productData.price && productData.price !== 0) {
    errors.price = "Price is required";
  } else if (isNaN(productData.price)) {
    errors.price = "Price must be a number";
  } else if (productData.price < 0) {
    errors.price = "Price cannot be negative";
  } else if (productData.price > 10000) {
    errors.price = "Price cannot exceed ₹10,000";
  }

  // Category validation
  const validCategories = [
    "VEG",
    "NON_VEG",
    "TIFFIN",
    "MEALS",
    "FAST_FOOD",
    "JUICE",
    "SWEETS",
  ];
  if (!productData.category) {
    errors.category = "Category is required";
  } else if (!validCategories.includes(productData.category)) {
    errors.category = `Category must be one of: ${validCategories.join(", ")}`;
  }

  // Rating validation (optional)
  if (productData.rating !== undefined) {
    if (isNaN(productData.rating)) {
      errors.rating = "Rating must be a number";
    } else if (productData.rating < 0 || productData.rating > 5) {
      errors.rating = "Rating must be between 0 and 5";
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

export const validateProductUpdate = (updateData) => {
  const errors = {};

  if (updateData.name !== undefined) {
    if (updateData.name.trim().length === 0) {
      errors.name = "Product name cannot be empty";
    } else if (updateData.name.length < 3) {
      errors.name = "Product name must be at least 3 characters";
    }
  }

  if (updateData.description !== undefined) {
    if (updateData.description.trim().length === 0) {
      errors.description = "Description cannot be empty";
    } else if (updateData.description.length < 10) {
      errors.description = "Description must be at least 10 characters";
    }
  }

  if (updateData.price !== undefined) {
    if (isNaN(updateData.price)) {
      errors.price = "Price must be a number";
    } else if (updateData.price < 0) {
      errors.price = "Price cannot be negative";
    }
  }

  if (updateData.category !== undefined) {
    const validCategories = [
      "VEG",
      "NON_VEG",
      "TIFFIN",
      "MEALS",
      "FAST_FOOD",
      "JUICE",
      "SWEETS",
    ];
    if (!validCategories.includes(updateData.category)) {
      errors.category = `Category must be one of: ${validCategories.join(
        ", "
      )}`;
    }
  }

  if (updateData.rating !== undefined) {
    if (isNaN(updateData.rating)) {
      errors.rating = "Rating must be a number";
    } else if (updateData.rating < 0 || updateData.rating > 5) {
      errors.rating = "Rating must be between 0 and 5";
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};
