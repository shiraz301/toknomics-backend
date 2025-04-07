const express = require('express');
const { 
    createInstitutionCredentials, 
    authenticateInstitution, 
    getInstitutions, 
    adminCreateInstitutionCredentials, 
    getInstitutionCredentials, 
    adminLogin 
} = require('../controllers/authController');
const { verifyAdmin, verifyInstitution } = require('../Middleware/authMiddleware');

const router = express.Router();

// Institution Endpoints
router.post('/register', createInstitutionCredentials);
router.post('/login', authenticateInstitution);
router.get('/credentials', verifyInstitution, getInstitutionCredentials);

// Admin Endpoints
router.post('/admin/login', adminLogin);
router.get('/institutions', verifyAdmin, getInstitutions);
router.post('/admin/create-institution', verifyAdmin, adminCreateInstitutionCredentials);

module.exports = router;
