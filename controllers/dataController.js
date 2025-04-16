const { v4: uuidv4 } = require('uuid');
const db = require('../models/db');
const axios = require('axios');
const { toChecksumAddress } = require('ethereumjs-util');

const ETHERSCAN_API_KEY = 'WSAWK15AYG8YNT4RZ7ECB39MWYPDGDZFT4';
const USDT_CONTRACT = '0xdAC17F958D2ee523a2206206994597C13D831ec7'; // USDT Mainnet

const isValidEthereumAddress = (address) => /^0x[a-fA-F0-9]{40}$/.test(address);

const fetchUSDTBalance = async (walletAddress) => {
  try {
    walletAddress = toChecksumAddress(walletAddress);
    const url = `https://api.etherscan.io/api?module=account&action=tokenbalance&contractaddress=${USDT_CONTRACT}&address=${walletAddress}&tag=latest&apikey=${ETHERSCAN_API_KEY}`;
    const response = await axios.get(url, { headers: { 'Cache-Control': 'no-cache' } });

    if (response.data.status === "1" && response.data.result) {
      return parseFloat(response.data.result) / 1e6; // USDT has 6 decimals
    }
    throw new Error("Invalid data from Etherscan");
  } catch (error) {
    console.error("🚨 Error fetching USDT balance:", error.message);
    return null;
  }
};

const getWalletAddress = (apiKey, apiSecret) => {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT walletAddress FROM institutions WHERE apiKey = ? AND apiSecret = ?`,
      [apiKey, apiSecret],
      (err, row) => {
        if (err) return reject("Database error");
        if (!row) return reject("Institution not found");
        resolve(row.walletAddress);
      }
    );
  });
};

const validateJsonStructure = (json) => {
  const required = ['deploy', 'data', 'transaction', 'account_name', 'iban_number', 'swift_code', 'validation_process_receiver'];
  for (const field of required) {
    if (!json[field]) return `❌ Missing field: ${field}`;
  }
  return null;
};

const receiveData = async (req, res) => {
  try {
    const tokenizedData = req.body;
    const validationError = validateJsonStructure(tokenizedData);
    if (validationError) return res.status(400).json({ error: validationError });

    const id = uuidv4();
    let submitterType = "admin";
    let apiKey = null;
    let apiSecret = null;
    let walletAddress = null;

    console.log("Received tokenized data:", tokenizedData);

    // For institutes, fetch wallet address from DB if not present in the JSON
    if (req.institution) {
      submitterType = "institution";
      apiKey = req.institution.apiKey;
      apiSecret = req.institution.apiSecret;

      // If walletAddress is not provided in the tokenizedData, fetch from DB
      if (!tokenizedData.walletAddress) {
        console.log("Wallet address not found in the tokenized data. Fetching from DB...");
        try {
          walletAddress = await getWalletAddress(apiKey, apiSecret);
          console.log("Fetched wallet address:", walletAddress);
        } catch (error) {
          return res.status(400).json({ error: "Failed to fetch wallet address" });
        }
      } else {
        // If walletAddress is provided, use it
        walletAddress = tokenizedData.walletAddress;
        console.log("Using provided wallet address:", walletAddress);
      }
    }

    // If no walletAddress provided and not found for institutes, return error
    if (!walletAddress || !isValidEthereumAddress(walletAddress)) {
      return res.status(400).json({ 
        error: "Invalid or missing wallet address", 
        message: `Wallet address: ${walletAddress || "none"}` 
      });
    }

    const usdtBalance = await fetchUSDTBalance(walletAddress);
    if (usdtBalance === null) return res.status(500).json({ error: "Failed to fetch USDT balance" });

    console.log(`✅ USDT Balance: ${usdtBalance}`);
    const tokenAmount = parseFloat(tokenizedData?.validation_process_receiver?.amount?.replace(/,/g, "") || 0);

    if (usdtBalance < tokenAmount) {
      return res.status(400).json({ error: `Insufficient USDT reserves. Required: ${tokenAmount}, Available: ${usdtBalance}` });
    }

    const proofOfReserve = {
      usdtBalance,
      verifiedAt: new Date().toISOString(),
      verified: true,
    };

    const {
      deploy,
      data,
      transaction,
      transactionHash,
      bank,
      reference,
      date,
      account_name,
      account_number,
      bank_name,
      iban_number,
      server_id,
      server_ip,
      swift_code,
      validation_process_receiver,
      validation_process_codes,
      end_transmitting_validation_process
    } = tokenizedData;

    db.run(
      `INSERT INTO tokenized_data 
    (id, deploy, data, walletAddress, proof_of_reserve, submitterType, apiKey, transactionHash, \`transaction\`, 
     bank, reference, date, account_name, account_number, bank_name, iban_number, server_id, server_ip, swift_code,
     validation_process_receiver, validation_process_codes, end_transmitting_validation_process)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,

      [
        id,
        JSON.stringify(deploy),
        JSON.stringify(data),
        walletAddress,
        JSON.stringify(proofOfReserve),
        submitterType,
        apiKey,
        transactionHash,
        JSON.stringify(transaction),
        bank,
        reference,
        date,
        account_name,
        account_number,
        bank_name,
        iban_number,
        server_id,
        server_ip,
        swift_code,
        JSON.stringify(validation_process_receiver),
        JSON.stringify(validation_process_codes),
        JSON.stringify(end_transmitting_validation_process)
      ],
      (err) => {
        if (err) return res.status(500).json({ error: err.message });

        res.json({
          id,
          walletAddress,
          proofOfReserve,
          transactionHash,
          receiver: validation_process_receiver,
          bank,
          reference
        });
      }
    );
  } catch (error) {
    console.error("❌ Error:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
};


  // ✅ Get Data for Admin/Institution (Fetching USDC & EURC PoR)
  const getData = (req, res) => {
    let query = `SELECT * FROM tokenized_data`;
    let params = [];
  
    if (req.institution) {
      query += ' WHERE apiKey = ?';
      params.push(req.institution.apiKey);
      console.log(`📦 Fetching data for institution with API Key: ${req.institution.apiKey}`);
    } else {
      console.log("📦 Fetching all tokenized data for admin view.");
    }
  
    db.all(query, params, (err, rows) => {
      if (err) {
        console.error("❌ Error fetching data from DB:", err.message);
        return res.status(500).json({ error: err.message });
      }
  
      console.log(`✅ Retrieved ${rows.length} entries from tokenized_data.`);
  
      const formatted = rows.map(row => {
        const parsedProof = JSON.parse(row.proof_of_reserve);
        console.log(`🔎 Entry ID: ${row.id} | USDT Balance: ${parsedProof.usdtBalance} | Verified: ${parsedProof.verified}`);
        return {
          id: row.id,
          walletAddress: row.walletAddress,
          proofOfReserve: parsedProof,
          submitterType: row.submitterType,
          transactionHash: row.transactionHash,
          bank: row.bank,
          reference: row.reference,
          date: row.date,
          account_name: row.account_name,
          account_number: row.account_number,
          iban_number: row.iban_number,
          swift_code: row.swift_code,
          receiver: JSON.parse(row.validation_process_receiver),
          transaction: JSON.parse(row.transaction),
          deploy: JSON.parse(row.deploy),
          data: JSON.parse(row.data)
        };
      });
  
      res.json(formatted);
    });
  };
  
  


  module.exports = { receiveData, getData };
