require('dotenv').config();
const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const path = require('path');

const sessionConfig = require('./config/session');
const errorHandler = require('./middleware/errorHandler');

const publicRoutes = require('./routes/public');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const userRoutes = require('./routes/users');

const app = express();
const port = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"]
    }
  }
}));
app.use(morgan('combined'));
app.use(compression());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, 'public')));

app.use(session(sessionConfig));

app.use(flash());

app.use((req, res, next) => {
  res.locals.success_msg = req.flash('success_msg');
  res.locals.error_msg = req.flash('error_msg');
  res.locals.error = req.flash('error');
  res.locals.user = req.session.user || null;
  next();
});

app.use('/', publicRoutes);
app.use('/auth', authRoutes);
app.use('/admin', adminRoutes);
app.use('/admin/users', userRoutes);

app.use((req, res) => {
  res.status(404).render('errors/404', { title: '404 - Page Not Found' });
});

app.use(errorHandler);

app.listen(port, () => {
  console.log(`Ticketing system running on port ${port}`);
});
