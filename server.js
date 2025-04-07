require('dotenv').config();
const { ethers } = require("ethers");
const axios = require('axios');
const express = require('express');
const cors = require('cors');
const db = require('./models/db'); 
const bodyParser = require('body-parser');
const fabricRoutes = require('./routes/fabricRoutes');
const authRoutes = require('./routes/authRoutes');
const dataRoutes = require('./routes/dataRoutes');
const { sendToEthereum } = require('./services/mint');
const {fetchData} = require('./services/fetchData');
const app = express();

// Middleware - ORDER MATTERS
app.use(express.json()); // Parse JSON
app.use(express.urlencoded({ extended: true }));
app.use(cors()); // Handle CORS
app.use(bodyParser.json()); // Body parser for API requests
// Routes - AFTER middleware
app.use('/auth', authRoutes);
app.use('/data', dataRoutes);
app.use('/fabric', fabricRoutes);
// ✅ API Route to Mint Tokens
app.post('/mint', async (req, res) => {
  const { id } = req.body;
  
  console.log("📩 Received mint request with ID:", id);

  if (!id) {
      console.error("⚠️ Error: ID is missing from request.");
      return res.status(400).json({ error: "ID is required" });
  }

  try {
      console.log(`🔍 Fetching data for ID: ${id}`);
      const { walletAddress, proof_of_reserve, amount } = await fetchData(id);
      
      console.log(`🔗 Initiating Ethereum minting for ${walletAddress} with amount: ${amount}`);
      const txHash = await sendToEthereum(walletAddress, amount, proof_of_reserve);

      console.log(`🎉 Minting successful! Tx Hash: ${txHash}`);
      res.json({ success: true, txHash });
  } catch (error) {
      console.error("❌ Minting process failed:", error.message);
      res.status(500).json({ error: error.message });
  }
});


app.get('/transactions', (req, res) => {
    db.all("SELECT * FROM minting_transactions ORDER BY timestamp DESC", [], (err, rows) => {
        if (err) {
            console.error("❌ Error fetching transactions:", err);
            res.status(500).json({ error: "Failed to fetch transactions" });
        } else {
            res.json(rows);
        }
    });
});


// ✅ Server Listening
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
