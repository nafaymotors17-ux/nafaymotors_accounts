import mongoose from "mongoose";

const CarrierSchema = new mongoose.Schema({
  // For trip-type carriers
  tripNumber: {
    type: String,
    trim: true,
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
});

// Indexes for performance
CarrierSchema.index({ tripNumber: 1, sparse: true });
CarrierSchema.index({ name: 1, sparse: true });
CarrierSchema.index({ date: 1 });
CarrierSchema.index({ type: 1 });
CarrierSchema.index({ userId: 1 });
CarrierSchema.index({ isActive: 1 });
// Compound unique index: company name should be unique per user
CarrierSchema.index({ name: 1, userId: 1, type: 1 }, { unique: true, sparse: true, partialFilterExpression: { type: 'company' } });

export default mongoose.models.Carrier ||
  mongoose.model("Carrier", CarrierSchema);
