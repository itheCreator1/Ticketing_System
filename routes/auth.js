const express = require('express');
const router = express.Router();
const { validateRequest } = require('../middleware/validation');
const { AUTH_MESSAGES } = require('../constants/messages');
const { USER_ROLE } = require('../constants/enums');
const authService = require('../services/authService');
const { validateLogin } = require('../validators/authValidators');
const { successRedirect, errorRedirect } = require('../utils/responseHelpers');
const AuditLog = require('../models/AuditLog');
const { loginLimiter } = require('../middleware/rateLimiter');

router.get('/login', (req, res) => {
  if (req.session.user) {
    // Role-based redirect
    const redirectPath = req.session.user.role === USER_ROLE.DEPARTMENT
      ? '/client/dashboard'
      : '/admin/dashboard';
    return res.redirect(redirectPath);
  }
  res.render('auth/login', {
    title: req.t('auth:login.title'),
    t: req.t,
    language: req.language || 'el'
  });
});

router.post('/login', loginLimiter, validateLogin, validateRequest, async (req, res, next) => {
  try {
    const { username, password } = req.body;
    const user = await authService.authenticate(username, password);

    if (!user) {
      return errorRedirect(req, res, 'auth:messages.loginFailed', '/auth/login');
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

    // Role-based redirect after login
    const redirectPath = user.role === USER_ROLE.DEPARTMENT
      ? '/client/dashboard'
      : '/admin/dashboard';

    successRedirect(req, res, 'auth:messages.loginSuccess', redirectPath);
  } catch (error) {
    next(error);
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      // Role-based fallback redirect on error
      const redirectPath = req.session.user?.role === USER_ROLE.DEPARTMENT
        ? '/client/dashboard'
        : '/admin/dashboard';
      return res.redirect(redirectPath);
    }
    res.clearCookie('connect.sid');
    res.redirect('/auth/login');
  });
});

module.exports = router;
