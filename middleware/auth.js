const { AUTH_MESSAGES } = require('../constants/messages');
const { USER_ROLE } = require('../constants/enums');
const { errorRedirect } = require('../utils/responseHelpers');

function requireAuth(req, res, next) {
  if (!req.session || !req.session.user) {
    return errorRedirect(req, res, AUTH_MESSAGES.UNAUTHORIZED, '/auth/login');
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.user) {
    return errorRedirect(req, res, AUTH_MESSAGES.UNAUTHORIZED, '/auth/login');
  }

  const adminRoles = [USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN];
  if (!adminRoles.includes(req.session.user.role)) {
    return errorRedirect(req, res, AUTH_MESSAGES.FORBIDDEN, '/admin/dashboard');
  }

  next();
}

module.exports = {
  requireAuth,
  requireAdmin
};
