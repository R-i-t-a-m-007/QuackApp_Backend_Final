import mongoose from 'mongoose';

const workerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String, required: true },
  joiningDate: { type: Date, required: true },
  password: { type: String, required: true },
  availability: [{
    date: { type: Date, required: true },
    shift: { type: String, enum: ['AM', 'PM'], required: true }
  }],
  image: { type: String, default: null },
  userCode: { type: String, required: true },
  approved: { type: Boolean, default: false },
  invitedJobs: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Job' }],
  activities: { type: [{ timestamp: Date, message: String }], default: [] },
  resetToken: { type: String }, 
  resetTokenExpire: { type: Date },
  messages: [
    {
      message: { type: String, required: true },
      senderId: { type: mongoose.Schema.Types.ObjectId, required: true },
      timestamp: { type: Date, default: Date.now },
    },
  ],
  expoPushToken: { type: String, default: null }, // Add this line
});

const Worker = mongoose.model('Worker', workerSchema);
export default Worker;