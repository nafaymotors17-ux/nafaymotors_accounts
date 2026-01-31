import mongoose from "mongoose";

const DriverSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  phone: {
    type: String,
    trim: true,
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
  },
  licenseNumber: {
    type: String,
    trim: true,
  },
  address: {
    type: String,
    trim: true,
  },
  // User who created this driver
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  isActive: {
    type: Boolean,
    default: true,
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

DriverSchema.pre("save", function () {
  this.updatedAt = Date.now();
});

// Create compound unique index for name + userId to ensure uniqueness per user
DriverSchema.index({ name: 1, userId: 1 }, { 
  unique: true, 
});

export default mongoose.models.Driver ||
  mongoose.model("Driver", DriverSchema);
