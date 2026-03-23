const jwt = require('jsonwebtoken');
const asyncHandler = require('express-async-handler');
const { validationResult } = require('express-validator');
const User = require('../models/user.model');

const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

const getAdminEmails = () => {
  return (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
};

const resolveUserRole = (email) => {
  const adminEmails = getAdminEmails();
  return adminEmails.includes(String(email).toLowerCase()) ? 'admin' : 'user';
};

exports.register = asyncHandler(async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: 'fail',
      errors: errors.array(),
    });
  }

  const { name, email, password, confirmPassword } = req.body;
  const normalizedEmail = String(email).trim().toLowerCase();

  if (password !== confirmPassword) {
    return res.status(400).json({
      status: 'fail',
      message: 'Passwords do not match',
    });
  }

  const userExists = await User.findOne({ email: normalizedEmail });
  if (userExists) {
    return res.status(400).json({
      status: 'fail',
      message: 'Email already registered',
    });
  }

  const user = await User.create({
    name,
    email: normalizedEmail,
    password,
    role: resolveUserRole(normalizedEmail),
  });

  const token = generateToken(user._id);

  res.status(201).json({
    status: 'success',
    message: 'Registration successful',
    token,
    data: {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        profileImage: user.profileImage,
        role: user.role,
      },
    },
  });
});

exports.login = asyncHandler(async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: 'fail',
      errors: errors.array(),
    });
  }

  const { email, password } = req.body;
  const normalizedEmail = String(email).trim().toLowerCase();

  const user = await User.findOne({ email: normalizedEmail }).select('+password');

  if (!user) {
    return res.status(401).json({
      status: 'fail',
      message: 'Invalid credentials',
    });
  }

  const isPasswordMatched = await user.comparePassword(password);

  if (!isPasswordMatched) {
    return res.status(401).json({
      status: 'fail',
      message: 'Invalid credentials',
    });
  }

  const token = generateToken(user._id);

  res.status(200).json({
    status: 'success',
    message: 'Login successful',
    token,
    data: {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        profileImage: user.profileImage,
        role: user.role,
      },
    },
  });
});

exports.getCurrentUser = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id);

  res.status(200).json({
    status: 'success',
    data: {
      user,
    },
  });
});
