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
  // Trip tracking - which trip(s) this invoice is from
  tripNumbers: [{
    type: String,
    trim: true,
  }],
  tripDates: [{
    type: Date,
  }],
  // Payment tracking
  payments: [{
    amount: {
      type: Number,
      required: true,
      default: 0,
    },
    paymentDate: {
      type: Date,
      default: Date.now,
    },
    paymentMethod: {
      type: String,
      trim: true,
      default: "Cash", // Cash, Bank Transfer, Check, etc.
    },
    notes: {
      type: String,
      trim: true,
    },
    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  }],
  // Due date for payment tracking
  dueDate: {
    type: Date,
  },
  // Payment status - calculated field
  paymentStatus: {
    type: String,
    enum: ["unpaid", "partial", "paid", "overdue"],
    default: "unpaid",
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
  
  // Calculate payment status
  if (this.payments && Array.isArray(this.payments)) {
    const totalPaid = this.payments.reduce((sum, payment) => sum + (payment.amount || 0), 0);
    const totalAmount = this.totalAmount || 0;
    
    if (totalPaid >= totalAmount) {
      this.paymentStatus = "paid";
    } else if (totalPaid > 0) {
      // Check if overdue
      if (this.dueDate && new Date() > new Date(this.dueDate)) {
        this.paymentStatus = "overdue";
      } else {
        this.paymentStatus = "partial";
      }
    } else {
      // Check if overdue
      if (this.dueDate && new Date() > new Date(this.dueDate)) {
        this.paymentStatus = "overdue";
      } else {
        this.paymentStatus = "unpaid";
      }
    }
  }
});


export default mongoose.models.Invoice || mongoose.model("Invoice", InvoiceSchema);
