const asyncHandler = require('express-async-handler');
const { validationResult } = require('express-validator');
const Book = require('../models/book.model');
const Transaction = require('../models/transaction.model');

function parsePositiveInt(value, fallback) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return parsed;
}

function parseText(value, fallback = '') {
  if (value === undefined || value === null) return fallback;
  return String(value).trim();
}

function getCustomerPayload(body, fallbackName) {
  return {
    customerName: parseText(body.customerName, fallbackName),
    customerPhone: parseText(body.customerPhone),
    customerAddress: parseText(body.customerAddress),
    customerNotes: parseText(body.customerNotes),
  };
}

const ADMIN_SETTABLE_STATUSES = new Set(['pending', 'in_transit', 'completed', 'rejected']);
const STOCK_DEDUCTED_STATUSES = new Set(['in_transit', 'completed']);

function canTransitionStatus(currentStatus, nextStatus) {
  if (currentStatus === nextStatus) return true;
  if (currentStatus === 'completed' || currentStatus === 'cancelled') return false;

  if (currentStatus === 'pending') {
    return nextStatus === 'in_transit' || nextStatus === 'completed' || nextStatus === 'rejected';
  }

  if (currentStatus === 'in_transit') {
    return nextStatus === 'pending' || nextStatus === 'completed' || nextStatus === 'rejected';
  }

  if (currentStatus === 'rejected') {
    return nextStatus === 'pending' || nextStatus === 'in_transit' || nextStatus === 'completed';
  }

  return false;
}

async function updatePurchaseStatus(transaction, nextStatus, adminUserId, rejectionReason = '') {
  if (!ADMIN_SETTABLE_STATUSES.has(nextStatus)) {
    return {
      ok: false,
      code: 400,
      message: 'Invalid status value',
    };
  }

  if (transaction.type !== 'purchase') {
    return {
      ok: false,
      code: 400,
      message: 'Only purchase orders are supported',
    };
  }

  if (!canTransitionStatus(transaction.status, nextStatus)) {
    return {
      ok: false,
      code: 400,
      message: `Cannot change status from ${transaction.status} to ${nextStatus}`,
    };
  }

  const currentDeducted = STOCK_DEDUCTED_STATUSES.has(transaction.status);
  const nextDeducted = STOCK_DEDUCTED_STATUSES.has(nextStatus);

  const book = await Book.findById(transaction.book);
  if (!book) {
    return {
      ok: false,
      code: 404,
      message: 'Book not found',
    };
  }

  if (!currentDeducted && nextDeducted) {
    if (!book.availableForSale) {
      return {
        ok: false,
        code: 400,
        message: 'Book is not available for sale',
      };
    }

    if (book.stock < transaction.quantity) {
      return {
        ok: false,
        code: 400,
        message: 'Not enough stock for this order status update',
      };
    }

    book.stock -= transaction.quantity;
  } else if (currentDeducted && !nextDeducted) {
    book.stock += transaction.quantity;
  }

  transaction.status = nextStatus;

  if (nextStatus === 'rejected') {
    transaction.rejectedBy = adminUserId;
    transaction.rejectedAt = new Date();
    transaction.rejectionReason = parseText(rejectionReason);
    transaction.approvedBy = undefined;
    transaction.approvedAt = undefined;
  } else if (nextStatus === 'pending') {
    transaction.approvedBy = undefined;
    transaction.approvedAt = undefined;
    transaction.rejectedBy = undefined;
    transaction.rejectedAt = undefined;
    transaction.rejectionReason = '';
  } else {
    transaction.approvedBy = adminUserId;
    transaction.approvedAt = new Date();
    transaction.rejectedBy = undefined;
    transaction.rejectedAt = undefined;
    transaction.rejectionReason = '';
  }

  await Promise.all([book.save(), transaction.save()]);

  const populated = await transaction.populate([
    { path: 'book', select: 'title author genre price coverImage' },
    { path: 'user', select: 'name email role' },
  ]);

  return {
    ok: true,
    transaction: populated,
  };
}

exports.createPurchase = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: 'fail',
      errors: errors.array(),
    });
  }

  const quantity = parsePositiveInt(req.body.quantity, 1);
  const book = await Book.findById(req.body.bookId);

  if (!book) {
    return res.status(404).json({
      status: 'fail',
      message: 'Book not found',
    });
  }

  if (!book.availableForSale) {
    return res.status(400).json({
      status: 'fail',
      message: 'This book is not available for sale',
    });
  }

  if (book.stock < quantity) {
    return res.status(400).json({
      status: 'fail',
      message: 'Not enough stock for this purchase',
    });
  }

  const totalPrice = Number((book.price * quantity).toFixed(2));
  const customer = getCustomerPayload(req.body, req.user.name || 'Customer');

  const transaction = await Transaction.create({
    user: req.user.id,
    book: book._id,
    type: 'purchase',
    quantity,
    unitPrice: book.price,
    totalPrice,
    status: 'pending',
    ...customer,
  });

  const populated = await transaction.populate('book', 'title author genre price');

  res.status(201).json({
    status: 'success',
    message: 'Purchase request sent to admin',
    data: {
      transaction: populated,
    },
  });
});

