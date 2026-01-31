import mongoose from "mongoose";

const ExpenseSchema = new mongoose.Schema({
  carrier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Carrier",
    required: true,
  },
  category: {
    type: String,
    required: true,
    enum: ["fuel", "driver_rent", "taxes", "tool_taxes", "on_road", "others"],
  },
  amount: {
    type: Number,
    required: true,
    min: 0,
  },
  details: {
    type: String,
    trim: true,
    default: "",
  },
  // Fuel-specific fields
  liters: {
    type: Number,
    min: 0,
  },
  pricePerLiter: {
    type: Number,
    min: 0,
  },
  // Metadata
  date: {
    type: Date,
    default: Date.now,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Pre-save hook to calculate amount for fuel expenses
ExpenseSchema.pre("save", function () {
  this.updatedAt = Date.now();
  
  // Auto-calculate amount for fuel expenses if liters and pricePerLiter are provided
  if (this.category === "fuel" && this.liters && this.pricePerLiter) {
    this.amount = this.liters * this.pricePerLiter;
  }
});

// Indexes for faster queries
ExpenseSchema.index({ carrier: 1, date: -1 }); // For fetching expenses by carrier
ExpenseSchema.index({ category: 1 }); // For filtering by category

export default mongoose.models.Expense || mongoose.model("Expense", ExpenseSchema);
