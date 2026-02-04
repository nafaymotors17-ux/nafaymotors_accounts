import mongoose from "mongoose";

const TruckSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    uppercase: true,
  },
  // Drivers assigned to this truck (array to support multiple drivers)
  drivers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Driver",
  }],
  // Truck/Vehicle number or identifier
  number: {
    type: String,
    trim: true,
    uppercase: true,
  },
  // Current meter reading (odometer reading)
  currentMeterReading: {
    type: Number,
    default: 0,
  },
  // Maintenance interval in kilometers (e.g., 1000 means maintenance every 1000km)
  maintenanceInterval: {
    type: Number,
    default: 1000,
  },
  // Last maintenance done at this kilometer reading
  lastMaintenanceKm: {
    type: Number,
    default: 0,
  },
  // Last maintenance date
  lastMaintenanceDate: {
    type: Date,
  },
  // Maintenance history (array of maintenance records)
  maintenanceHistory: [{
    date: {
      type: Date,
      default: Date.now,
    },
    kmReading: {
      type: Number,
      required: true,
    },
    details: {
      type: String,
      trim: true,
    },
    cost: {
      type: Number,
      min: 0,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  }],
  // User who created this truck
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  isActive: {
    type: Boolean,
    default: true,
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

TruckSchema.pre("save", function () {
  this.updatedAt = Date.now();
  // Ensure name is uppercase
  if (this.name) {
    this.name = this.name.toUpperCase().trim();
  }
  // Ensure number is uppercase
  if (this.number) {
    this.number = this.number.toUpperCase().trim();
  }
});

// Create compound unique index for name + userId to ensure uniqueness per user
TruckSchema.index({ name: 1, userId: 1 }, { 
  unique: true, 
});

export default mongoose.models.Truck ||
  mongoose.model("Truck", TruckSchema);
