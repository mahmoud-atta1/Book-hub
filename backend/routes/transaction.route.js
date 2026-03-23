const express = require('express');
const { body } = require('express-validator');
const {
  createPurchase,
  approveTransaction,
  rejectTransaction,
  updateTransactionStatus,
  getMyTransactions,
  getAllTransactions,
  getTransactionStats,
} = require('../controllers/transaction.controller');
const { protect, restrictTo } = require('../middlewares/authMiddleware');

const router = express.Router();

const purchaseValidation = [
  body('bookId')
    .notEmpty()
    .withMessage('Book id is required')
    .isMongoId()
    .withMessage('Invalid book id'),
  body('quantity')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Quantity must be at least 1'),
  body('customerName')
    .trim()
    .notEmpty()
    .withMessage('Customer name is required')
    .isLength({ max: 100 })
    .withMessage('Customer name cannot exceed 100 characters'),
  body('customerPhone')
    .trim()
    .notEmpty()
    .withMessage('Customer phone is required')
    .isLength({ max: 30 })
    .withMessage('Customer phone cannot exceed 30 characters'),
  body('customerAddress')
    .trim()
    .notEmpty()
    .withMessage('Customer address is required')
    .isLength({ max: 220 })
    .withMessage('Customer address cannot exceed 220 characters'),
  body('customerNotes')
    .optional()
    .trim()
    .isLength({ max: 400 })
    .withMessage('Customer notes cannot exceed 400 characters'),
];

router.use(protect);

router.get('/my', getMyTransactions);
router.get('/stats/overview', getTransactionStats);
router.post('/purchase', purchaseValidation, createPurchase);
router.patch(
  '/:id/status',
  restrictTo('admin'),
  body('status')
    .trim()
    .isIn(['pending', 'in_transit', 'completed', 'rejected'])
    .withMessage('Invalid status'),
  body('reason')
    .optional()
    .trim()
    .isLength({ max: 300 })
    .withMessage('Rejection reason cannot exceed 300 characters'),
  updateTransactionStatus
);
router.patch('/:id/approve', restrictTo('admin'), approveTransaction);
router.patch(
  '/:id/reject',
  restrictTo('admin'),
  body('reason')
    .optional()
    .trim()
    .isLength({ max: 300 })
    .withMessage('Rejection reason cannot exceed 300 characters'),
  rejectTransaction
);
router.get('/', restrictTo('admin'), getAllTransactions);

module.exports = router;
