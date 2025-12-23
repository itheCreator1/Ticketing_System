const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const Ticket = require('../models/Ticket');
const { validateRequest } = require('../middleware/validation');

router.get('/', (req, res) => {
  res.render('public/submit-ticket', {
    title: 'Submit a Ticket',
    errors: []
  });
});

router.post('/submit-ticket', [
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('description').trim().notEmpty().withMessage('Description is required'),
  body('reporter_email').isEmail().withMessage('Valid email is required'),
  body('reporter_name').trim().notEmpty().withMessage('Name is required'),
  body('priority').isIn(['low', 'medium', 'high', 'critical']).withMessage('Invalid priority')
], validateRequest, async (req, res, next) => {
  try {
    const ticket = await Ticket.create(req.body);
    req.flash('success_msg', 'Your ticket has been submitted successfully!');
    res.render('public/success', {
      title: 'Ticket Submitted',
      ticketId: ticket.id
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
