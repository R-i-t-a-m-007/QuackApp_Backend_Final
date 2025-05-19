import express from 'express';
import {
  createSetupIntent,
  createSubscription,
  attachPaymentMethod,
  cancelSubscription,
  handleWebhook,
} from '../controllers/stripeController.js';

const router = express.Router();

// POST: Create a SetupIntent to collect payment method
router.post('/create-setup-intent', createSetupIntent);

// POST: Create a subscription
router.post('/create-subscription', createSubscription);

// POST: Attach a payment method to a customer
router.post('/attach-payment-method', attachPaymentMethod);

// POST: Cancel a subscription
router.post('/cancel-subscription', cancelSubscription);

// POST: Handle Stripe webhook events
router.post('/webhook', express.raw({ type: 'application/json' }), handleWebhook);

export default router;