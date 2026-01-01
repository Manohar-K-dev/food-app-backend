import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
  },
  name: { type: String, required: true },
  price: { type: Number, required: true, min: 0 },
  quantity: { type: Number, required: true, min: 1 },
  total: { type: Number, default: 0 },
});

const orderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    orderNumber: {
      type: String,
      unique: true,
    },

    items: [orderItemSchema],

    shippingAddress: {
      name: String,
      phone: String,
      street: String,
      city: String,
      state: String,
      pincode: String,
      country: { type: String, default: "India" },
    },

    status: {
      type: String,
      enum: [
        "pending",
        "confirmed",
        "preparing",
        "ready",
        "out_for_delivery",
        "delivered",
        "cancelled",
        "failed",
      ],
      default: "pending",
    },

    paymentMethod: {
      type: String,
      enum: ["cash_on_delivery", "online_payment"],
      default: "cash_on_delivery",
    },

    paymentStatus: {
      type: String,
      enum: ["pending", "completed", "failed"],
      default: "pending",
    },

    subtotal: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    deliveryFee: { type: Number, default: 0 },
    totalAmount: { type: Number, default: 0 },

    instructions: { type: String, maxlength: 500 },

    estimatedDelivery: Date,
    actualDelivery: Date,

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
  },
  { timestamps: true }
);

orderSchema.pre("save", async function () {
  // Generate order number
  if (!this.orderNumber) {
    this.orderNumber = `ORD${Date.now()}${Math.floor(Math.random() * 10000)}`;
  }

  // Calculate item totals
  if (this.items?.length) {
    this.items.forEach((item) => {
      item.total = item.price * item.quantity;
    });

    this.subtotal = this.items.reduce((sum, i) => sum + i.total, 0);
  }

  this.totalAmount = this.subtotal + (this.tax || 0) + (this.deliveryFee || 0);
});

orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ status: 1 });

const Order = mongoose.model("Order", orderSchema);
export default Order;
