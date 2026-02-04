import mongoose from "mongoose";

const ExpenseSchema = new mongoose.Schema({
  // Polymorphic reference - exactly ONE must be set
  carrier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Carrier",
  },
  truck: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Truck",
  },
  driver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Driver",
  },
  category: {
    type: String,
    required: true,
    enum: ["fuel", "driver_rent", "taxes", "tool_taxes", "on_road", "maintenance", "tyre", "others"],
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
  // Tyre-specific fields
  tyreNumber: {
    type: String,
    trim: true,
  },
  tyreInfo: {
    type: String,
    trim: true,
  },
  // Maintenance-specific field - meter reading at time of maintenance
  meterReading: {
    type: Number,
    min: 0,
  },
  // Driver rent-specific field - which driver this rent is paid to (for carrier expenses)
  driverRentDriver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Driver",
  },
  // Reference to the original expense this was synced from (for truck/driver expenses synced from carrier/trip expenses)
  syncedFromExpense: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Expense",
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

// Pre-save hook to calculate amount for fuel expenses and validate references
ExpenseSchema.pre("save", function () {
  this.updatedAt = Date.now();
  
  // Validate that exactly one reference is set
  const refs = [this.carrier, this.truck, this.driver].filter(Boolean);
  if (refs.length !== 1) {
    throw new Error("Exactly one of carrier, truck, or driver must be set");
  }
  
  // Auto-calculate amount for fuel expenses if liters and pricePerLiter are provided
  if (this.category === "fuel" && this.liters && this.pricePerLiter) {
    this.amount = this.liters * this.pricePerLiter;
  }
});

// Indexes for faster queries
ExpenseSchema.index({ carrier: 1, date: -1 }); // For fetching expenses by carrier
ExpenseSchema.index({ truck: 1, date: -1 }); // For fetching expenses by truck
ExpenseSchema.index({ driver: 1, date: -1 }); // For fetching expenses by driver
ExpenseSchema.index({ category: 1, date: -1 }); // For filtering by category
ExpenseSchema.index({ driverRentDriver: 1, category: 1 }); // For fetching driver rent payments
ExpenseSchema.index({ truck: 1, category: 1 }); // For truck expense queries by category

export default mongoose.models.Expense || mongoose.model("Expense", ExpenseSchema);
