// models/Job.js
import mongoose from 'mongoose';

const jobSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  location: { type: String, required: true },
  date: { type: Date, required: true },
  shift: { type: String, required: true },
  workersRequired: { type: Number, required: true },
  workers: { type: [mongoose.Schema.Types.ObjectId], ref: 'Worker', default: [] }, // Array of workers who accepted the job
  invitedWorkers: { type: [mongoose.Schema.Types.ObjectId], ref: 'Worker', default: [] }, // Array of invited workers
  jobStatus: { type: Boolean, default: false }, // Job status
  userCode: { type: String, required: true }, // User code of the creator
  createdAt: { type: Date, default: Date.now },
});

const Job = mongoose.model('Job', jobSchema);
export default Job;