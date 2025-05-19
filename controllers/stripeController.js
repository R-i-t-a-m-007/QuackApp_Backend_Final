// stripeController.js
import stripeLib from 'stripe';
import dotenv from 'dotenv';
import User from '../models/User.js';

// Load environment variables
dotenv.config();

const stripe = stripeLib(process.env.STRIPE_SECRET_KEY);

export const createPaymentIntent = async (req, res) => {
  try {
    const { priceId, customerId } = req.body; // ✅ Ensure customerId is received

    if (!priceId || !customerId) {
      return res.status(400).json({ error: 'Price ID and Customer ID are required.' });
    }

    // Fetch the price details from Stripe using the price ID
    const price = await stripe.prices.retrieve(priceId);
    if (!price || !price.unit_amount) {
      return res.status(400).json({ error: 'Invalid price ID.' });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: price.unit_amount,
      currency: price.currency,
      customer: customerId, // 
      payment_method_types: ['card'],
    });

    res.status(200).json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    console.error('Stripe Payment Intent Error:', error.message);
    res.status(500).json({ error: 'Failed to create payment intent.' });
  }
};


// Create Subscription with 14-day Trial and Auto Charge
export const createSubscription = async (req, res) => {
  try {
    const { customerId, priceId } = req.body; // no paymentMethodId now
    const userId = req.session.user?.id;

    if (!customerId || !priceId || !userId) {
      return res.status(400).json({ error: 'Missing required fields.' });
    }

    // Create subscription with default_incomplete behavior and 14-day trial
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      trial_period_days: 14,
      payment_behavior: 'default_incomplete',
      expand: ['latest_invoice.payment_intent'],
    });

    // Save subscription details to the User model
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    user.stripeSubscriptionId = subscription.id;
    user.subscribed = true;
    user.subscriptionEndDate = new Date(subscription.current_period_end * 1000);
    await user.save();

    // Return subscription and PaymentIntent client secret for frontend Payment Sheet
    res.status(200).json({
      message: 'Subscription created, pending payment.',
      subscriptionId: subscription.id,
      subscriptionEndDate: user.subscriptionEndDate,
      subscription,
    });
  } catch (error) {
    console.error('Create Subscription Error:', error.message);
    res.status(500).json({ error: 'Failed to create subscription.' });
  }
};







// In your stripeController.js
export const attachPaymentMethod = async (req, res) => {
  const { customerId, paymentMethodId } = req.body;
  console.log('Received data:', req.body);

  if (!customerId || !paymentMethodId) {
    console.error('Error: Missing customerId or paymentMethodId');
    return res.status(400).json({ error: 'customerId and paymentMethodId are required.' });
  }

  try {
    // Attach the payment method to the customer
    await stripe.paymentMethods.attach(paymentMethodId, { customer: customerId });

    // Set the payment method as the default for the customer
    await stripe.customers.update(customerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });

    res.status(200).json({ message: 'Payment method attached successfully.' });
  } catch (error) {
    console.error('Error attaching payment method:', error);
    res.status(500).json({ error: 'Failed to attach payment method.' });
  }
};

export const cancelSubscription = async (req, res) => {
  try {
    const userId = req.session.user ? req.session.user.id : null;
    const user = await User.findById(userId);

    if (!user || !user.stripeSubscriptionId) {
      return res.status(400).json({ message: 'User subscription not found' });
    }

    // Cancel the subscription in Stripe
    const subscription = await stripe.subscriptions.update(user.stripeSubscriptionId, {
      cancel_at_period_end: true, // Cancels at the end of the billing cycle
    });
    const subscriptionEndDate = new Date(subscription.current_period_end * 1000);

    // Optionally update the user record
    user.subscribed = false;
    user.subscriptionEndDate = subscriptionEndDate;
    await user.save();

    res.json({
      message: 'Subscription will be canceled at the end of the billing cycle.',
      subscription,
      subscriptionEndDate,
    });
  } catch (error) {
    console.error('Cancel Subscription Error:', error);
    res.status(500).json({ message: 'Error canceling subscription' });
  }
};
