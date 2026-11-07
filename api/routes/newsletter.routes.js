const { Router } = require('express');
const newsletterController = require('../controllers/newsletter.controller');

const router = Router();

// POST /api/newsletter/subscribe
router.post('/subscribe', newsletterController.subscribe);

module.exports = router;