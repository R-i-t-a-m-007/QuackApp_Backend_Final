import express from 'express';
import { registerUser , loginUser , getLoggedInUser , logoutUser , requestOtp, storeSelectedPackage,getSessionData,updateUserPackage, uploadUserImage, getAllUsers, updateUserDetails, deleteUser, getUserById, getTotalPrice, requestPasswordReset, resetPassword, cancelSubscription, getCustomerId, generatePresignedUrl, updateUserImage } from '../controllers/authController.js';
import authMiddleware from '../middlewares/authMiddleware.js';

const router = express.Router();

router.post('/register', registerUser );
router.post('/login', loginUser );
router.get('/me', getLoggedInUser );
router.post('/logout', logoutUser );
router.post('/request-otp', requestOtp);
router.post('/store-package', storeSelectedPackage); // Add this line
router.get('/session', getSessionData);
router.post('/updatepackage', updateUserPackage); // New route for updating package
router.post('/:userId/upload-image', uploadUserImage); // New route for uploading user image
router.get('/users', getAllUsers); // API to get all users
router.put('/update/:userId', updateUserDetails);
router.delete('/users/:userId', deleteUser);
router.get("/users/:id",getUserById);
router.get('/total-price', getTotalPrice);
router.post('/forgot-password', requestPasswordReset);
router.post('/reset-password', resetPassword);
router.delete('/cancel-subscription', cancelSubscription);
router.get('/get-customer-id', getCustomerId);
router.post('/generate-presigned-url', generatePresignedUrl);
router.put('/:userId/image', updateUserImage);





export default router;