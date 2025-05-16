import express from 'express';
import { attachPaymentMethod, cancelSubscription, createPaymentIntent, createSubscription } from '../controllers/stripeController.js';
const router = express.Router();

// POST: Create a Stripe Checkout session
router.post('/create-payment-intent', createPaymentIntent);
router.post('/create-subscription', createSubscription);
router.post('/attach-payment-method', attachPaymentMethod);
router.post('/cancel-subscription', cancelSubscription);


export default router;
