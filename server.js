import express from 'express';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import mongoSanitize from 'express-mongo-sanitize';
import helmet from 'helmet';
import cors from 'cors';
import dotenv from 'dotenv';
import session from 'express-session';
import MongoStore from 'connect-mongo';

import connectDB from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import companyRoutes from './routes/companyRoutes.js';
import workerRoutes from './routes/workerRoutes.js';
import stripeRoutes from './routes/stripeRoutes.js';
import jobRoutes from './routes/jobRoutes.js';
import adminRoutes from './routes/adminRoutes.js';

dotenv.config();

// Connect to MongoDB
connectDB();

const app = express();

// Security & performance middleware
app.use(compression());
app.use(helmet());
app.use(mongoSanitize());

// Trust proxy for HTTPS (important on Render or behind reverse proxies)
app.set('trust proxy', 1);

// Session configuration
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24, // 1 day
      httpOnly: true,
      secure: true, // HTTPS only (important for Android WebView + SameSite=None)
      sameSite: 'None',
    },
    store: MongoStore.create({ mongoUrl: process.env.MONGO_URI }),
  })
);

// Health check
app.get('/healthcheck', (req, res) => {
  res.status(200).send('ok');
});

// Allow cross-origin requests
const allowedOrigins = [
  'https://quackapp-admin.netlify.app',
  'https://thequackapp.com',
  undefined,
  'exp://',
  'app://',
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (
        !origin ||
        origin === 'null' ||
        allowedOrigins.includes(origin) ||
        (origin && origin.startsWith('exp://')) ||
        (origin && origin.startsWith('app://'))
      ) {
        callback(null, true);
      } else {
        console.log('Blocked CORS origin:', origin);
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true, // Send cookies across domains
  })
);

// JSON & URL-encoded middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/workers', workerRoutes);
app.use('/api/stripe', stripeRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/admin', adminRoutes);

// Start server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
