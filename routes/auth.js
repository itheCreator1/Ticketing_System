const express = require('express');
const router = express.Router();
const { validateRequest } = require('../middleware/validation');
const { AUTH_MESSAGES } = require('../constants/messages');
const authService = require('../services/authService');
const { validateLogin } = require('../validators/authValidators');
const { successRedirect, errorRedirect } = require('../utils/responseHelpers');
const AuditLog = require('../models/AuditLog');

router.get('/login', (req, res) => {
  if (req.session.user) {
    return res.redirect('/admin/dashboard');
  }
  res.render('auth/login', { title: 'Admin Login' });
});

router.post('/login', validateLogin, validateRequest, async (req, res, next) => {
  try {
    const { username, password } = req.body;
    const user = await authService.authenticate(username, password);

    if (!user) {
      return errorRedirect(req, res, AUTH_MESSAGES.LOGIN_FAILED, '/auth/login');
    }

    req.session.user = authService.createSessionData(user);

    // Log successful login to audit trail
    await AuditLog.create({
      actorId: user.id,
      action: 'USER_LOGIN',
      targetType: 'user',
      targetId: user.id,
      details: { success: true },
      ipAddress: req.ip
    });

    successRedirect(req, res, AUTH_MESSAGES.LOGIN_SUCCESS, '/admin/dashboard');
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
