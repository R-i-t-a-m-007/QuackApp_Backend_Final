import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY); // Use your Stripe secret key from the environment

export const createPaymentIntent = async (req, res) => {
  const { selectedPackageId } = req.body;

  // Define your packages (you can extend this logic to be dynamic if needed)
  const packages = [
    { id: 1, title: 'Basic Package', price: 14.95 }, // Price in EUR
    { id: 2, title: 'Premium Package', price: 29.95 },
  ];

  const selectedPackage = packages.find(pkg => pkg.id === selectedPackageId);

  if (!selectedPackage) {
    return res.status(400).json({ message: 'Invalid package selection.' });
  }

  try {
    // Create a payment intent with the package price
    const paymentIntent = await stripe.paymentIntents.create({
      amount: selectedPackage.price * 100, // Amount in cents (Stripe requires amounts in cents)
      currency: 'eur', // Currency in which the payment will be made
      description: selectedPackage.title, // Description of the package
    });

    res.status(200).json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    console.error('Payment intent creation failed:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
