import mongoose from "mongoose";

const CompanySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    uppercase: true,
  },
  // User who created this company
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },

  address: {
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

CompanySchema.pre("save", function () {
  this.updatedAt = Date.now();
  // Ensure name is always uppercase
  if (this.name) {
    this.name = this.name.toUpperCase().trim();
  }
});

// Index for userId filtering
CompanySchema.index({ userId: 1 });
// Compound unique index: company name should be unique per user
CompanySchema.index({ name: 1, userId: 1 }, { unique: true });

export default mongoose.models.Company ||
  mongoose.model("Company", CompanySchema);
