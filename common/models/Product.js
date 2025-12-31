import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    category: {
      type: String,
      required: true,
      enum: [
        "VEG",
        "NON_VEG",
        "TIFFIN",
        "MEALS",
        "FAST_FOOD",
        "JUICE",
        "SWEETS",
      ],
    },
    available: {
      type: Boolean,
      default: true,
    },
    rating: {
      type: Number,
      min: 0,
      max: 5,
      default: 0,
    },

    // Sync fields
    syncId: {
      type: String,
      unique: true,
      sparse: true,
    },
    serverOrigin: {
      type: String,
      required: true,
      enum: ["server1", "server2"],
    },
    originalServerId: {
      type: String,
    },
  },
  { timestamps: true }
);

// Indexes for better performance
productSchema.index({ category: 1 });
productSchema.index({ price: 1 });
productSchema.index({ syncId: 1 });

const Product = mongoose.model("Product", productSchema);

export default Product;
