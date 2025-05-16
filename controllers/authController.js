import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import nodemailer from 'nodemailer';
import crypto from 'crypto';
import stripeLib from 'stripe';
import dotenv from 'dotenv';
import Worker from '../models/Worker.js';
import Job from '../models/Job.js';
import CompanyList from '../models/CompanyList.js';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'; // v3 SDK imports
import { v4 as uuidv4 } from 'uuid';

const region = process.env.AWS_REGION || 'us-east-1';
const s3 = new S3Client({ region }); // Create the S3 client

dotenv.config();
const stripe = stripeLib(process.env.STRIPE_SECRET_KEY);

// Function to send emails
const sendEmail = async (to, subject, text) => {
  const transporter = nodemailer.createTransport({
    service: 'gmail', // Use your email service
    auth: {
      user: process.env.EMAIL_USER, // Your email
      pass: process.env.EMAIL_PASS, // Your email password or app password
    },
  });

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to,
    subject,
    text,
  };

  return transporter.sendMail(mailOptions);
};

// Function to generate a random user code
const generateUserCode = () => {
  const randomNum = Math.floor(1000 + Math.random() * 9000); // Generate a random number between 1000 and 9999
  return `${randomNum}`; // Format the user code
};

// Register User
export const registerUser  = async (req, res) => {
  const { username, email, phone, password, expoPushToken } = req.body; // Add expoPushToken

  try {
    // Check if username or email already exists
    const existingUsername = await User.findOne({ username });
    const existingEmail = await User.findOne({ email });

    if (existingUsername) {
      return res.status(400).json({ message: 'Username already exists.' });
    }

    if (existingEmail) {
      return res.status(400).json({ message: 'Email already exists.' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate user code
    const userCode = generateUserCode();

    // Create a new customer in Stripe
    const customer = await stripe.customers.create({
      email: email,
      name: username,
      phone: phone,
    });

    // Create new user
    const newUser  = new User({
      username,
      email,
      phone,
      password: hashedPassword,
      userCode,
      subscribed: true,
      stripeCustomerId: customer.id, // Store the Stripe customer ID
      expoPushToken, // Store the push token
    });

    await newUser .save();

    // Add activity log
    newUser .activities.push({ timestamp: new Date(), message: 'User  registered' });
    await newUser .save();

    // Set session for the newly registered user
    req.session.user = { id: newUser ._id, username: newUser .username };

    // Send a welcome email
    const subject = 'Successful Registration';
    const text = `Dear ${username},

Thank you for registering. We are thrilled to have you as part of our community.
    
Your account credentials are:
- Username: ${username}
- Password: ${password}
- User Code: ${userCode}

Please ensure to keep this information secure. Feel free to reach out to our support team if you need assistance.

Warm regards,  
The QuackApp Team`;

    await sendEmail(email, subject, text);

    return res.status(200).json({ message: 'Registration successful', user: req.session.user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Registration failed. Please try again later.' });
  }
};


// Login User
export const loginUser  = async (req, res) => {
  const { username, password, expoPushToken } = req.body; // Add expoPushToken

  try {
    // Find the user by username
    const user = await User.findOne({ username });

    if (!user) {
      return res.status (400).json({ message: 'Invalid credentials.' });
    }

    // Compare passwords
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials.' });
    }

    // Update the user's push token if provided
    if (expoPushToken) {
      user.expoPushToken = expoPushToken;
      await user.save();
    }

    // Set session
    req.session.user = { id: user._id, username: user.username, userCode: user.userCode };
    user.activities.push({ timestamp: new Date(), message: 'User  logged in' });
    await user.save();

    // Generate JWT
    const payload = { id: user._id, username: user.username, userCode: user.userCode };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });

    res.json({ token, message: 'Login successful!', user: req.session.user });
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

// Logout User
export const logoutUser  = async (req, res) => {
  const userId = req.session.user ? req.session.user.id : null; // Get user ID from session

  req.session.destroy(async (err) => {
    if (err) {
      console.error('Error destroying session:', err);
      return res.status(500).json({ message: 'Error logging out.' });
    }

    if (userId) {
      try {
        // Find the user by ID
        const user = await User.findById(userId);
        if (user) {
          // Log activity
          user.activities.push({ timestamp: new Date(), message: 'User  logged out' });
          await user.save(); // Save the updated user with the new activity
        }
      } catch (error) {
        console.error('Error logging activity on logout:', error);
      }
    }

    res.clearCookie('connect.sid'); // Clear the session cookie
    res.status(200).json({ message: 'Logout successful.' });
  });
};

// Get Logged In User
export const getLoggedInUser  = async (req, res) => {
  try {
    if (!req.session.user || !req.session.user.id) {
      return res.status(401).json({ message: 'No user logged in' });
    }

    const user = await User.findById(req.session.user.id).select('-password'); // Exclude password

    if (!user) {
      return res.status(404).json({ message: 'User  not found' });
    }

    res.status(200).json({ user });
  } catch (error) {
    console.error('Error fetching user data:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Store Selected Package
export const storeSelectedPackage = async (req, res) => {
  const { packageName } = req.body;

  try {
    if (!req.session.user || !req.session.user.id) {
      return res.status(401).json({ message: 'No user logged in' });
    }

    const user = await User.findById(req.session.user.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.package = packageName;

    // Set the price based on the package
    if (packageName === 'Basic') {
      user.price = 14.95;
    } else if (packageName === 'Pro') {
      user.price = 29.95;
    }

    await user.save();

    res.status(200).json({ message: 'Package selection saved successfully.' });
  } catch (error) {
    console.error('Error saving package:', error);
    res.status(500).json({ message: 'Failed to save package.' });
  }
};

// Request OTP for Password Reset
export const requestOtp  = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: 'Email not found.' });
    }

    // Generate a 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.otp = otp;
    user.otpExpire = Date.now() + 3600000; // OTP valid for 1 hour
    await user.save();

    // Send OTP to user's email
    const subject = 'Your OTP for Password Reset';
    const text = `Your OTP is: ${otp}. It is valid for 1 hour.`;
    await sendEmail(email, subject, text);

    res.status(200).json({ message: 'OTP sent to your email.' });
  } catch (error) {
    console.error('Error in sending OTP:', error);
    res.status(500).json({ message: 'Server error. Please try again later.' });
  }
};

export const getSessionData  = (req, res) => {
  if (req.session.user) {
    return res.status(200).json({ user: req.session.user });
  } else {
    return res.status(401).json({ message: 'No user logged in' });
  }
};

// Update User Package
export const updateUserPackage = async (req, res) => {
  const { newPackage } = req.body;

  try {
    if (!req.session.user || !req.session.user.id) {
      return res.status(401).json({ message: 'No user logged in' });
    }

    const user = await User.findById(req.session.user.id);

    if (!user) {
      return res.status(404).json({ message: 'User  not found' });
    }

    // Allow upgrade only from Basic to Pro
    if (user.package === 'Basic' && newPackage === 'Pro') {
      user.package = newPackage;
      user.price = 29.95; // Update price for Pro package

      await user.save();
      user.activities.push({ timestamp: new Date(), message: 'User  updated their package' });
      await user.save();

      return res.status(200).json({ message: 'Package updated successfully.', user });
    } else {
      return res.status(400).json({ message: 'Package update is only allowed from Basic to Pro.' });
    }
  } catch (error) {
    console.error('Error updating package:', error);
    res.status(500).json({ message: 'Failed to update package.' });
  }
};

// Function to upload user image
export const uploadUserImage = async (req, res) => {
  const { userId } = req.params;
  const { image } = req.body;

  try {
    if (!req.session?.user || req.session.user.id !== userId) {
      return res.status(401).json({ message: 'Unauthorized access.' });
    }

    if (!image) {
      return res.status(400).json({ message: 'No image provided.' });
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { image },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found.' });
    }

    res.status(200).json({ message: 'Image uploaded successfully.', user: updatedUser });
  } catch (error) {
    console.error('Error uploading image:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};


// Get All Users
export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password -otp -otpExpire'); // Exclude sensitive fields

    res.status(200).json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

export const updateUserDetails = async (req, res) => {
  const { userId } = req.params;
  const { username, email, phone } = req.body;
  console.log("Received userId:", userId); 
  
  try {
    // Find the user by their ID
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update the user's details with the correct field names
    user.username = username || user.username;
    user.email = email || user.email;
    user.phone = phone || user.phone;

    await user.save(); // Save the updated user
    user.activities.push({ timestamp: new Date(), message: 'User  updated their details' });
    await user.save();

    return res.status(200).json({ message: 'User details updated successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Delete User
export const deleteUser = async (req, res) => {
  const { userId } = req.params;

  try {
    // Find the user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const userCode = user.userCode;

    // Delete the user
    await User.findByIdAndDelete(userId);

    // Delete all workers associated with the user
    const deletedWorkersFromUser = await Worker.deleteMany({ userCode });

    // Delete all jobs associated with the user
    const deletedJobs = await Job.deleteMany({ userCode });

    // Find all companies created by this user
    const companiesToDelete = await CompanyList.find({ user: userId });
    const compCodes = companiesToDelete.map(company => company.comp_code);

    // Delete companies
    const deletedCompanies = await CompanyList.deleteMany({ user: userId });

    // Delete workers whose userCode matches deleted company codes
    const deletedWorkersFromCompanies = await Worker.deleteMany({ userCode: { $in: compCodes } });

    res.status(200).json({
      message: 'User, associated workers, jobs, and companies deleted successfully.',
      deletedWorkersFromUser: deletedWorkersFromUser.deletedCount,
      deletedJobs: deletedJobs.deletedCount,
      deletedCompanies: deletedCompanies.deletedCount,
      deletedWorkersFromCompanies: deletedWorkersFromCompanies.deletedCount
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ message: 'Failed to delete user and associated data.' });
  }
};




export const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

export const getTotalPrice = async (req, res) => {
  try {
    const total = await User.aggregate([
      { 
        $group: { 
          _id: null, 
          totalPrice: { $sum: "$price" } 
        } 
      },
      {
        $project: {
          totalPrice: { $round: ["$totalPrice", 2] }
        }
      }
    ]);

    const roundedTotal = total[0]?.totalPrice || 0;
    res.status(200).json({ totalPrice: roundedTotal });
  } catch (error) {
    console.error('Error calculating total price:', error);
    res.status(500).json({ message: 'Failed to calculate total price.' });
  }
};

// Request Password Reset
export const requestPasswordReset = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    // Generate a reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetToken = resetToken;
    user.resetTokenExpire = Date.now() + 3600000; // Token valid for 1 hour
    await user.save();

    // Send email with reset link
    const resetLink = `https://quackapp-admin.netlify.app/reset-password/${resetToken}`;
    const subject = 'Password Reset Request';
    const text = `You requested a password reset. Click the link to reset your password: ${resetLink}`;

    await sendEmail(user.email, subject, text); // Use your sendEmail function

    res.status(200).json({ message: 'Password reset link sent to your email.' });
  } catch (error) {
    console.error('Error in requesting password reset:', error);
    res.status(500).json({ message: 'Server error while processing request.' });
  }
};

// Reset Password
export const resetPassword = async (req, res) => {
  const { token, newPassword } = req.body;

  try {
    const user = await User.findOne({ resetToken: token, resetTokenExpire: { $gt: Date.now() } });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired token.' });
    }

    // Hash the new password
    user.password = await bcrypt.hash(newPassword, 10);
    user.resetToken = undefined; // Clear reset token
    user.resetTokenExpire = undefined; // Clear expiration
    await user.save();

    res.status(200).json({ message: 'Password has been reset successfully.' });
  } catch (error) {
    console.error('Error in resetting password:', error);
    res.status(500).json({ message: 'Server error while resetting password.' });
  }
};

export const cancelSubscription = async (req, res) => {
  try {
    if (!req.session.user || !req.session.user.id) {
      return res.status(401).json({ message: 'No user logged in' });
    }

    const user = await User.findById(req.session.user.id);

    if (!user) {
      return res.status(404).json({ message: 'User  not found' });
    }

    // Set subscribed to false
    user.subscribed = false;
    await user.save();

    return res.status(200).json({ message: 'Subscription canceled successfully.', user });
  } catch (error) {
    console.error('Error canceling subscription:', error);
    res.status(500).json({ message: 'Failed to cancel subscription.' });
  }
};

export const getCustomerId = async (req, res) => {
  try {
    // Check if the user is authenticated
    if (!req.session.user || !req.session.user.id) {
      return res.status(401).json({ error: 'User  not authenticated.' });
    }

    const userId = req.session.user.id; // Get the user ID from the session
    const user = await User.findById(userId); // Find the user in the database

    if (!user || !user.stripeCustomerId) {
      return res.status(404).json({ error: 'Customer ID not found.' });
    }

    // Return the customer ID
    res.status(200).json({ customerId: user.stripeCustomerId });
  } catch (error) {
    console.error('Error retrieving customer ID:', error);
    res.status(500).json({ error: 'Failed to retrieve customer ID.' });
  }
};

export const generatePresignedUrl = async (req, res) => {
  try {
    const { fileType } = req.body;

    if (!fileType) {
      return res.status(400).json({ error: 'File type is required' });
    }

    const fileExtension = fileType.split('/')[1];
    const fileName = `profile-images/${uuidv4()}.${fileExtension}`;

    // Use S3 pre-signed URL generation with v3 SDK
    const params = {
      Bucket: 'quackapp-images', // your bucket name
      Key: fileName,
      Expires: 60, // expires in 60 seconds
      ContentType: fileType,
      ACL: 'public-read',
    };

    // Generate the pre-signed URL
    const command = new PutObjectCommand(params); // Create a PutObjectCommand
    const uploadURL = await s3.getSignedUrl(command, { expiresIn: 60 }); // Use getSignedUrl method

    return res.status(200).json({
      uploadURL,
      key: fileName,
      url: `https://${params.Bucket}.s3.amazonaws.com/${fileName}`,
    });
  } catch (error) {
    console.error('Error generating pre-signed URL:', error);
    return res.status(500).json({ error: 'Failed to generate upload URL' });
  }
};

export const updateUserImage = async (req, res) => {
  try {
    const { userId } = req.params; // or from req.user if using auth
    const { imageUrl } = req.body;

    if (!imageUrl) {
      return res.status(400).json({ error: 'Image URL is required' });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { image: imageUrl },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.status(200).json({ message: 'Image updated successfully', user });
  } catch (error) {
    console.error('Failed to update user image:', error);
    res.status(500).json({ error: 'Failed to update user image' });
  }
};