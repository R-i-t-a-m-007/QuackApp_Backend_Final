import Worker from '../models/Worker.js';
import Job from '../models/Job.js'; // Import the Job model
import nodemailer from 'nodemailer';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import CompanyList from '../models/CompanyList.js'; // Import the CompanyList model
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { Expo } from 'expo-server-sdk';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const expo = new Expo();

// Function to send email to the worker with credentials
const sendWorkerEmail = async (email, name, userCode, password) => {
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
    subject: 'Welcome to the Company',
    text: `Hello ${name},

Welcome to the Quack APP!  

 
Your login credentials are: 
 
UserCode: ${userCode} 
Password: ${password}
 
Please keep these credentials safe. 
 
Your account has been created and is waiting for approval by your company. We will let you know once your account is active. 

 
We are excited to have you on board. 
 
Best regards, 
The QuackApp Team `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Email sent successfully to worker:', email);
  } catch (error) {
    console.error('Error sending email to worker:', error);
  }
};

const sendApprovalEmail = async (email, name) => {
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
    subject: 'Your Worker Registration has been Approved',
    html: `
      <p>Hello <strong>${name}</strong>,</p>

      <p>Congratulations! Your registration has been approved! You can now log in to your account using your credentials.</p>

      <p>Please refer to the previous registration email for your User Code and Password.</p>

      <p>
        For a detailed, easy-to-follow video explaining how the Quack App works, please click the link below or simply scan the QR code (don’t worry, it's only a few minutes long):
      </p>

      <p><a href="https://www.youtube.com/watch?v=P0zX9bNR3H0" target="_blank">Watch the video on YouTube</a></p>

      <p><img src="cid:quackqr" style="width: 200px; height: auto;" /></p>

      <p>Best regards,<br/>The QuackApp Team</p>
    `,
    attachments: [
      {
        filename: 'qr-code.jpg',
        path: path.join(__dirname, '../assets/qr-code.jpg'), // Adjust path as needed
        cid: 'quackqr', // Same as the cid in <img src="cid:quackqr" />
      },
    ],
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('✅ Approval email sent to worker:', email);
  } catch (error) {
    console.error('❌ Error sending approval email to worker:', error);
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

const sendAvailabilityMarkedEmail = async (worker, date, shift) => {
  try {
    const user = await User.findOne({ userCode: worker.userCode });

    let recipientEmail = null;
    let recipientName = null;

    if (user) {
      recipientEmail = user.email;
      recipientName = user.username;
    } else {
      // Fallback to company email if user is not found
      const company = await CompanyList.findOne({ comp_code: worker.userCode });
      if (!company) {
        console.log('No user or company found for availability notification.');
        return;
      }

      recipientEmail = company.email;
      recipientName = company.name || 'Company';
    }

    const transporter = nodemailer.createTransport({
      service: "Gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: recipientEmail,
      subject: "New Shift Availability Notification",
      text: `Hello ${recipientName},

Worker ${worker.name} (${worker.email}) has marked themselves available for the following shift:

📅 Date: ${new Date(date).toLocaleDateString('en-GB')}
🕒 Shift: ${shift}

They may now accept or decline jobs that match this availability.

Best regards,  
The QuackApp Team`,
    };

    await transporter.sendMail(mailOptions);
    console.log("Availability marked email sent to:", recipientEmail);
  } catch (error) {
    console.error("Error sending availability email:", error);
  }
};



const sendShiftCancellationEmail = async (worker, shiftDate, shift, affectedJobs) => {
  try {
    // Try to find the user first
    const user = await User.findOne({ userCode: worker.userCode });

    let recipientEmail = null;
    let recipientName = null;

    if (user) {
      recipientEmail = user.email;
      recipientName = user.username;
    } else {
      // If user is not found, try to find the company instead
      const company = await CompanyList.findOne({ comp_code: worker.userCode });
      if (!company) {
        console.log('No user or company found for shift cancellation notification.');
        return;
      }

      recipientEmail = company.email;
      recipientName = company.name || 'Company';
    }

    // Create Nodemailer Transporter
    const transporter = nodemailer.createTransport({
      service: "Gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: recipientEmail,
      subject: "Shift Cancellation Notice",
      text: `Hello ${recipientName},

Worker ${worker.name} (${worker.email}) has canceled their shift on ${shiftDate} (${shift}).

Affected Jobs: ${affectedJobs.length}

Please take the necessary actions.

Best Regards,  
The QuackApp Team`,
    };

    await transporter.sendMail(mailOptions);
    console.log("Shift cancellation email sent to:", recipientEmail);
  } catch (error) {
    console.error("Error sending shift cancellation email:", error);
  }
};

export const sendJobAvailableEmail = async (email, name, jobTitle, date, shift) => {
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
    subject: 'Job Now Available!',
    html: `
      <p>Hello ${name},</p>

      <p>A job that matches your company is now available for you to accept:</p>

      <ul>
        <li><strong>Job Title:</strong> ${jobTitle}</li>
        <li><strong>Date:</strong> ${date}</li>
        <li><strong>Shift:</strong> ${shift}</li>
      </ul>

      <p>Please log in to the QuackApp to view and accept the job if you're interested.</p>

      <p>Best regards,<br/>The QuackApp Team</p>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`📧 Job availability email sent to ${email}`);
  } catch (error) {
    console.error(`❌ Error sending job availability email to ${email}:`, error);
  }
};

export const sendWorkerDeletionEmail = async (user, worker, affectedJobs) => {
  try {
    // Determine recipient
    let recipientEmail = null;
    let recipientName = null;

    if (user) {
      recipientEmail = user.email;
      recipientName = user.username;
    } else {
      const company = await CompanyList.findOne({ comp_code: worker.userCode });
      if (!company) {
        console.log('No user or company found for worker deletion notification.');
        return;
      }

      recipientEmail = company.email;
      recipientName = company.name || 'Company';
    }

    // Create Nodemailer Transporter
    const transporter = nodemailer.createTransport({
      service: 'Gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    // Format affected jobs
    const formattedJobs = affectedJobs.map(job => {
      const formattedDate = new Date(job.date).toISOString().split('T')[0];
      return `• ${job.name} on ${formattedDate} (${job.shift})`;
    }).join('\n');

    // Compose mail
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: recipientEmail,
      subject: `Worker Deletion Notification - ${worker.name}`,
      text: `Hello ${recipientName},

This is to inform you that the worker "${worker.name}" (${worker.email}) has been deleted from your account.

Affected Jobs: ${affectedJobs.length}
${formattedJobs || 'No job involvement detected.'}

The jobs have been updated accordingly. Please take any necessary actions.

Best Regards,  
The QuackApp Team`,
    };

    await transporter.sendMail(mailOptions);
    console.log(`📧 Worker deletion email sent to ${recipientEmail}`);
  } catch (error) {
    console.error('Error sending worker deletion email:', error);
  }
};


// Add a new worker
export const addWorker = async (req, res) => {
  const { name, email, phone, joiningDate, password, userCode, expoPushToken } = req.body; // Add expoPushToken

  try {
    // First check if the user code exists in either User or Company collection
    const userWithCode = await User.findOne({ userCode });
    const companyWithCode = await CompanyList.findOne({ comp_code: userCode });

    if (!userWithCode && !companyWithCode) {
      return res.status(400).json({ message: 'User  /Company with this code does not exist.' });
    }

    // Check if worker already exists with this email
    const existingWorker = await Worker.findOne({ email });
    if (existingWorker) {
      return res.status(400).json({ message: 'Worker already exists with this email.' });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Additional validation for existing users/companies (if needed)
    const userId = req.session.user ? req.session.user.id : null;
    const companyId = req.session.company ? req.session.company._id : null;

    if (userId) {
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ message: 'User  not found.' });
      }
      if (user.userCode !== userCode) {
        return res.status(403).json({ message: 'User  code does not match.' });
      }
    }

    if (companyId) {
      const company = await CompanyList.findById(companyId);
      if (!company) {
        return res.status(404).json({ message: 'Company not found.' });
      }
      if (company.comp_code !== userCode) {
        return res.status(403).json({ message: 'Company code does not match.' });
      }
    }

    // Create new worker
    const newWorker = new Worker({
      name,
      email,
      phone,
      joiningDate,
      password: hashedPassword,
      userCode,
      approved: false,
      invitedJobs: [],
      expoPushToken, // Store the push token
    });

    await newWorker.save();

    // Log worker registration in activities
    newWorker.activities.push({ timestamp: new Date(), message: 'Worker registered' });
    await newWorker.save();

    // Send registration email
    await sendWorkerEmail(email, name, userCode, password);

    // Prepare notification message
    const notificationMessage = `${name} has requested to join.`;

    // Send notification to the user or company
    if (userWithCode) {
      // If the user exists, send notification to the user
      if (userWithCode.expoPushToken) {
        const notification = {
          to: userWithCode.expoPushToken,
          sound: 'default',
          body: notificationMessage,
          data: { 
            workerName: name, 
            messageContent: notificationMessage 
          },
        };

        // Send the notification
        try {
          await expo.sendPushNotificationsAsync([notification]);
        } catch (error) {
          console.error('Error sending notification to user:', error);
        }
      }
    } else if (companyWithCode) {
      // If the company exists, send notification to the company
      if (companyWithCode.expoPushToken) {
        const notification = {
          to: companyWithCode.expoPushToken,
          sound: 'default',
          body: notificationMessage,
          data: { 
            workerName: name, 
            messageContent: notificationMessage 
          },
        };

        // Send the notification
        try {
          await expo.sendPushNotificationsAsync([notification]);
        } catch (error) {
          console.error('Error sending notification to company:', error);
        }
      }
    }

    res.status(201).json({ message: 'Worker registration successful. Awaiting approval.' });
  } catch (error) {
    console.error('Error adding worker:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

// Fetch jobs that a worker has been invited to
export const getInvitedJobsForWorker = async (req, res) => {
  const workerId = req.session.worker ? req.session.worker._id : null; // Get the logged-in worker ID from the session

  if (!workerId) {
    return res.status(403).json({ message: 'Unauthorized. Worker ID is required.' });
  }

  try {
    const worker = await Worker.findById(workerId).populate('invitedJobs'); // Populate the invitedJobs field
    if (!worker) {
      return res.status(404).json({ message: 'Worker not found.' });
    }

    res.status(200).json(worker.invitedJobs); // Return the jobs the worker has been invited to
  } catch (error) {
    console.error('Error fetching invited jobs:', error);
    res.status(500).json({ message: 'Server error while fetching invited jobs.' });
  }
};


// Approve Worker
export const approveWorker = async (req, res) => {
  const { workerId } = req.params;

  try {
    const worker = await Worker.findById(workerId);
    if (!worker) {
      return res.status(404).json({ message: 'Worker not found.' });
    }

    worker.approved = true; // Set approved to true
    await worker.save();

    // Send an email to the worker notifying them of approval without credentials
    await sendApprovalEmail(worker.email, worker.name);

    // Prepare and send push notification
    if (worker.expoPushToken) {
      const notification = {
        to: worker.expoPushToken,
        sound: 'default',
        body: 'Congratulations! You have been approved.',
        data: { username: worker.name, messageContent: 'Congratulations! You have been approved.' },
      };

      // Send the notification
      try {
        let ticket = await expo.sendPushNotificationsAsync([notification]);
        console.log('Notification sent:', ticket);
      } catch (error) {
        console.error('Error sending notification:', error);
      }
    }

    res.status(200).json({ message: 'Worker approved successfully.' });
  } catch (error) {
    console.error('Error approving worker:', error);
    res.status(500).json({ message: 'Server error while approving worker.' });
  }
};

// Decline Worker
export const declineWorker = async (req, res) => {
  const { workerId } = req.params;

  try {
    const deletedWorker = await Worker.findByIdAndDelete(workerId);

    if (!deletedWorker) {
      return res.status(404).json({ message: 'Worker not found.' });
    }

    // Send a notification to the worker informing them of the decline
    if (deletedWorker.expoPushToken) {
      const notification = {
        to: deletedWorker.expoPushToken,
        sound: 'default',
        body: 'We regret to inform you that your request has been declined.',
        data: { username: deletedWorker.name, messageContent: 'Your request has been declined.' },
      };

      // Send the notification
      try {
        let ticket = await expo.sendPushNotificationsAsync([notification]);
        console.log('Notification sent:', ticket);
      } catch (error) {
        console.error('Error sending notification:', error);
      }
    }

    res.status(200).json({ message: 'Worker request declined successfully.' });
  } catch (error) {
    console.error('Error declining worker:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

// Get Workers with approved: false
export const getPendingWorkers = async (req, res) => {
  const { userCode } = req.session.user || req.session.company; // Get the logged-in user's or company's userCode

  try {
    const pendingWorkers = await Worker.find({ approved: false, userCode });

    res.status(200).json(pendingWorkers);
  } catch (error) {
    console.error('Error fetching pending workers:', error);
    res.status(500).json({ message: 'Failed to fetch pending workers.' });
  }
};

// Get Workers with approved: true
export const getApprovedWorkers = async (req, res) => {
  const { userCode } = req.session.user || req.session.company; // Get the logged-in user's or company's userCode

  try {
    const approvedWorkers = await Worker.find({ approved: true, userCode });

    res.status(200).json(approvedWorkers);
  } catch (error) {
    console.error('Error fetching approved workers:', error);
    res.status(500).json({ message: 'Failed to fetch approved workers.' });
  }
};

// Update a worker's details
export const updateWorker = async (req, res) => {
  const { workerId } = req.params;
  const { name, email, phone, role, department, address, joiningDate } = req.body;

  try {
    const worker = await Worker.findById(workerId);
    if (!worker) {
      return res.status(404).json({ message: 'Worker not found.' });
    }

    // Ensure the user or company has permission to update the worker
    const userId = req.session.user ? req.session.user.id : null;
    const companyId = req.session.company ? req.session.company._id : null;

    if (userId && worker.userCode !== req.session.user.userCode) {
      return res.status(403).json({ message: 'You do not have permission to update this worker.' });
    }

    if (companyId && worker.userCode !== req.session.company.comp_code) {
      return res.status(403).json({ message: 'You do not have permission to update this worker.' });
    }

    const updatedWorker = await Worker.findByIdAndUpdate(
      workerId,
      { name, email, phone, role, department, address, joiningDate },
      { new: true }
    );

    if (!updatedWorker) {
      return res.status(404).json({ message: 'Worker not found.' });
    }

    res.status(200).json({ message: 'Worker updated successfully!', worker: updatedWorker });
    worker.activities.push({timestamp: new Date(), message:"Worker has been updated"});
    await worker.save();
  } catch (error) {
    console.error('Error updating worker:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

// Fetch a single worker by ID
export const getWorkerById = async (req, res) => {
  try {
    const worker = await Worker.findById(req.params.id);
    if (!worker) {
      return res.status(404).json({ message: "Worker not found" });
    }
    res.json(worker);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Function to log in a worker
export const loginWorker = async (req, res) => {
  const { userCode, email, password, expoPushToken } = req.body;

  try {
    const worker = await Worker.findOne({ userCode, email });

    if (!worker) {
      return res.status(401).json({ message: 'Invalid user code, email, or password.' });
    }

    if (!worker.approved) {
      return res.status(403).json({ message: 'Your account is not approved yet. Please contact support.' });
    }

    const isMatch = await bcrypt.compare(password, worker.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid user code, email, or password.' });
    }

    // Update expoPushToken and activities using findByIdAndUpdate
    const updates = {};

    if (expoPushToken) {
      updates.expoPushToken = expoPushToken;
    }

    // Add a new activity for login
    updates.$push = { activities: { timestamp: new Date(), message: "Worker has logged in" } };

    await Worker.findByIdAndUpdate(worker._id, updates);

    // Set session (optional, if still using sessions in web version)
    req.session.worker = { _id: worker._id, userCode: worker.userCode };

    // Generate JWT token
    const payload = { id: worker._id, userCode: worker.userCode };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });

    // Send response with token and worker data
    const updatedWorker = await Worker.findById(worker._id); // fetch latest worker
    res.status(200).json({ token, message: 'Login successful.', worker: updatedWorker });
    
  } catch (error) {
    console.error('Error logging in worker:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};


// Update worker's availability
export const updateWorkerAvailability = async (req, res) => {
  const { workerId } = req.params;
  const { date, shift } = req.body;

  try {
    if (!req.session.worker || req.session.worker._id !== workerId) {
      return res.status(401).json({ message: 'Unauthorized access.' });
    }

    const updatedWorker = await Worker.findByIdAndUpdate(
      workerId,
      { $push: { availability: { date, shift } } },
      { new: true }
    );

    if (!updatedWorker) {
      return res.status(404).json({ message: 'Worker not found.' });
    }

    // Log activity
    updatedWorker.activities.push({
      timestamp: new Date(),
      message: `Worker marked availability for ${new Date(date).toLocaleDateString('en-GB')} (${shift})`,
    });

    await updatedWorker.save();

    // ✉️ Send email notification
    try {
      await sendAvailabilityMarkedEmail(updatedWorker, date, shift);
    } catch (emailError) {
      console.error('❌ Error sending availability email:', emailError);
    }

    // 🔔 Send push notification to admin (user or company)
    let expoPushToken = null;

    const user = await User.findOne({ userCode: updatedWorker.userCode });
    if (user?.expoPushToken) {
      expoPushToken = user.expoPushToken;
    } else {
      const company = await CompanyList.findOne({ comp_code: updatedWorker.userCode });
      if (company?.expoPushToken) {
        expoPushToken = company.expoPushToken;
      }
    }

    if (expoPushToken) {
      const notification = {
        to: expoPushToken,
        sound: 'default',
        body: `${updatedWorker.name} is available on ${new Date(date).toLocaleDateString('en-GB')} for the ${shift} shift.`,
        data: {
          username: updatedWorker.name,
          messageContent: `${updatedWorker.name} has marked themselves available on ${new Date(date).toLocaleDateString('en-GB')} for the ${shift} shift.`
        },
      };

      try {
        let ticket = await expo.sendPushNotificationsAsync([notification]);
        console.log('📲 Push notification sent:', ticket);
      } catch (pushError) {
        console.error('❌ Error sending push notification:', pushError);
      }
    } else {
      console.log('ℹ️ No Expo Push Token available in user or company. Skipping push notification.');
    }

    res.status(200).json({ message: 'Worker availability updated successfully.', worker: updatedWorker });
  } catch (error) {
    console.error('❌ Error updating worker availability:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};


// Logout worker
export const logoutWorker = async (req, res) => {
  const workerId = req.session.worker ? req.session.worker._id: null;

  try {
    if (!req.session.worker) {
      return res.status(401).json({ message: 'No worker logged in.' });
    }

    req.session.destroy(async (err) => {
      if (err) {
        console.error('Error during logout:', err);
        return res.status(500).json({ message: 'Logout failed.' });
      }
      if(workerId){
        try{
          const worker = await Worker.findById(workerId);
          if(worker){
            worker.activities.push({timestamp: new Date(), message:"Worker has logged out"});
            await worker.save();
          }
        }
        catch(error){
          console.error('Error logging activity on logout:', error);
        }
      }

      res.clearCookie('connect.sid'); // Clear session cookie
      res.status(200).json({ message: 'Logged out successfully.' });
      
    });
  } catch (error) {
    console.error('Error during logout:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

// Get logged-in worker details
export const getLoggedInWorker = async (req, res) => {
  try {
    if (!req.session.worker || !req.session.worker._id) {
      return res.status(401).json({ message: 'No worker logged in.' });
    }

    const workerId = req.session.worker._id;

    const worker = await Worker.findById(workerId);

    if (!worker) {
      return res.status(404).json({ message: 'Worker not found.' });
    }

    res.status(200).json(worker);
  } catch (error) {
    console.error('Error fetching logged-in worker:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

// Upload worker image
export const uploadWorkerImage = async (req, res) => {
  const { workerId } = req.params;
  const { image } = req.body;

  try {
    if (!req.session.worker || req.session.worker._id !== workerId) {
      return res.status(401).json({ message: 'Unauthorized access.' });
    }

    if (!image) {
      return res.status(400).json({ message: 'No image provided.' });
    }

    const updatedWorker = await Worker.findByIdAndUpdate(
      workerId,
      { image },
      { new: true }
    );

    if (!updatedWorker) {
      return res.status(404).json({ message: 'Worker not found.' });
    }

    res.status(200).json({ message: 'Image uploaded successfully.', worker: updatedWorker });
  } catch (error) {
    console.error('Error uploading image:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

// Fetch workers based on shift and date
export const getWorkersByShiftAndDate = async (req, res) => {
  const { date, shift } = req.query; // Expecting date and shift as query parameters

  try {
    const parsedDate = new Date(date);
    if (isNaN(parsedDate.getTime())) {
      return res.status(400).json({ message: 'Invalid date format.' });
    }

    // Get the userCode from the session
    const userCode = req.session.user ? req.session.user.userCode : req.session.company ? req.session.company.userCode : null;

    if (!userCode) {
      return res.status(403).json({ message: 'Unauthorized access. No user or company logged in.' });
    }

    // Find workers based on availability and userCode
    const workers = await Worker.find({
      availability: {
        $elemMatch: {
          date: parsedDate,
          shift: shift,
        },
      },
      userCode: userCode, // Filter by userCode
    });

    res.status(200).json(workers);
  } catch (error) {
    console.error('Error fetching workers by shift and date:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

// Fetch worker availability
export const getWorkerAvailability = async (req, res) => {
  const { workerId } = req.params;

  try {
    if (!req.session.worker || req.session.worker._id !== workerId) {
      return res.status(401).json({ message: 'Unauthorized access.' });
    }

    const worker = await Worker.findById(workerId);
    if (!worker) {
      return res.status(404).json({ message: 'Worker not found.' });
    }

    res.status(200).json(worker.availability); // Assuming availability is an array of objects with date and shift
  } catch (error) {
    console.error('Error fetching worker availability:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

export const getAllWorkers = async (req, res) => {
  try {
    // Fetching all workers from the database
    const workers = await Worker.find().select('-password');;  // Adjust this to filter or paginate if needed

    // Sending the workers data as response
    return res.status(200).json(workers);
  } catch (error) {
    console.error("Error fetching workers:", error);
    return res.status(500).json({ message: "Failed to fetch workers" });
  }
};

export const updateWorkerDetails = async (req, res) => {
  const { workerId } = req.params;
  console.log("Worker ID received on the server:", workerId);  // Debugging line
  const { name, email, phone } = req.body;
  
  try {
    // Find the worker by their ID
    const worker = await Worker.findById(workerId);
    if (!worker) {
      return res.status(404).json({ message: "Worker not found" });
    }

    // Update fields as usual
    worker.name = name || worker.name;
    worker.email = email || worker.email;
    worker.phone = phone || worker.phone;

    await worker.save(); // Save the updated worker
    worker.activities.push({timestamp: new Date(), message:"Worker has been updated"});
    await worker.save();

    return res.status(200).json({ message: "Worker details updated successfully" });
    
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

export const deleteWorker = async (req, res) => {
  const { workerId } = req.params;

  try {
    const worker = await Worker.findById(workerId);
    if (!worker) {
      return res.status(404).json({ message: 'Worker not found' });
    }

    const userCode = worker.userCode;
    const user = await User.findOne({ userCode });

    if (!user) {
      return res.status(404).json({ message: 'Associated user not found' });
    }

    const invitedJobs = await Job.find({
      $or: [{ invitedWorkers: workerId }, { workers: workerId }],
    });

    const affectedJobs = [];

    for (const job of invitedJobs) {
      job.invitedWorkers = job.invitedWorkers.filter(id => id.toString() !== workerId);
      job.workers = job.workers.filter(id => id.toString() !== workerId);

      const jobWasFilled = job.jobStatus;

      if (job.workers.length < job.workersRequired) {
        job.jobStatus = false;
      }

      await job.save();

      affectedJobs.push({
        name: job.name || 'Unnamed Job',
        date: job.date,
        shift: job.shift,
      });

      // 🔔 If job became available again after worker deletion
      if (jobWasFilled && !job.jobStatus) {
        const formattedDate = new Date(job.date).toISOString().split("T")[0];

        const workersToNotify = await Worker.find({ userCode: job.userCode });

        for (const eligibleWorker of workersToNotify) {
          // 📬 Push notification
          if (eligibleWorker.expoPushToken) {
            const notification = {
              to: eligibleWorker.expoPushToken,
              sound: 'default',
              body: `A job "${job.title}" on ${formattedDate} (${job.shift}) is now available!`,
              data: {
                jobId: job._id.toString(),
                messageContent: `A job "${job.title}" on ${formattedDate} (${job.shift}) is now available.`,
              },
            };

            try {
              await expo.sendPushNotificationsAsync([notification]);
              console.log(`📢 Sent availability notification to ${eligibleWorker.name}`);
            } catch (err) {
              console.error(`❌ Error notifying ${eligibleWorker.name}:`, err);
            }
          }

          // 📧 Email
          try {
            await sendJobAvailableEmail(
              eligibleWorker.email,
              eligibleWorker.name,
              job.title,
              formattedDate,
              job.shift
            );
          } catch (emailErr) {
            console.error(`❌ Error sending email to ${eligibleWorker.email}:`, emailErr);
          }
        }
      }
    }

    await Worker.findByIdAndDelete(workerId);

    await sendWorkerDeletionEmail(user, worker, affectedJobs);

    res.status(200).json({
      message: 'Worker deleted successfully and affected jobs updated.',
      affectedJobs,
    });
  } catch (error) {
    console.error('Error deleting worker:', error);
    res.status(500).json({ message: 'Failed to delete worker.' });
  }
};


export const requestWorkerPasswordReset = async (req, res) => {
  const { email } = req.body;

  try {
    const worker = await Worker.findOne({ email });
    if (!worker) {
      return res.status(404).json({ message: 'Worker not found.' });
    }

    // Generate a reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    worker.resetToken = resetToken;
    worker.resetTokenExpire = Date.now() + 3600000; // Token valid for 1 hour
    await worker.save();

    // Send email with reset link
    const resetLink = `https://quackapp-admin.netlify.app/reset-password-worker/${resetToken}`;
    const subject = 'Password Reset Request';
    const text = `You requested a password reset. Click the link to reset your password: ${resetLink}`;

    await sendPasswordResetEmail(worker.email, subject, text);

    res.status(200).json({ message: 'Password reset link sent to your email.' });
  } catch (error) {
    console.error('Error in requesting password reset:', error);
    res.status(500).json({ message: 'Server error while processing request.' });
  }
};

// Reset Password
export const resetWorkerPassword = async (req, res) => {
  const { token, newPassword } = req.body;

  try {
    const worker = await Worker.findOne({ resetToken: token, resetTokenExpire: { $gt: Date.now() } });

    if (!worker) {
      return res.status(400).json({ message: 'Invalid or expired token.' });
    }

    // Hash the new password
    worker.password = await bcrypt.hash(newPassword, 10);
    worker.resetToken = undefined; // Clear reset token
    worker.resetTokenExpire = undefined; // Clear expiration
    await worker.save();

    res.status(200).json({ message: 'Password has been reset successfully.' });
  } catch (error) {
    console.error('Error in resetting password:', error);
    res.status(500).json({ message: 'Server error while resetting password.' });
  }
};

export const sendMessageToWorkers = async (req, res) => {
  try {
    const { message } = req.body;

    const sender = req.session.user || req.session.company;
    if (!sender) {
      return res.status(401).json({ message: 'Unauthorized. Please log in.' });
    }
    console.log('Sender:', sender); // Should show the logged-in user or company with _id


    if (!message) {
      return res.status(400).json({ message: 'Message cannot be empty' });
    }

    const userCode = sender.userCode || sender.comp_code;
    const username = sender.username || sender.name;

    const workers = await Worker.find({ userCode });

    if (workers.length === 0) {
      return res.status(404).json({ message: 'No workers found with this code' });
    }

    const notifications = [];
    const notifiedTokens = new Set(); // To avoid sending duplicate notifications

    await Promise.all(workers.map(async (worker) => {
      // Update each worker's messages
      await Worker.findByIdAndUpdate(worker._id, {
        $push: { messages: { message, senderId: sender._id, timestamp: new Date() } },
      });
      console.log("Message to push:", {
        message: message,
        senderId: sender._id,
        timestamp: new Date()
      });

      // Prepare notification if token exists and not already notified
      const token = worker.expoPushToken;
      if (token && !notifiedTokens.has(token)) {
        notifiedTokens.add(token);
        notifications.push({
          to: token,
          sound: 'default',
          body: `New message from ${username}: ${message}`,
          data: { username: username, messageContent: message },
        });
      }
    }));

    // Send notifications
    const chunks = expo.chunkPushNotifications(notifications);
    for (let chunk of chunks) {
      try {
        await expo.sendPushNotificationsAsync(chunk);
      } catch (error) {
        console.error('Error sending notifications:', error);
      }
    }

    res.status(200).json({ message: 'Message sent successfully to all workers.' });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};


export const getWorkerMessages = async (req, res) => {
  try {
    const { workerId } = req.params;

    // Fetch worker using workerId from the URL params
    const worker = await Worker.findOne({ userCode: workerId }).select('messages');

    if (!worker) {
      return res.status(404).json({ message: 'Worker not found' });
    }

    res.status(200).json({ messages: worker.messages || [] });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const cancelShiftForWorker = async (req, res) => {
  try {
    const { workerId, date, shift } = req.body;

    if (!workerId || !date || !shift) {
      return res.status(400).json({ message: "Worker ID, date, and shift are required." });
    }

    const shiftDate = new Date(date);
    if (isNaN(shiftDate)) {
      return res.status(400).json({ message: "Invalid date format." });
    }

    const formattedShiftDate = shiftDate.toISOString().split("T")[0];

    // Find Worker
    const worker = await Worker.findById(workerId);
    if (!worker) {
      return res.status(404).json({ message: "Worker not found." });
    }

    // Remove Shift from Availability
    const initialLength = worker.availability.length;
    worker.availability = worker.availability.filter(
      (slot) => new Date(slot.date).toISOString().split("T")[0] !== formattedShiftDate || slot.shift !== shift
    );

    if (worker.availability.length === initialLength) {
      return res.status(400).json({ message: "Shift not found in worker's availability." });
    }

    // Find Jobs Associated with Worker
    const jobs = await Job.find({ $or: [{ workers: workerId }, { invitedWorkers: workerId }] });
    let affectedJobs = [];

    for (const job of jobs) {
      if (new Date(job.date).toISOString().split("T")[0] === formattedShiftDate && job.shift === shift) {
        worker.invitedJobs = worker.invitedJobs.filter(id => id.toString() !== job._id.toString());

        job.workers = job.workers.filter(id => id.toString() !== workerId);
        job.invitedWorkers = job.invitedWorkers.filter(id => id.toString() !== workerId);

        // Track previous status
        const jobWasFilled = job.jobStatus;

        // Update job status
        job.jobStatus = job.workers.length >= job.workersRequired;
        await job.save();
        affectedJobs.push(job._id);

        // 🔔 Notify all workers with matching userCode if job became available again
        if (jobWasFilled && !job.jobStatus) {
          const allWorkers = await Worker.find({ userCode: job.userCode });

          for (const w of allWorkers) {
            // Push Notification
            if (w.expoPushToken) {
              const notification = {
                to: w.expoPushToken,
                sound: 'default',
                body: `Job "${job.title}" on ${formattedShiftDate} (${shift}) is now available!`,
                data: {
                  jobId: job._id.toString(),
                  messageContent: `Job "${job.title}" on ${formattedShiftDate} (${shift}) is now available.`,
                },
              };

              try {
                await expo.sendPushNotificationsAsync([notification]);
                console.log(`📢 Sent availability notification to ${w.name}`);
              } catch (err) {
                console.error(`❌ Error notifying ${w.name}:`, err);
              }
            }

            // Email Notification
            try {
              await sendJobAvailableEmail(
                w.email,
                w.name,
                job.title,
                formattedShiftDate,
                shift
              );
            } catch (err) {
              console.error(`📧 Failed to send availability email to ${w.email}:`, err);
            }
          }
        }
      }
    }

    // Log Activity
    worker.activities.push({
      timestamp: new Date(),
      message: `Worker canceled shift on ${formattedShiftDate} (${shift}) and was removed from ${affectedJobs.length} jobs.`,
    });

    await worker.save();

    // Send cancellation email to admin/user
    await sendShiftCancellationEmail(worker, new Date(formattedShiftDate).toLocaleDateString('en-GB'), shift, affectedJobs);

    // Notify user who owns the worker
    const user = await User.findOne({ userCode: worker.userCode });
    if (user && user.expoPushToken) {
      const notification = {
        to: user.expoPushToken,
        sound: 'default',
        body: `${worker.name} has canceled their availability for ${formattedShiftDate} (${shift}).`,
        data: {
          username: worker.name,
          messageContent: `${worker.name} has canceled their availability for ${formattedShiftDate} (${shift}).`
        },
      };

      try {
        let ticket = await expo.sendPushNotificationsAsync([notification]);
        console.log('📨 Notification sent to user:', ticket);
      } catch (error) {
        console.error('❌ Error sending notification to user:', error);
      }
    }

    res.status(200).json({
      message: `Shift canceled successfully. Updated ${affectedJobs.length} jobs.`,
      affectedJobs,
    });
  } catch (error) {
    console.error("❌ Error canceling shift:", error);
    res.status(500).json({ message: "Server error while canceling shift." });
  }
};



export const getWorkerShifts = async (req, res) => {
  try {
    // Ensure the worker is logged in
    if (!req.session.worker || !req.session.worker._id) {
      return res.status(401).json({ message: 'No worker logged in.' });
    }

    const workerId = req.session.worker._id;

    // Fetch worker from database
    const worker = await Worker.findById(workerId).select('availability'); // Only fetch availability field

    if (!worker) {
      return res.status(404).json({ message: 'Worker not found.' });
    }

    // Send worker's availability data
    res.status(200).json(worker.availability);
  } catch (error) {
    console.error('Error fetching worker shifts:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

export const getWorkersByUserCode = async (req, res) => {
  const { userCode } = req.params;

  try {
    const workers = await Worker.find({ userCode });
    res.status(200).json(workers);
  } catch (error) {
    console.error("Error fetching workers by userCode:", error);
    res.status(500).json({ message: "Failed to fetch workers." });
  }
};
