import stripeLib from 'stripe';
import dotenv from 'dotenv';
import User from '../models/User.js';
import nodemailer from 'nodemailer';


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

    // Attach payment method to customer and set as default
    await stripe.paymentMethods.attach(paymentMethodId, { customer: customerId });
    await stripe.customers.update(customerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });

    // Create a subscription in Stripe
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

    console.log('Stripe subscription created:', {
      subscriptionId: subscription.id,
      status: subscription.status,
    });

    const subscriptionEndDate = new Date(subscription.current_period_end * 1000);

    // Update user in database
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
  console.log('Received data:', req.body);

  if (!customerId || !paymentMethodId) {
    console.error('Error: Missing customerId or paymentMethodId');
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

    if (!user) {
      return res.status(400).json({ message: 'User not found' });
    }

    // Set subscription end date to 30 days from today
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 30);

    // Update subscription status and log activity
    user.subscribed = false;
    user.subscriptionEndDate = endDate;
    user.activities.push({
      timestamp: new Date(),
      message: 'User requested subscription cancellation.',
    });
    await user.save();

    // Email content to user
    const userEmailContent = `
      <h2>30 Day Cancellation and Data Deletion Notice</h2>
      <p>
        Dear Quack App User,<br /><br />

        We are writing to inform you that your subscription with The Quack App will be cancelled in 30 days from the date of this notice (by ${endDate.toDateString()}).<br /><br />

        Please be advised that, as part of the cancellation process, all data associated with your account will be permanently deleted after this 30-day period.<br /><br />

        This process is in compliance with GDPR.<br /><br />

        Recommended Actions:<br />
        • Backup or retrieve any important data.<br />
        • Review any ongoing services associated with your account.<br /><br />

        Once the 30-day period concludes, deletion of all data will be irreversible. To cancel this request, please contact us before ${endDate.toDateString()}.<br /><br />

        For support, email: admin@thequackapp.com<br /><br />

        Sincerely,<br />
        The Quack App Team
      </p>
    `;

    // Email content to admin
    const adminEmailContent = `
      <h2>📩 User Requested Subscription Cancellation</h2>
      <p>The following user has requested to cancel their subscription:</p>
      <p><strong>Username:</strong> ${user.username}</p>
      <p><strong>Email:</strong> ${user.email}</p>
      <p><strong>Package:</strong> ${user.package || 'N/A (cleared)'}</p>
      <p><strong>User Code:</strong> ${user.userCode}</p>
    `;

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: 'Your Subscription Cancellation Request',
      html: userEmailContent,
    });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: process.env.ADMIN_EMAIL,
      subject: 'User Cancellation Request - Action Needed',
      html: adminEmailContent,
    });

    res.json({ message: 'Cancellation processed. Emails sent and user updated.' });

  } catch (error) {
    console.error('Cancel Subscription Error:', error);
    res.status(500).json({ message: 'Error processing cancellation request.' });
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