exports.approveTransaction = asyncHandler(async (req, res) => {
  const transaction = await Transaction.findById(req.params.id);

  if (!transaction) {
    return res.status(404).json({
      status: 'fail',
      message: 'Transaction not found',
    });
  }

  const result = await updatePurchaseStatus(transaction, 'completed', req.user.id);
  if (!result.ok) {
    return res.status(result.code).json({
      status: 'fail',
      message: result.message,
    });
  }

  res.status(200).json({
    status: 'success',
    message: 'Order marked as completed',
    data: {
      transaction: result.transaction,
    },
  });
});

exports.rejectTransaction = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: 'fail',
      errors: errors.array(),
    });
  }

  const transaction = await Transaction.findById(req.params.id);

  if (!transaction) {
    return res.status(404).json({
      status: 'fail',
      message: 'Transaction not found',
    });
  }

  const result = await updatePurchaseStatus(transaction, 'rejected', req.user.id, req.body.reason);
  if (!result.ok) {
    return res.status(result.code).json({
      status: 'fail',
      message: result.message,
    });
  }

  res.status(200).json({
    status: 'success',
    message: 'Order rejected',
    data: {
      transaction: result.transaction,
    },
  });
});

exports.updateTransactionStatus = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: 'fail',
      errors: errors.array(),
    });
  }

  const transaction = await Transaction.findById(req.params.id);
  if (!transaction) {
    return res.status(404).json({
      status: 'fail',
      message: 'Transaction not found',
    });
  }

  const nextStatus = parseText(req.body.status);
  const result = await updatePurchaseStatus(transaction, nextStatus, req.user.id, req.body.reason);

  if (!result.ok) {
    return res.status(result.code).json({
      status: 'fail',
      message: result.message,
    });
  }

  res.status(200).json({
    status: 'success',
    message: `Order status updated to ${nextStatus}`,
    data: {
      transaction: result.transaction,
    },
  });
});

exports.getMyTransactions = asyncHandler(async (req, res) => {
  const { status, sortBy = '-createdAt' } = req.query;
  const filter = { user: req.user.id, type: 'purchase' };
  if (status) filter.status = status;

  const transactions = await Transaction.find(filter)
    .sort(sortBy)
    .populate('book', 'title author genre price coverImage')
    .populate('user', 'name email role');

  res.status(200).json({
    status: 'success',
    results: transactions.length,
    data: {
      transactions,
    },
  });
});

exports.getAllTransactions = asyncHandler(async (req, res) => {
  const { status, user, sortBy = '-createdAt' } = req.query;
  const filter = { type: 'purchase' };
  if (status) filter.status = status;
  if (user) filter.user = user;

  const transactions = await Transaction.find(filter)
    .sort(sortBy)
    .populate('book', 'title author genre price coverImage')
    .populate('user', 'name email role');

  res.status(200).json({
    status: 'success',
    results: transactions.length,
    data: {
      transactions,
    },
  });
});

exports.getTransactionStats = asyncHandler(async (req, res) => {
  const baseFilter = req.user.role === 'admin' ? {} : { user: req.user.id };
  const transactions = await Transaction.find({ ...baseFilter, type: 'purchase' });
  const completedTransactions = transactions.filter((tx) => tx.status === 'completed');

  const totalTransactions = transactions.length;
  const totalSpent = Number(
    completedTransactions.reduce((sum, tx) => sum + Number(tx.totalPrice || 0), 0).toFixed(2)
  );
  const totalSalesRevenue = totalSpent;
  const purchasedBooks = completedTransactions.reduce((sum, tx) => sum + Number(tx.quantity || 0), 0);
  const completedOrders = completedTransactions.length;
  const inTransitOrders = transactions.filter((tx) => tx.status === 'in_transit').length;
  const pendingRequests = transactions.filter((tx) => tx.status === 'pending').length;
  const rejectedRequests = transactions.filter((tx) => tx.status === 'rejected').length;

  res.status(200).json({
    status: 'success',
    data: {
      totalTransactions,
      totalSpent,
      totalSalesRevenue,
      completedOrders,
      inTransitOrders,
      purchasedBooks,
      pendingRequests,
      rejectedRequests,
      isAdminView: req.user.role === 'admin',
    },
  });
});
