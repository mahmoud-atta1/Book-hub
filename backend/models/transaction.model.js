const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    book: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Book',
      required: true,
    },
    type: {
      type: String,
      enum: ['purchase'],
      required: true,
    },
    quantity: {
      type: Number,
      default: 1,
      min: [1, 'Quantity must be at least 1'],
    },
    unitPrice: {
      type: Number,
      required: true,
      min: [0, 'Unit price cannot be negative'],
    },
    totalPrice: {
      type: Number,
      required: true,
      min: [0, 'Total price cannot be negative'],
    },
    status: {
      type: String,
      enum: ['pending', 'in_transit', 'completed', 'cancelled', 'rejected'],
      required: true,
    },
    customerName: {
      type: String,
      trim: true,
      required: [true, 'Customer name is required'],
      maxlength: [100, 'Customer name cannot exceed 100 characters'],
    },
    customerPhone: {
      type: String,
      trim: true,
      required: [true, 'Customer phone is required'],
      maxlength: [30, 'Customer phone cannot exceed 30 characters'],
    },
    customerAddress: {
      type: String,
      trim: true,
      required: [true, 'Customer address is required'],
      maxlength: [220, 'Customer address cannot exceed 220 characters'],
    },
    customerNotes: {
      type: String,
      trim: true,
      default: '',
      maxlength: [400, 'Customer notes cannot exceed 400 characters'],
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    approvedAt: Date,
    rejectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    rejectedAt: Date,
    rejectionReason: {
      type: String,
      trim: true,
      default: '',
      maxlength: [300, 'Rejection reason cannot exceed 300 characters'],
    },
  },
  {
    timestamps: true,
  }
);

transactionSchema.index({ user: 1, type: 1, status: 1 });
transactionSchema.index({ book: 1, status: 1 });

module.exports = mongoose.model('Transaction', transactionSchema);
