const express = require('express');
const router = express.Router();
const { validateRequest } = require('../middleware/validation');
const { FLASH_KEYS, TICKET_MESSAGES } = require('../constants/messages');
const ticketService = require('../services/ticketService');
const { validateTicketCreation } = require('../validators/ticketValidators');

router.get('/', (req, res) => {
  res.render('public/submit-ticket', {
    title: 'Submit a Ticket',
    errors: []
  });
});

router.post('/submit-ticket', validateTicketCreation, validateRequest, async (req, res, next) => {
  try {
    const ticket = await ticketService.createTicket(req.body);
    req.flash(FLASH_KEYS.SUCCESS, TICKET_MESSAGES.CREATED);
    res.render('public/success', {
      title: 'Ticket Submitted',
      ticketId: ticket.id
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
