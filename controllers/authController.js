const { ethers } = require('ethers');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../models/db');
const { encrypt, decrypt } = require('../utils/vault');

// ✅ Generate API Key, Private Key, and Wallet for Institution
const createInstitutionCredentials = (req, res) => {
    const { institutionName } = req.body;
    if (!institutionName) {
        return res.status(400).json({ error: 'Institution name is required' });
    }

    // Generate API Key + Private Key
    const apiKey = uuidv4();
    const apiSecret = uuidv4(); // Acts as a private key for authentication

    // Create Ethereum Wallet
    const wallet = ethers.Wallet.createRandom();
    const id = uuidv4();
    const address = wallet.address;
    const encryptedPrivateKey = encrypt(wallet.privateKey);
    const mnemonic = wallet.mnemonic.phrase;

    // Save to Database
    db.run(
        `INSERT INTO institutions (id, institutionName, apiKey, apiSecret, walletAddress, encryptedPrivateKey, mnemonic) 
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, institutionName, apiKey, apiSecret, address, encryptedPrivateKey, mnemonic],
        (err) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: err.message });
            }

            // Console log all credentials
            console.log('🔹 New Institution Registered:');
            console.log(`Institution: ${institutionName}`);
            console.log(`API Key: ${apiKey}`);
            console.log(`API Secret (Private Key): ${apiSecret}`);
            console.log(`Wallet Address: ${address}`);
            console.log(`Wallet Mnemonic: ${mnemonic}`);
            console.log(`Wallet Private Key: ${wallet.privateKey}`);
            res.json({ institutionName, apiKey, apiSecret, walletAddress: address });
        }
    );
};

// ✅ Authenticate Institution using API Key + Secret
const authenticateInstitution = (req, res) => {
    const { apiKey, apiSecret } = req.body;

    db.get(
        `SELECT * FROM institutions WHERE apiKey = ? AND apiSecret = ?`,
        [apiKey, apiSecret],
        (err, row) => {
            if (err) {
                console.error('Database fetch error:', err);
                return res.status(500).json({ error: 'Database error' });
            }
            if (!row) {
                return res.status(401).json({ error: 'Invalid API Key or Secret' });
            }

            res.json({ message: 'Authentication successful', institution: row.institutionName });
        }
    );
};

// ✅ Admin Creates Institution Credentials (Only if authenticated)
const adminCreateInstitutionCredentials = (req, res) => {
    if (!req.admin) {
        return res.status(403).json({ error: 'Unauthorized: Admins only' });
    }
    createInstitutionCredentials(req, res);
};

// ✅ Fetch All Institutions (Admin only)
const getInstitutions = (req, res) => {
    db.all(
        `SELECT id, institutionName, apiKey, apiSecret, walletAddress, encryptedPrivateKey FROM institutions`,
        [],
        (err, rows) => {
            if (err) {
                console.error('Database fetch error:', err);
                return res.status(500).json({ error: err.message });
            }

            const institutions = rows.map(row => ({
                id: row.id,
                institutionName: row.institutionName,
                apiKey: row.apiKey,
                apiSecret: row.apiSecret,
                walletAddress: row.walletAddress,
                privateKey: decrypt(row.encryptedPrivateKey)  // 🔓 Decrypt private key
            }));

            res.json(institutions);
        }
    );
};

// ✅ Fetch Institution Credentials (Authenticated Institution Only)
const getInstitutionCredentials = (req, res) => {
    const { institutionName, apiKey, apiSecret, walletAddress, encryptedPrivateKey } = req.institution;

    res.json({
        institutionName,
        apiKey,
        apiSecret,
        walletAddress,
        privateKey: decrypt(encryptedPrivateKey), // 🔓 Decrypt Private Key before sending
    });
};

// ✅ Admin Authentication (Uses Database Now)
const adminLogin = (req, res) => {
    const { username, password } = req.body;

    db.get(`SELECT * FROM admin WHERE username = ?`, [username], async (err, row) => {
        if (err) {
            console.error("Database Error:", err);
            return res.status(500).json({ message: "Internal Server Error" });
        }

        if (!row || !(await bcrypt.compare(password, row.password))) {
            return res.status(401).json({ message: "Invalid credentials" });
        }

        const token = jwt.sign({ role: 'admin', id: row.id }, process.env.ADMIN_SECRET, { expiresIn: '2h' });
        res.json({ token });
    });
};

module.exports = { 
    createInstitutionCredentials, 
    adminCreateInstitutionCredentials, 
    authenticateInstitution, 
    getInstitutions, 
    getInstitutionCredentials,
    adminLogin
};
