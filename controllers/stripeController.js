import stripeLib from 'stripe';
import dotenv from 'dotenv';
import User from '../models/User.js';

// Load environment variables
dotenv.config();

const stripe = stripeLib(process.env.STRIPE_SECRET_KEY);

export const createSetupIntent = async (req, res) => {
  try {
    const { customerId } = req.body;

    if (!customerId) {
      return res.status(400).json({ error: 'Customer ID is required.' });
    }

    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ['card'],
    });

    res.status(200).json({
      clientSecret: setupIntent.client_secret,
      paymentMethodId: setupIntent.payment_method,
    });
  } catch (error) {
    console.error('Create SetupIntent Error:', error);
    res.status(500).json({ error: 'Failed to create SetupIntent.' });
  }
};

export const createSubscription = async (req, res) => {
  try {
    const { customerId, priceId, paymentMethodId } = req.body;
    const userId = req.session.user ? req.session.user.id : null;

    console.log('Received subscription data:', { customerId, priceId, paymentMethodId, userId });

    if (!customerId || !priceId || !userId || !paymentMethodId) {
      return res.status(400).json({ error: 'Customer ID, Price ID, User ID, and Payment Method ID are required.' });
    }

    await stripe.paymentMethods.attach(paymentMethodId, { customer: customerId });
    await stripe.customers.update(customerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });

    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      trial_period_days: 14,
      payment_behavior: 'default_incomplete',
      payment_settings: {
        payment_method_types: ['card'],
        save_default_payment_method: 'on_subscription',
      },
    });

    if (!subscription || !subscription.id) {
      return res.status(500).json({ error: 'Failed to create subscription in Stripe.' });
    }

    const subscriptionEndDate = new Date(subscription.current_period_end * 1000);

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    user.stripeSubscriptionId = subscription.id;
    user.subscribed = true;
    user.subscriptionEndDate = subscriptionEndDate;
    await user.save();

    res.status(200).json({
      message: 'Subscription created successfully.',
      subscriptionId: subscription.id,
      subscriptionEndDate,
      subscription,
    });
  } catch (error) {
    console.error('Stripe Create Subscription Error:', error);
    res.status(500).json({ error: 'Failed to create subscription. Please try again later.' });
  }
};

export const attachPaymentMethod = async (req, res) => {
  const { customerId, paymentMethodId } = req.body;

  if (!customerId || !paymentMethodId) {
    return res.status(400).json({ error: 'customerId and paymentMethodId are required.' });
  }

  try {
    await stripe.paymentMethods.attach(paymentMethodId, { customer: customerId });
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

    const subscription = await stripe.subscriptions.update(user.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });

    const subscriptionEndDate = new Date(subscription.current_period_end * 1000);

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

export const handleWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  try {
    const event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);

    if (event.type === 'invoice.paid') {
      const subscriptionId = event.data.object.subscription;
      const user = await User.findOne({ stripeSubscriptionId: subscriptionId });
      if (user) {
        user.subscribed = true;
        user.subscriptionEndDate = new Date(event.data.object.period_end * 1000);
        await user.save();
        console.log(`Subscription ${subscriptionId} paid for user ${user._id}`);
      }
    } else if (event.type === 'invoice.payment_failed') {
      const subscriptionId = event.data.object.subscription;
      const user = await User.findOne({ stripeSubscriptionId: subscriptionId });
      if (user) {
        user.subscribed = false;
        await user.save();
        console.log(`Payment failed for subscription ${subscriptionId} for user ${user._id}`);
      }
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook Error:', error);
    res.status(400).json({ error: 'Webhook error' });
  }
};

// ✅ NEW: Create Stripe Payment Link with redirect back to app
export const createPaymentLink = async (req, res) => {
  try {
    const { packageName, priceId } = req.body;
    const userId = req.session.user ? req.session.user.id : null;

    if (!userId || !packageName || !priceId) {
      return res.status(400).json({ error: 'User ID, package name, and price ID are required.' });
    }

    // Save selected package in user model
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    user.selectedPackage = packageName;
    await user.save();

    // Create Stripe Payment Link
    const paymentLink = await stripe.paymentLinks.create({
      line_items: [{ price: priceId, quantity: 1 }],
      after_completion: {
        type: 'redirect',
        redirect: {
          url: 'quackapp://payment-complete',
        },
      },
      metadata: {
        userId: user._id.toString(),
        packageName,
      },
    });

    res.status(200).json({ url: paymentLink.url });
  } catch (error) {
    console.error('Create Payment Link Error:', error);
    res.status(500).json({ error: 'Failed to create payment link.' });
  }
};
