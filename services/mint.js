const { ethers } = require('ethers');
require('dotenv').config();
const db = require('../models/db'); 

const contractABI = require("../contracts/TokenContractABI.json");
const contractAddress = process.env.CONTRACT_ADDRESS;

// Initialize Ethereum provider & wallet
const provider = new ethers.JsonRpcProvider(process.env.ETH_NODE_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const contract = new ethers.Contract(contractAddress, contractABI, wallet);

/**
 * Sends a minting transaction to the Ethereum contract after validating PoR.
 * @param {string} walletAddress - The recipient's wallet address
 * @param {string | number} amount - The amount of tokens to mint
 * @param {string} proofOfReserveJSON - The JSON string containing PoR data
 * @returns {Promise<string>} - Returns the transaction hash
 */
async function sendToEthereum(walletAddress, amount, proofOfReserveJSON) {
    console.log(`🚀 Minting request for ${amount} tokens to ${walletAddress}`);

    try {
        // Parse proofOfReserve JSON
        const proofOfReserve = JSON.parse(proofOfReserveJSON);
        const usdcBalance = proofOfReserve.usdcBalance || 0;
        const eurcBalance = proofOfReserve.eurcBalance || 0;
        
        console.log(`📊 PoR Balances - USDC: ${usdcBalance}, EURC: ${eurcBalance}`);

        // Check if there's enough balance in either USDC or EURC
        if (usdcBalance >= amount) {
            console.log(`✅ Using USDC reserve for minting.`);
            proofOfReserve.selectedCurrency = "USDC";
        } else if (eurcBalance >= amount) {
            console.log(`✅ Using EURC reserve for minting.`);
            proofOfReserve.selectedCurrency = "EURC";
        } else {
            console.log("❌ Insufficient PoR balance! Minting denied.");
            throw new Error("Insufficient PoR balance for minting");
        }

        // Convert amount to string and token decimal format (18 decimals)
        const mintAmount = ethers.parseUnits(String(amount), 18);
        const updatedProofOfReserve = JSON.stringify(proofOfReserve);

        console.log("🔄 Sending mint transaction to Ethereum...");
        
        // Send mint transaction
        const tx = await contract.mint(walletAddress, mintAmount, updatedProofOfReserve);
        console.log(`⏳ Transaction sent: ${tx.hash}`);
        console.log("⏳ Waiting for confirmation...");
        
        await tx.wait();
        
        console.log(`✅ Minting successful! Transaction Hash: ${tx.hash}`);
       
        // Store transaction in the database
        db.run(
            `INSERT INTO minting_transactions (walletAddress, amount, transactionHash, timestamp) VALUES (?, ?, ?, ?)`,
            [walletAddress, amount, tx.hash, new Date().toISOString()],
            (err) => {
                if (err) {
                    console.error("❌ Error saving transaction:", err);
                } else {
                    console.log("✅ Transaction stored successfully in database.");
                }
            }
        );
        return tx.hash;
    } catch (error) {
        console.error("❌ Ethereum minting error:", error);
        throw new Error("Minting transaction failed");
    }
}

module.exports = { sendToEthereum };
