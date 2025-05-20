import stripeLib from 'stripe';
import dotenv from 'dotenv';
import User from '../models/User.js';

dotenv.config();
const stripe = stripeLib(process.env.STRIPE_SECRET_KEY);

// Create a Stripe Payment Link and save selected package
export const createPaymentLink = async (req, res) => {
  try {
    const { packageName, priceId } = req.body;
    const userId = req.session.user ? req.session.user.id : null;

    if (!userId || !packageName || !priceId) {
      return res.status(400).json({ error: 'User ID, package name, and price ID are required.' });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    // Save selected package
    user.selectedPackage = packageName;
    await user.save();

    // Create payment link
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

// Handle webhook events (only invoice paid or failed)
export const handleWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  try {
    const event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);

    if (event.type === 'invoice.paid') {
      const subscriptionId = event.data.object.subscription;
      const customerId = event.data.object.customer;

      // Try to get user by subscription ID or customer ID
      const user = await User.findOne({
        $or: [
          { stripeSubscriptionId: subscriptionId },
          { stripeCustomerId: customerId },
        ],
      });

      if (user) {
        user.subscribed = true;
        user.subscriptionEndDate = new Date(event.data.object.period_end * 1000);
        if (subscriptionId) user.stripeSubscriptionId = subscriptionId;
        await user.save();

        console.log(`✅ Subscription active for user ${user._id}`);
      }
    } else if (event.type === 'invoice.payment_failed') {
      const subscriptionId = event.data.object.subscription;
      const user = await User.findOne({ stripeSubscriptionId: subscriptionId });

      if (user) {
        user.subscribed = false;
        await user.save();
        console.log(`❌ Payment failed for user ${user._id}`);
      }
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook Error:', error.message);
    res.status(400).json({ error: 'Webhook error' });
  }
};

export const cancelSubscription = async (req, res) => {
  try {
    const userId = req.session.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const user = await User.findById(userId);
    if (!user || !user.stripeSubscriptionId) {
      return res.status(404).json({ error: 'Subscription not found for user' });
    }

    // Cancel at period end (recommended), or set `cancel_at_period_end: false` to cancel immediately
    const deleted = await stripe.subscriptions.update(user.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });

    user.subscribed = false;
    await user.save();

    res.status(200).json({ message: 'Subscription canceled', subscription: deleted });
  } catch (error) {
    console.error('Cancel Subscription Error:', error);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
};

