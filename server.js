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
import workerRoutes from './routes/workerRoutes.js'
import stripeRoutes from './routes/stripeRoutes.js'
import jobRoutes from './routes/jobRoutes.js'; // Import job routes
import adminRoutes from './routes/adminRoutes.js';
import cron from 'node-cron';
import CompanyList from './models/CompanyList.js';
import User from './models/User.js';
import Worker from './models/Worker.js';
import Job from './models/Job.js';


dotenv.config();

// Connect to MongoDB
connectDB();

const app = express();

app.use(compression());
app.use(helmet());
app.use(mongoSanitize());


app.set('trust proxy', 1);

const allowedOrigins = [
  'https://quackapp-admin.netlify.app',
  'https://thequackapp.com',
  undefined, // for some cases like Postman or server-side requests
  'exp://',  // allow Expo Go on LAN (you might need to allow a wildcard)
  'app://',  // allow standalone Expo builds
];

// Configure session middleware
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',   // Set to true if using HTTPS
      sameSite: 'None',     // Required for cross-origin
    },
    store: MongoStore.create({ mongoUrl: process.env.MONGO_URI }),
  })
);
app.use("/healthcheck", (req,res)=>{
  res.status(200).send("ok");
});

// Configure CORS
app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests from Postman, curl, server-side
      if (!origin) return callback(null, true);

      // Check if origin is allowed
      const allowed = allowedOrigins.some(allowedOrigin =>
        origin === allowedOrigin || origin.startsWith(allowedOrigin)
      );

      if (allowed || origin.startsWith('exp://') || origin.startsWith('app://')) {
        return callback(null, true);
      }

      // Reject others
      return callback(new Error(`Not allowed by CORS: ${origin}`));
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
  })
);

// Middleware
app.use(express.json({ limit: '50mb' })); // Increase to 50 MB
app.use(express.urlencoded({ limit: '50mb', extended: true }));


// Define routes
app.use('/api/auth', authRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/workers', workerRoutes);
app.use('/api/stripe', stripeRoutes);
app.use('/api/jobs', jobRoutes); // Add job routes
app.use('/api/admin', adminRoutes);

cron.schedule('0 0 * * 0', () => {
  (async () => {
    try {
      console.log('⏱️ Running user deletion check...');
      const now = new Date();
      const usersToDelete = await User.find({ scheduledDeletion: { $lte: now } });

      for (const user of usersToDelete) {
        try {
          const userId = user._id;
          const userCode = user.userCode;

          await Worker.deleteMany({ userCode });
          await Job.deleteMany({ userCode });

          const companies = await CompanyList.find({ user: userId });
          const compCodes = companies.map(c => c.comp_code);

          await Worker.deleteMany({ userCode: { $in: compCodes } });
          await Job.deleteMany({ userCode: { $in: compCodes } });
          await CompanyList.deleteMany({ user: userId });
          await User.findByIdAndDelete(userId);

          console.log(`✅ Deleted user ${user.email} and related data`);
        } catch (innerErr) {
          console.error('❌ Error deleting user and data:', innerErr);
        }
      }
    } catch (outerErr) {
      console.error('❌ Cron job failed:', outerErr);
    }
  })();
});



       


// Start server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

