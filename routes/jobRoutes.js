// routes/jobRoutes.js
import express from 'express';
import {
  createJob,
  getJobsForWorker,
  getCompletedJobs,
  updateJobStatus,
  acceptJob,
  declineJob,
  getMyTasks,
  getJobsForUserAndCompany,
  getJobById,
  inviteWorkersToJob, // New import for inviting workers
  getInvitedJobsForWorker, // New import for fetching invited jobs
  respondToJobInvitation,
  getTotalJobCount,
  getAllJobs,
  getJobDetailsById,
  updateJob,
  deleteJob,
  removeAcceptedJob,
  getAssignedWorkersForJob, // New import for responding to job invitations
} from '../controllers/jobController.js';
import { sessionMiddleware } from '../middlewares/sessionMiddleware.js';
const router = express.Router();

router.put("/update/:id", updateJob);
router.delete("/job/:id", deleteJob);
router.get('/all-jobs', getAllJobs);
router.get('/jobs/:id', getJobDetailsById);
router.get('/total-count', getTotalJobCount);
router.post('/create', sessionMiddleware, createJob); // Route to create a job
router.get('/worker', sessionMiddleware, getJobsForWorker); // Route to fetch jobs for the logged-in worker
router.get('/completed', sessionMiddleware, getCompletedJobs); // Route to fetch completed jobs for the logged-in worker
router.put('/status/:jobId', sessionMiddleware, updateJobStatus); // Route to update job status
router.put('/accept/:jobId', sessionMiddleware, acceptJob); // Route to accept a job
router.post('/decline/:jobId', sessionMiddleware, declineJob); // Route to decline a job invitation
router.get('/mine', sessionMiddleware, getMyTasks); // Route to fetch jobs where the worker ID is in the workers array
router.get('/company', sessionMiddleware, getJobsForUserAndCompany); // New route to fetch jobs for the logged-in company
router.get('/:id', sessionMiddleware, getJobById); // New route to fetch a job by ID

// New routes for inviting workers and handling job invitations
router.post('/invite/:jobId', sessionMiddleware, inviteWorkersToJob); // Invite workers to a job
router.get('/invited-jobs', sessionMiddleware, getInvitedJobsForWorker); // Fetch jobs that a worker has been invited to
router.post('/respond-invitation', sessionMiddleware, respondToJobInvitation); // Respond to job invitation
router.put('/remove-accepted/:jobId', sessionMiddleware, removeAcceptedJob);
router.get('/assigned-workers/:jobId', getAssignedWorkersForJob);




export default router;