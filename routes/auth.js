const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { body } = require('express-validator');
const User = require('../models/User');
const { validateRequest } = require('../middleware/validation');

router.get('/login', (req, res) => {
  if (req.session.user) {
    return res.redirect('/admin/dashboard');
  }
  res.render('auth/login', { title: 'Admin Login' });
});

router.post('/login', [
  body('username').trim().notEmpty().withMessage('Username is required'),
  body('password').notEmpty().withMessage('Password is required')
], validateRequest, async (req, res, next) => {
  try {
    const { username, password } = req.body;
    const user = await User.findByUsername(username);

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      req.flash('error_msg', 'Invalid username or password');
      return res.redirect('/auth/login');
    }

    req.session.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role
    };

    req.flash('success_msg', 'Welcome back!');
    res.redirect('/admin/dashboard');
  } catch (error) {
    next(error);
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.redirect('/admin/dashboard');
    }
    res.clearCookie('connect.sid');
    res.redirect('/auth/login');
  });
});

module.exports = router;
