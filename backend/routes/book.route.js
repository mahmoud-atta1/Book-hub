const express = require('express');
const { body } = require('express-validator');
const {
  createBook,
  getBooks,
  getBook,
  updateBook,
  deleteBook,
  getCatalogStats,
} = require('../controllers/book.controller');
const { protect, restrictTo } = require('../middlewares/authMiddleware');

const router = express.Router();

const createBookValidation = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Title is required')
    .isLength({ min: 2 })
    .withMessage('Title must be at least 2 characters'),
  body('author')
    .trim()
    .notEmpty()
    .withMessage('Author is required')
    .isLength({ min: 2 })
    .withMessage('Author must be at least 2 characters'),
  body('price')
    .notEmpty()
    .withMessage('Sale price is required')
    .isFloat({ min: 0 })
    .withMessage('Sale price cannot be negative'),
  body('stock')
    .notEmpty()
    .withMessage('Stock is required')
    .isInt({ min: 0 })
    .withMessage('Stock cannot be negative'),
];

const updateBookValidation = [
  body('title')
    .optional()
    .trim()
    .isLength({ min: 2 })
    .withMessage('Title must be at least 2 characters'),
  body('author')
    .optional()
    .trim()
    .isLength({ min: 2 })
    .withMessage('Author must be at least 2 characters'),
  body('price')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Sale price cannot be negative'),
  body('stock')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Stock cannot be negative'),
];

router.use(protect);

router.get('/stats/overview', restrictTo('admin'), getCatalogStats);
router.get('/', getBooks);
router.get('/:id', getBook);
router.post('/', restrictTo('admin'), createBookValidation, createBook);
router.put('/:id', restrictTo('admin'), updateBookValidation, updateBook);
router.delete('/:id', restrictTo('admin'), deleteBook);

module.exports = router;
