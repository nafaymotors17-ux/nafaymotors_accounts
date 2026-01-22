import mongoose from "mongoose";

const InvoiceSchema = new mongoose.Schema({
  invoiceNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true,
  },
  // User who created/generated the invoice
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  // Company name (sender) - editable, defaults to username
  senderCompanyName: {
    type: String,
    required: true,
    trim: true,
  },
  // Sender address - from user profile
  senderAddress: {
    type: String,
    trim: true,
  },
  // Client company name (who invoice is sent to)
  clientCompanyName: {
    type: String,
    required: true,
    trim: true,
    uppercase: true,
  },
  // Invoice date
  invoiceDate: {
    type: Date,
    default: Date.now,
  },
  // Date range for the invoice
  startDate: {
    type: Date,
    required: true,
  },
  endDate: {
    type: Date,
    required: true,
  },
  // Car IDs included in this invoice
  carIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Car",
  }],
  // Invoice totals
  subtotal: {
    type: Number,
    required: true,
    default: 0,
  },
  vatPercentage: {
    type: Number,
    default: 0,
  },
  vatAmount: {
    type: Number,
    default: 0,
  },
  totalAmount: {
    type: Number,
    required: true,
    default: 0,
  },
  // Additional descriptions/notes
  descriptions: [{
    type: String,
    trim: true,
  }],
  // Status filter used when generating
  isActive: {
    type: String, // "true", "false", or empty
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

InvoiceSchema.pre("save", function () {
  this.updatedAt = Date.now();
});

// Indexes for performance
InvoiceSchema.index({ invoiceNumber: 1 });
InvoiceSchema.index({ userId: 1 });
InvoiceSchema.index({ clientCompanyName: 1 });
InvoiceSchema.index({ invoiceDate: -1 });
InvoiceSchema.index({ userId: 1, invoiceDate: -1 });

export default mongoose.models.Invoice || mongoose.model("Invoice", InvoiceSchema);
