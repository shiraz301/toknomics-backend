const { ethers } = require('ethers');
const crypto = require('crypto');
const db = require('../models/db');
require('dotenv').config();
const contractABI = require('../contracts/TokenContractABI.json');
const contractAddress = process.env.CONTRACT_ADDRESS;

const provider = new ethers.JsonRpcProvider(process.env.ETH_NODE_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const contract = new ethers.Contract(contractAddress, contractABI, wallet);

// Promise wrapper for db.get
function dbGet(query, params) {
    return new Promise((resolve, reject) => {
        db.get(query, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

// Promise wrapper for db.run
function dbRun(query, params) {
    return new Promise((resolve, reject) => {
        db.run(query, params, function (err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
}


/**
 * Sends a minting transaction to Ethereum using USDT PoR.
 */
async function sendToEthereum(walletAddress, proofOfReserve) {
    console.log(`🔗 Initiating Ethereum minting using USDT balance in PoR...`);
    console.log(`🚀 Minting based on PoR for recipient: ${walletAddress}`);

    try {
        if (!ethers.isAddress(walletAddress)) {
            throw new Error("Invalid wallet address");
        }

        const parsedPoR = JSON.parse(proofOfReserve);
        const usdtBalance = parsedPoR.usdtBalance;

        if (!usdtBalance || isNaN(usdtBalance) || usdtBalance <= 0) {
            throw new Error("Invalid or insufficient USDT PoR balance");
        }

        // 🧠 Hash PoR to detect duplicates
        const rwaHash = crypto.createHash('sha256').update(proofOfReserve).digest('hex');
        console.log(`🔐 RWA Hash: ${rwaHash}`);

        const existingMint = await dbGet(
            `SELECT minted_amount FROM minted_rwas WHERE rwa_hash = ? AND walletAddress = ?`,
            [rwaHash, walletAddress]
        );

        if (existingMint) {
            console.log("🚫 Duplicate PoR hash detected — skipping mint.");
            throw new Error("This PoR has already been minted.");
        }

        // Add metadata (AFTER hashing to preserve hash stability)
        parsedPoR.selectedCurrency = "USDT";
        parsedPoR.validatedAt = new Date().toISOString();
        const updatedProof = JSON.stringify(parsedPoR);

        const amountInUnits = ethers.parseUnits(usdtBalance.toString(), 6);
        console.log(`📊 Minting amount in smallest unit: ${amountInUnits}`);

        const tx = await contract.mint(walletAddress, amountInUnits, updatedProof);
        console.log(`⛓️ Transaction submitted: ${tx.hash}`);
        await tx.wait();
        console.log(`✅ Minting successful! Tx hash: ${tx.hash}`);

        await dbRun(
            `INSERT INTO minted_rwas (walletAddress, rwa_hash, minted_amount, last_minted_at, eth_tx_hash)
             VALUES (?, ?, ?, ?, ?)`,
            [walletAddress, rwaHash, usdtBalance, new Date().toISOString(), tx.hash]
        );

        console.log("📦 Minted RWA saved successfully in DB");

        return tx.hash;
    } catch (err) {
        console.error("❌ Minting Error:", err.message);
        throw new Error(err.message);
    }
}

module.exports = { sendToEthereum };
