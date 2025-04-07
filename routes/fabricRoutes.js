const express = require('express');
const router = express.Router();
const { storeDataOnFabric, getAllDataFromFabric, getDataByID } = require('../controllers/fabricController');

// ✅ Store a specific data entry on Fabric using its ID
router.post('/store/:id', storeDataOnFabric);

// ✅ Fetch all stored data from Fabric
router.get('/fetch-all', getAllDataFromFabric);

// ✅ Fetch a single data entry from Fabric by ID
router.get('/fetch/:id', getDataByID);

module.exports = router;
