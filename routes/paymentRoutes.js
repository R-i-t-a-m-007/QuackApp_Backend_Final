import express from 'express';
import { createPaymentIntent } from '../controllers/paymentController.js';

const router = express.Router();

// Route to create a payment intent
router.post('/payment-intent', createPaymentIntent);

export default router;
