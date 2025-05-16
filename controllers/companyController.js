import CompanyList from '../models/CompanyList.js';
import nodemailer from 'nodemailer';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import crypto from 'crypto';

// Helper to generate a random company code
const generateCompCode = () => `${Math.floor(1000 + Math.random() * 9000)}`;

// Function to send email using Nodemailer
const sendEmail = async (email, compCode, password) => {
  const transporter = nodemailer.createTransport({
    service: 'Gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Welcome to Our Service!',
    text: `Your company has been successfully registered. The credentials are:

Company Code: ${compCode}
Password: ${password}

Please keep these credentials safe.

Best regards,
The QuackApp Team`,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Email sent successfully');
  } catch (error) {
    console.error('Error sending email:', error);
  }
};

const sendPasswordResetEmail = async (email, name, resetLink) => {
  const transporter = nodemailer.createTransport({
    service: 'Gmail', // Use your email service
    auth: {
      user: process.env.EMAIL_USER, // Your email
      pass: process.env.EMAIL_PASS, // Your email password or app password
    },
  });

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Password Reset Request',
    text: `Hello ${name},

You requested a password reset. Click the link below to reset your password:

${resetLink}

If you did not request this, please ignore this email.

Best regards,
The QuackApp Team`,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Password reset email sent successfully to:', email);
  } catch (error) {
    console.error('Error sending password reset email:', error);
  }
};

// Function to handle company login
// Company Login Controller
export const companyLogin = async (req, res) => {
  const { compcode, password, expoPushToken } = req.body;

  try {
    const company = await CompanyList.findOne({ comp_code: compcode });
    if (!company) {
      return res.status(404).json({ message: 'Company not found.' });
    }

    const isPasswordValid = await bcrypt.compare(password, company.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid password.' });
    }

    // ✅ Save expoPushToken if provided
    if (expoPushToken) {
      company.expoPushToken = expoPushToken;
      await company.save();
    }

    // ✅ Store session
    req.session.company = {
      _id: company._id,
      name: company.name,
      email: company.email,
      userCode: company.comp_code,
    };

    res.status(200).json({ message: 'Login successful', company });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error.' });
  }
};


// Function to add a new company
export const addCompany = async (req, res) => {
  const { name, email, phone, address, country, city, postcode, password} = req.body;
  console.log(req.body);
  const expoPushToken = req.body.expoPushToken;
  console.log('Expo Push Token in Backend:', expoPushToken);
  
  try {
    // Check if the user is logged in
    const userId = req.session.user ? req.session.user.id : null;

    if (!userId) {
      return res.status(401).json({ message: 'No user logged in.' });
    }

    // Check if the company already exists by email
    const existingCompanyByEmail = await CompanyList.findOne({ email });
    if (existingCompanyByEmail) {
      return res.status(400).json({ message: 'Email already exists.' });
    }

    // Generate a unique company code
    const compCode = generateCompCode();

    // Hash the password before storing
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create a new company
    const newCompany = new CompanyList({
      name,
      email,
      phone,
      address,
      country,
      city,
      postcode,
      user: userId, // Link the company to the user
      password: hashedPassword, // Store the hashed password
      comp_code: compCode, // Store the generated company code
      expoPushToken
    });

    // Save the company in the database
    await newCompany.save();

    // Send email with registration info (plain text password for user reference)
    await sendEmail(email, compCode, password);

    res.status(201).json({ message: 'Company added successfully!', company: newCompany });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error.' });
  }
};

// Fetch the list of companies associated with the logged-in user
export const getCompanies = async (req, res) => {
  try {
    const userId = req.session.user ? req.session.user.id : null;

    if (!userId) {
      return res.status(401).json({ message: 'No user logged in.' });
    }

    // Fetch companies associated with the user
    const companies = await CompanyList.find({ user: userId });
    res.status(200).json(companies);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error.' });
  }
};

