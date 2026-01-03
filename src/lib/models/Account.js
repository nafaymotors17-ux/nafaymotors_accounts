import mongoose from "mongoose";

const AccountSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  initialBalance: {
    type: Number,
    required: true,
    default: 0,
  },
  currentBalance: {
    type: Number,
    default: 0,
  },
  currency: {
    type: String,
    required: true,
  },
  currencySymbol: {
    type: String,
    required: true,
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

AccountSchema.pre("save", function () {
  this.updatedAt = Date.now();
});

export default mongoose.models.Account ||
  mongoose.model("Account", AccountSchema);
