import mongoose from "mongoose";

const CarrierSchema = new mongoose.Schema({
  // For trip-type carriers
  tripNumber: {
    type: String,
    trim: true,
    uppercase: true,
    sparse: true, // Allows multiple nulls but enforces uniqueness for non-null values
  },
  // For company-type carriers (or as display name)
  name: {
    type: String,
    trim: true,
    uppercase: true,
    sparse: true,
  },
  type: {
    type: String,
    enum: ["trip", "company"],
    default: "trip",
  },
  date: {
    type: Date,
    default: Date.now,
  },
  // User who created this carrier/trip
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  totalExpense: {
    type: Number,
    default: 0,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  // Reference to Truck (new structure)
  truck: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Truck",
  },
  // Legacy fields - kept for backward compatibility
  carrierName: {
    type: String,
    trim: true,
  },
  driverName: {
    type: String,
    trim: true,
  },
  details: {
    type: String,
    trim: true,
  },
  notes: {
    type: String,
    trim: true,
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

// Ensure either tripNumber (for trips) or name (for companies) is provided


CarrierSchema.pre("save", function () {
  this.updatedAt = Date.now();
  // Ensure name is uppercase if provided
  if (this.name) {
    this.name = this.name.toUpperCase().trim();
  }
  // Ensure tripNumber is uppercase if provided
  if (this.tripNumber) {
    this.tripNumber = this.tripNumber.toUpperCase().trim();
  }
});

// Create compound unique index for tripNumber + userId to ensure uniqueness per user
CarrierSchema.index({ tripNumber: 1, userId: 1 }, { 
  unique: true, 
  sparse: true, 
  partialFilterExpression: { tripNumber: { $exists: true, $ne: null } }
});


export default mongoose.models.Carrier ||
  mongoose.model("Carrier", CarrierSchema);
