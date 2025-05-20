import express from 'express';
import {
  createPaymentLink,
  handleWebhook,
  cancelSubscription,
} from '../controllers/stripeController.js';

const router = express.Router();

router.post('/create-payment-link', createPaymentLink);
router.post('/webhook', express.raw({ type: 'application/json' }), handleWebhook);
router.post('/cancel-subscription', cancelSubscription);

export default router;
