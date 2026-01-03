import mongoose from "mongoose";

const TransactionSchema = new mongoose.Schema({
  accountId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Account",
    required: true,
  },
  accountSlug: {
    type: String,
    required: true,
  },
  credit: {
    type: Number,
    default: 0,
  },
  debit: {
    type: Number,
    default: 0,
  },
  currency: {
    type: String,
    required: true,
  },
  details: {
    type: String,
    trim: true,
    required: true,
  },
  destination: {
    type: String,
    trim: true,
  },
  rateOfExchange: {
    type: Number,
  },
  transactionDate: {
    type: Date,
    default: Date.now,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

TransactionSchema.index({ details: "text" });

export default mongoose.models.Transaction ||
  mongoose.model("Transaction", TransactionSchema);
