  const { v4: uuidv4 } = require('uuid');
  const db = require('../models/db');
  const axios = require('axios');
  const { toChecksumAddress } = require('ethereumjs-util');

  const ETHERSCAN_API_KEY = 'WSAWK15AYG8YNT4RZ7ECB39MWYPDGDZFT4';
  const ETHERSCAN_API_URL = 'https://api.etherscan.io/api';

  // ✅ ERC-20 Contract Addresses for Mainnet
  const USDC_CONTRACT = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'; // USDC Mainnet
  const EURC_CONTRACT = '0x1aBaEA1f7C830bD89Acc67eC4af516284b1bC33c'; // EURC Mainnet

  // ✅ Validate Ethereum Address
  const isValidEthereumAddress = (address) => /^0x[a-fA-F0-9]{40}$/.test(address);


  const fetchERC20Balance = async (walletAddress, tokenContract) => {
    try {
      walletAddress = toChecksumAddress(walletAddress); // Convert to checksum
      console.log(`🔍 Fetching balance for: ${walletAddress}, Token: ${tokenContract}`);
      
      const url = `https://api.etherscan.io/api?module=account&action=tokenbalance&contractaddress=${tokenContract}&address=${walletAddress}&tag=latest&apikey=${ETHERSCAN_API_KEY}`;
      
      console.log("🔗 API Request URL:", url);
      
      const response = await axios.get(url, { headers: { 'Cache-Control': 'no-cache' } });
  
      console.log("📩 Raw API Response:", response.data);
  
      if (response.data.status === "1" && response.data.result) {
        return parseFloat(response.data.result) / 1e6; // Convert to decimals
      }
  
      throw new Error("Invalid data from Etherscan");
    } catch (error) {
      console.error("🚨 Error fetching token balance:", error.message);
      return null;
    }
  };
  

  // ✅ Get Institution Wallet Address
  const getWalletAddress = (apiKey, apiSecret) => {
    return new Promise((resolve, reject) => {
      console.log(`🔍 Fetching wallet address for API Key: ${apiKey}`);
      
      db.get(
        `SELECT walletAddress FROM institutions WHERE apiKey = ? AND apiSecret = ?`,
        [apiKey, apiSecret],
        (err, row) => {
          if (err) {
            console.error('🚨 Database Error:', err);
            return reject("Database error");
          }
          if (!row) {
            console.warn('⚠️ Institution not found for API Key:', apiKey);
            return reject("Institution not found");
          }
          console.log(`✅ Found Wallet Address: ${row.walletAddress}`);
          resolve(row.walletAddress);
        }
      );
    });
  };

  // ✅ Validate JSON Structure
  const validateJsonStructure = (json) => {
    const { deploy, data, bytecode, totalSupply, amount } = json;
    if (!deploy || !data || !bytecode || !totalSupply || !amount) {
      return '❌ Invalid or missing fields in JSON';
    }
    if (isNaN(totalSupply) || isNaN(amount) || parseFloat(amount) > parseFloat(totalSupply)) {
      return '❌ Invalid token supply or mint amount exceeds total supply';
    }
    return null;
  };

  // ✅ Receive Tokenized Data
  const receiveData = async (req, res) => {
    try {
      console.log("📥 Receiving tokenized data submission...");
      
      const tokenizedData = req.body;
      console.log("📜 Received JSON Data:", JSON.stringify(tokenizedData, null, 2));

      const validationError = validateJsonStructure(tokenizedData);
      if (validationError) {
        console.warn('⚠️ Validation Error:', validationError);
        return res.status(400).json({ error: validationError });
      }

      const { deploy, data, bytecode, totalSupply, amount } = tokenizedData;
      const id = uuidv4();
      let submitterType = "admin";
      let apiKey = null;
      let apiSecret = null;
      let walletAddress = "0x27155fEfaeBaa8F6854DE9bae219c19A55ff8A9C";

      if (req.institution) {
        submitterType = "institution";
        apiKey = req.institution.apiKey;
        apiSecret = req.institution.apiSecret;
        try {
          console.log("🏦 Institution detected. Fetching wallet address...");
          walletAddress = await getWalletAddress(apiKey, apiSecret);
        } catch (error) {
          console.error("🚨 Error fetching institution wallet address:", error);
          return res.status(400).json({ error: "Failed to fetch wallet address" });
        }
      }

      if (!walletAddress || !isValidEthereumAddress(walletAddress)) {
        console.error("❌ Invalid or missing wallet address");
        return res.status(400).json({ error: "Invalid or missing wallet address" });
      }

      console.log(`🔄 Fetching Proof of Reserves for: ${walletAddress}`);
      const usdcBalance = await fetchERC20Balance(walletAddress, USDC_CONTRACT);
      const eurcBalance = await fetchERC20Balance(walletAddress, EURC_CONTRACT);

      if (usdcBalance === null || eurcBalance === null) {
        console.error("🚨 Failed to fetch ERC-20 balances.");
        return res.status(500).json({ error: "Failed to fetch ERC-20 balances" });
      }

      console.log(`✅ USDC Balance: ${usdcBalance}`);
      console.log(`✅ EURC Balance: ${eurcBalance}`);

      if (usdcBalance < parseFloat(totalSupply) && eurcBalance < parseFloat(totalSupply)) {
        console.error(`⚠️ Insufficient balance: Required ${totalSupply}, Available USDC: ${usdcBalance}, EURC: ${eurcBalance}`);
        return res.status(400).json({ error: "Insufficient reserves for minting" });
      }

      const proofOfReserve = {
        usdcBalance,
        eurcBalance,
        verifiedAt: new Date().toISOString(),
        verified: true,
      };

      console.log("📩 Storing tokenized data in database...");

      db.run(
        `INSERT INTO tokenized_data 
          (id, deploy, data, bytecode, walletAddress, proof_of_reserve, submitterType, apiKey, apiSecret, totalSupply, amount) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          JSON.stringify(deploy),
          JSON.stringify(data),
          JSON.stringify(bytecode),
          walletAddress,
          JSON.stringify(proofOfReserve),
          submitterType,
          apiKey,
          apiSecret,
          totalSupply,
          amount
        ],
        (err) => {
          if (err) {
            console.error("🚨 Database Error:", err.message);
            return res.status(500).json({ error: err.message });
          }

          console.log("✅ Tokenized Data Stored Successfully!");

          res.json({ 
            id, deploy, walletAddress, proofOfReserve, submitterType, apiKey, totalSupply, amount 
          });
        }
      );
    } catch (error) {
      console.error("🚨 Error processing submission:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  };

  // ✅ Get Data for Admin/Institution (Fetching USDC & EURC PoR)
  const getData = (req, res) => {
    let query = `
      SELECT id, deploy, walletAddress, proof_of_reserve, submitterType, apiKey, totalSupply, amount 
      FROM tokenized_data
    `;

    let params = req.institution ? [req.institution.apiKey] : [];
    if (req.institution) query += ' WHERE apiKey = ?';

    console.log("📡 Fetching tokenized data from database...");
    
    db.all(query, params, (err, rows) => {
      if (err) {
        console.error("🚨 Database Error:", err.message);
        return res.status(500).json({ error: err.message });
      }

      console.log(`📊 Retrieved ${rows.length} records.`);

      res.json(rows.map(row => {
        const proofOfReserve = JSON.parse(row.proof_of_reserve);

        return {
          id: row.id,
          deploy: JSON.parse(row.deploy),
          walletAddress: row.walletAddress,
          submitterType: row.submitterType,
          apiKey: row.apiKey || "N/A",
          proof_of_reserve: {
            USDC: proofOfReserve.usdcBalance || 0,
            EURC: proofOfReserve.eurcBalance || 0,
            verifiedAt: proofOfReserve.verifiedAt,
            verified: proofOfReserve.verified || false
          },          
          totalSupply: row.totalSupply,
          amount: row.amount
        };
      }));
    });
  };


  module.exports = { receiveData, getData };
