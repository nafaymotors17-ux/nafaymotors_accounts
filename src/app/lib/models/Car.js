import mongoose from "mongoose";

const CarSchema = new mongoose.Schema({
  stockNo: {
    type: String,
    required: true,
    trim: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  chassis: {
    type: String,
    required: true,
    trim: true,
  },
  amount: {
    type: Number,
    required: true,
    default: 0,
  },
  // Company name stored as denormalized field for easier querying
  // This is the company that owns/requests the car (the customer)
  companyName: {
    type: String,
    required: true,
    trim: true,
    uppercase: true,
  },
  // User who created this car (this user is the handling company)
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  // Carrier reference - can be either trip or company type
  carrier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Carrier",
    required: true,
  },
  date: {
    type: Date,
    required: true,
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

CarSchema.pre("save", function () {
  this.updatedAt = Date.now();
  // Ensure companyName is uppercase
  if (this.companyName) {
    this.companyName = this.companyName.toUpperCase().trim();
  }
});

CarSchema.index({ carrier: 1 });
CarSchema.index({ companyName: 1 });
CarSchema.index({ date: 1 });
CarSchema.index({ userId: 1 });
CarSchema.index({ userId: 1, date: 1 });

export default mongoose.models.Car || mongoose.model("Car", CarSchema);
