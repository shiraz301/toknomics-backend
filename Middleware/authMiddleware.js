const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
require('dotenv').config();
const db = require('../models/db');

const SECRET_KEY = process.env.ADMIN_SECRET || 'supersecretkey';

// ✅ Verify Admin JWT (Uses Database Credentials)
const verifyAdmin = (req, res, next) => {
    const token = req.headers.authorization?.split(" ")[1]; // Expecting token in 'Authorization: Bearer <token>'

    if (!token) return res.status(403).json({ message: "Access denied: No token" });

    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        if (decoded.role === "admin") {
            req.admin = decoded; // Store admin data in request
            next();
        } else {
            return res.status(403).json({ message: "Unauthorized: Admin required" });
        }
    } catch (error) {
        return res.status(403).json({ message: "Invalid or expired token" });
    }
};

// ✅ Verify Institution API Key & Secret Key (From Database)
const verifyInstitution = (req, res, next) => {
    const { "x-api-key": apiKey, "x-api-secret": apiSecret } = req.headers;

    if (!apiKey || !apiSecret) {
        return res.status(401).json({ error: "Access denied. API Key and Secret Key required." });
    }

    db.get(
        `SELECT id, institutionName, apiKey, apiSecret, walletAddress, encryptedPrivateKey 
         FROM institutions WHERE apiKey = ? AND apiSecret = ?`,
        [apiKey, apiSecret],
        (err, row) => {
            if (err) {
                console.error("❌ Database error:", err);
                return res.status(500).json({ error: "Internal Server Error" });
            }
            if (!row) {
                return res.status(403).json({ error: "Invalid API Key or Secret Key" });
            }

            // Attach institution data to request
            req.institution = {
                id: row.id,
                institutionName: row.institutionName,
                apiKey: row.apiKey,
                apiSecret: row.apiSecret,
                walletAddress: row.walletAddress,
                encryptedPrivateKey: row.encryptedPrivateKey
            };

            next();
        }
    );
};

const verifyAdminOrInstitution = (req, res, next) => {
    const token = req.headers.authorization?.split(" ")[1]; // Admin Token
    const apiKey = req.headers["x-api-key"];
    const apiSecret = req.headers["x-api-secret"];

    if (token) {
        // If an Admin JWT Token is provided, verify it
        try {
            const decoded = jwt.verify(token, process.env.ADMIN_SECRET);
            req.admin = decoded;
            return next();
        } catch (error) {
            return res.status(403).json({ message: "Invalid or expired admin token" });
        }
    } else if (apiKey && apiSecret) {
        // If API Key & Secret are provided, verify the institution
        db.get(
            `SELECT id, institutionName, apiKey, apiSecret, walletAddress FROM institutions WHERE apiKey = ? AND apiSecret = ?`,
            [apiKey, apiSecret],
            (err, row) => {
                if (err) {
                    console.error("❌ Database error:", err);
                    return res.status(500).json({ error: "Internal Server Error" });
                }
                if (!row) {
                    return res.status(403).json({ error: "Invalid API Key or Secret Key" });
                }

                req.institution = {
                    id: row.id,
                    institutionName: row.institutionName,
                    apiKey: row.apiKey,
                    apiSecret: row.apiSecret,
                    walletAddress: row.walletAddress
                };

                next();
            }
        );
    } else {
        return res.status(401).json({ message: "Access denied: No authentication provided" });
    }
};

module.exports = { verifyAdminOrInstitution };


module.exports = { verifyAdmin, verifyInstitution, verifyAdminOrInstitution };
