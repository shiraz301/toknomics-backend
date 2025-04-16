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
        const { walletAddress, proof_of_reserve } = await fetchData(id);

        console.log(`🔗 Initiating Ethereum minting using USDT balance in PoR...`);

        const txHash = await sendToEthereum(walletAddress, proof_of_reserve);

        console.log(`🎉 Minting successful! Tx Hash: ${txHash}`);
        return res.json({ success: true, txHash });

    } catch (error) {
        // ✅ Handle duplicate mint attempts gracefully
        if (error.message.includes("already been minted")) {
            console.warn("⚠️ Duplicate mint attempt detected.");
            return res.status(200).json({
                success: false,
                message: "This PoR has already been minted."
            });
        }

        // ❌ For real errors, respond with 500
        console.error("❌ Minting process failed:", error.message);
        return res.status(500).json({ error: error.message });
    }
});



app.get('/transactions', (req, res) => {
    const query = `
        SELECT 
            walletAddress,
            rwa_hash AS rwaHash,
            minted_amount AS mintedAmount,
            last_minted_at AS mintedAt,
            eth_tx_hash AS ethTxHash  -- Add the eth_tx_hash field here
        FROM minted_rwas
        ORDER BY last_minted_at DESC
    `;

    db.all(query, [], (err, rows) => {
        if (err) {
            console.error("❌ Error fetching transactions:", err);
            return res.status(500).json({ error: "Failed to fetch transactions" });
        }

        const formatted = rows.map(tx => ({
            walletAddress: tx.walletAddress,
            rwaHash: tx.rwaHash,
            mintedAmount: parseFloat(tx.mintedAmount).toFixed(6),
            mintedAt: new Date(tx.mintedAt).toISOString(),
            ethTxHash: tx.ethTxHash || ''  // Add ethTxHash to the response, default to empty string if not available
        }));

        res.json({ count: formatted.length, transactions: formatted });
    });
});



// ✅ Server Listening
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
