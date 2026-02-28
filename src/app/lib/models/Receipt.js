import mongoose from "mongoose";

const ReceiptSchema = new mongoose.Schema({
  receiptNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true,
  },
  // Link to the invoice
  invoiceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Invoice",
    required: true,
  },
  invoiceNumber: {
    type: String,
    required: true,
    trim: true,
    uppercase: true,
  },
  // Payment details - links to specific payment within invoice.payments array
  paymentIndex: {
    type: Number,
    required: true,
  },
  // User who created/generated the receipt
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  // Company details
  senderCompanyName: {
    type: String,
    required: true,
    trim: true,
  },
  senderAddress: {
    type: String,
    trim: true,
  },
  senderBankDetails: {
    type: String,
    trim: true,
  },
  // Client company name
  clientCompanyName: {
    type: String,
    required: true,
    trim: true,
    uppercase: true,
  },
  // Payment amount (including excess if any)
  paymentAmount: {
    type: Number,
    required: true,
    default: 0,
  },
  // Amount applied to invoice
  amountApplied: {
    type: Number,
    required: true,
    default: 0,
  },
  // Excess amount added to credit
  excessAmount: {
    type: Number,
    default: 0,
  },
  // Payment method
  paymentMethod: {
    type: String,
    required: true,
    default: "Cash",
    trim: true,
  },
  // Bank account info (if bank transfer)
  accountInfo: {
    type: String,
    trim: true,
  },
  // Payment date
  paymentDate: {
    type: Date,
    required: true,
  },
  // Receipt issued date
  receiptDate: {
    type: Date,
    default: Date.now,
  },
  // Invoice details for receipt display
  invoiceDate: {
    type: Date,
    required: true,
  },
  invoiceAmount: {
    type: Number,
    required: true,
  },
  // Notes or reference
  notes: {
    type: String,
    trim: true,
  },
  // Receipt status
  status: {
    type: String,
    enum: ["generated", "sent", "archived"],
    default: "generated",
  },
  // For tracking sent receipts
  sentAt: {
    type: Date,
  },
  sentTo: {
    type: String,
    trim: true,
  },
  // Metadata
  recordedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
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

// Index for quick lookups
ReceiptSchema.index({ invoiceId: 1 });
ReceiptSchema.index({ invoiceNumber: 1 });
ReceiptSchema.index({ clientCompanyName: 1 });
ReceiptSchema.index({ receiptNumber: 1 });

ReceiptSchema.pre("save", function () {
  this.updatedAt = Date.now();
});

export default mongoose.models.Receipt ||
  mongoose.model("Receipt", ReceiptSchema);
