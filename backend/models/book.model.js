const mongoose = require('mongoose');

const bookSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      minlength: [2, 'Title must be at least 2 characters'],
      maxlength: [120, 'Title cannot exceed 120 characters'],
    },
    author: {
      type: String,
      required: [true, 'Author is required'],
      trim: true,
      minlength: [2, 'Author must be at least 2 characters'],
      maxlength: [80, 'Author cannot exceed 80 characters'],
    },
    genre: {
      type: String,
      trim: true,
      default: 'General',
      maxlength: [50, 'Genre cannot exceed 50 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1200, 'Description cannot exceed 1200 characters'],
      default: '',
    },
    coverImage: {
      type: String,
      trim: true,
      default: '',
    },
    isbn: {
      type: String,
      trim: true,
      uppercase: true,
      sparse: true,
    },
    price: {
      type: Number,
      required: [true, 'Sale price is required'],
      min: [0, 'Sale price cannot be negative'],
    },
    stock: {
      type: Number,
      required: [true, 'Stock is required'],
      min: [0, 'Stock cannot be negative'],
      default: 0,
    },
    availableForSale: {
      type: Boolean,
      default: true,
    },
    featured: {
      type: Boolean,
      default: false,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

bookSchema.index({ title: 'text', author: 'text', genre: 'text' });
bookSchema.index({ genre: 1, stock: 1 });

module.exports = mongoose.model('Book', bookSchema);