// Update company details
export const updateCompany = async (req, res) => {
  const { companyId } = req.params;
  const { name, email, phone, address, city, postcode } = req.body;
  const userId = req.session.user.id; // Get the user ID from the session

  try {
    const updatedCompany = await CompanyList.findOneAndUpdate(
      { _id: companyId, user: userId },
      { name, email, phone, address, city, postcode },
      { new: true }
    );

    if (!updatedCompany) {
      return res.status(404).json({ message: 'Company not found or you do not have permission to update it.' });
    }

    res.status(200).json(updatedCompany);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error.' });
  }
};

// Delete a company
export const deleteCompany = async (req, res) => {
  const { companyId } = req.params;

  try {
    const userId = req.session.user ? req.session.user.id : null;

    if (!userId) {
      return res.status(401).json({ message: 'No user logged in.' });
    }

    // Check if the company belongs to the user const company = await CompanyList.findOne({ _id: companyId, user: userId });
    if (!company) {
      return res.status(404).json({ message: 'Company not found or does not belong to the user.' });
    }

    // Delete the company
    await CompanyList.deleteOne({ _id: companyId });
    res.status(200).json({ message: 'Company deleted successfully.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error.' });
  }
};

// Logout function
export const logout = (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ message: 'Error logging out' });
    }

    res.status(200).json({ message: 'Logged out successfully' });
  });
};

// Get logged-in company details
export const getLoggedInCompany = async (req, res) => {
  try {
    if (!req.session.company || !req.session.company._id) {
      return res.status(401).json({ message: 'No company logged in.' });
    }

    const company = await CompanyList.findById(req.session.company._id).select('-password');

    if (!company) {
      return res.status(404).json({ message: 'Company not found.' });
    }

    res.status(200).json({ company });
  } catch (error) {
    console.error('Error fetching logged-in company:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

// Function to upload company image
export const uploadCompanyImage = async (req, res) => {
  const { companyId } = req.params;
  const { image } = req.body;

  try {
    // Ensure the company is logged in
    if (!req.session.company || req.session.company._id !== companyId) {
      return res.status(401).json({ message: 'Unauthorized access.' });
    }

    if (!image) {
      return res.status(400).json({ message: 'No image provided.' });
    }

    // Update company with the image (base64 string)
    const updatedCompany = await CompanyList.findByIdAndUpdate(
      companyId,
      { image },
      { new: true }
    );

    if (!updatedCompany) {
      return res.status(404).json({ message: 'Company not found.' });
    }

    res.status(200).json({ message: 'Image uploaded successfully.', company: updatedCompany });
  } catch (error) {
    console.error('Error uploading image:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

// Get the total number of companies
export const getCompanyCount = async (req, res) => {
  try {
    const count = await CompanyList.countDocuments();
    res.status(200).json({ count });
  } catch (error) {
    console.error('Error fetching company count:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

export const requestPasswordReset = async (req, res) => {
  const { email } = req.body;

  try {
    const company = await CompanyList.findOne({ email });
    if (!company) {
      return res.status(404).json({ message: 'User not found.' });
    }

    // Generate a reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    company.resetToken = resetToken;
    company.resetTokenExpire = Date.now() + 3600000; // Token valid for 1 hour
    await company.save();

    // Send email with reset link
    const resetLink = `https://quackapp-admin.netlify.app/reset-company-password/${resetToken}`;
    const subject = 'Password Reset Request';
    const text = `You requested a password reset. Click the link to reset your password: ${resetLink}`;

    await sendPasswordResetEmail(company.email, subject, text); // Use your sendEmail function

    res.status(200).json({ message: 'Password reset link sent to your email.' });
  } catch (error) {
    console.error('Error in requesting password reset:', error);
    res.status(500).json({ message: 'Server error while processing request.' });
  }
};

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

export const getCompaniesByUserId = async (req, res) => {
  try {
    const { userId } = req.params;

    const companies = await CompanyList.find({ user: userId });

    res.status(200).json(companies);
  } catch (error) {
    console.error('Error fetching companies by userId:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};
