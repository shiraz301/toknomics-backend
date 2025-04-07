const express = require('express');
const { receiveData, getData } = require('../controllers/dataController');
const { verifyAdminOrInstitution } = require('../Middleware/authMiddleware');

const router = express.Router();

// ✅ Allow both Admins and Institutions to submit JSON
router.post('/submit', verifyAdminOrInstitution, receiveData);

// ✅ Only Admins can fetch all submissions
router.get('/fetch', verifyAdminOrInstitution, getData);

module.exports = router;
