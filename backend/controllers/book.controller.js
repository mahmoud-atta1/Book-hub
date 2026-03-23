const asyncHandler = require('express-async-handler');
const { validationResult } = require('express-validator');
const Book = require('../models/book.model');

function parseNumber(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toBoolean(value, fallback) {
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.toLowerCase() === 'true';
  return fallback;
}

function normalizeBookPayload(payload) {
  return {
    title: payload.title?.trim(),
    author: payload.author?.trim(),
    genre: payload.genre?.trim() || 'General',
    description: payload.description?.trim() || '',
    coverImage: payload.coverImage?.trim() || '',
    isbn: payload.isbn?.trim().toUpperCase() || undefined,
    price: parseNumber(payload.price, 0),
    stock: parseNumber(payload.stock, 0),
    availableForSale: toBoolean(payload.availableForSale, true),
    featured: toBoolean(payload.featured, false),
  };
}

exports.createBook = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: 'fail',
      errors: errors.array(),
    });
  }

  const book = await Book.create({
    ...normalizeBookPayload(req.body),
    createdBy: req.user.id,
  });

  res.status(201).json({
    status: 'success',
    message: 'Book added to catalog',
    data: { book },
  });
});

exports.getBooks = asyncHandler(async (req, res) => {
  const {
    genre,
    search,
    availableForSale,
    inStock,
    minPrice,
    maxPrice,
    sortBy = '-createdAt',
  } = req.query;

  const filter = {};

  if (genre) filter.genre = genre;
  if (availableForSale === 'true') filter.availableForSale = true;
  if (inStock === 'true') filter.stock = { $gt: 0 };

  const min = parseNumber(minPrice, null);
  const max = parseNumber(maxPrice, null);

  if (min !== null || max !== null) {
    filter.price = {};
    if (min !== null) filter.price.$gte = min;
    if (max !== null) filter.price.$lte = max;
  }

  if (search) {
    filter.$text = { $search: search };
  }

  const books = await Book.find(filter)
    .sort(sortBy)
    .populate('createdBy', 'name email role');

  res.status(200).json({
    status: 'success',
    results: books.length,
    data: { books },
  });
});

exports.getBook = asyncHandler(async (req, res) => {
  const book = await Book.findById(req.params.id).populate('createdBy', 'name email role');

  if (!book) {
    return res.status(404).json({
      status: 'fail',
      message: 'Book not found',
    });
  }

  res.status(200).json({
    status: 'success',
    data: { book },
  });
});

exports.updateBook = asyncHandler(async (req, res) => {
  const existingBook = await Book.findById(req.params.id);
  if (!existingBook) {
    return res.status(404).json({
      status: 'fail',
      message: 'Book not found',
    });
  }

  const payload = normalizeBookPayload({
    ...existingBook.toObject(),
    ...req.body,
  });

  const book = await Book.findByIdAndUpdate(req.params.id, payload, {
    new: true,
    runValidators: true,
  }).populate('createdBy', 'name email role');

  res.status(200).json({
    status: 'success',
    message: 'Book updated successfully',
    data: { book },
  });
});

exports.deleteBook = asyncHandler(async (req, res) => {
  const book = await Book.findById(req.params.id);

  if (!book) {
    return res.status(404).json({
      status: 'fail',
      message: 'Book not found',
    });
  }

  await Book.findByIdAndDelete(req.params.id);

  res.status(200).json({
    status: 'success',
    message: 'Book removed from catalog',
    data: null,
  });
});

exports.getCatalogStats = asyncHandler(async (_req, res) => {
  const totalBooks = await Book.countDocuments();
  const inStockBooks = await Book.countDocuments({ stock: { $gt: 0 } });
  const outOfStockBooks = await Book.countDocuments({ stock: 0 });
  const lowStockBooks = await Book.countDocuments({ stock: { $gt: 0, $lte: 3 } });

  const priceStats = await Book.aggregate([
    {
      $group: {
        _id: null,
        averagePrice: { $avg: '$price' },
        inventoryValue: { $sum: { $multiply: ['$price', '$stock'] } },
      },
    },
  ]);

  const summary = priceStats[0] || { averagePrice: 0, inventoryValue: 0 };

  res.status(200).json({
    status: 'success',
    data: {
      totalBooks,
      inStockBooks,
      outOfStockBooks,
      lowStockBooks,
      averagePrice: Number((summary.averagePrice || 0).toFixed(2)),
      inventoryValue: Number((summary.inventoryValue || 0).toFixed(2)),
    },
  });
});
