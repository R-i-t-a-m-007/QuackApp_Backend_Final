const express = require('express');
const { getPackages } = require('../controllers/packageController');
const authMiddleware = require('../middleware/authMiddleware');
const router = express.Router();

router.get('/', authMiddleware, getPackages);

module.exports = router;
