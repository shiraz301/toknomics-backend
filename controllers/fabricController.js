const fs = require('fs');
const path = require('path');
const { Gateway, Wallets } = require('fabric-network');
const db = require('../models/db'); 

// ✅ Fabric Configurations
const ccpPath = path.resolve(
  '/home/ubuntu/fabric-samples/test-network/organizations/peerOrganizations/org1.example.com/connection-org1.json'
);
const walletPath = path.join(__dirname, '../scripts/wallet');
const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));

// ✅ Store Data on Fabric
const storeDataOnFabric = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: "ID is required" });

    // ✅ Fetch Data from Database
    db.get('SELECT * FROM tokenized_data WHERE id = ?', [id], async (err, row) => {
      if (err) return res.status(500).json({ error: "Database fetch error" });
      if (!row) return res.status(404).json({ error: `No data found for ID ${id}` });

      // ✅ Prepare Fabric Wallet & Gateway
      const wallet = await Wallets.newFileSystemWallet(walletPath);
      const identity = await wallet.get('admin');
      if (!identity) throw new Error('Admin identity not found');

      const gateway = new Gateway();
      await gateway.connect(ccp, { wallet, identity: 'admin', discovery: { enabled: true, asLocalhost: true } });

      const network = await gateway.getNetwork('mychannel');
      const contract = network.getContract('tokenized');

      // ✅ Format Data for Fabric
      const formattedRecord = {
        id: row.id,
        deploy: row.deploy,
        data: row.data,
        walletAddress: row.walletAddress,
        proof_of_reserve: row.proof_of_reserve,
        submitterType: row.submitterType,
        apiKey: row.apiKey || "N/A",
        apiSecret: row.apiSecret || "N/A"
      };

      console.log("✅ Sending Data to Fabric:", formattedRecord);

      // ✅ Submit Transaction
      await contract.submitTransaction('StoreData', row.id, JSON.stringify(formattedRecord));
      console.log(`✅ Data ID ${row.id} stored on Fabric`);

      await gateway.disconnect();
      res.json({ success: true, message: `Data ID ${row.id} stored`, id: row.id });
    });

  } catch (error) {
    console.error("❌ Storage Error:", error.message);
    res.status(500).json({ error: "Storage Failed" });
  }
};

// ✅ Fetch All Data from Fabric
// ✅ Fetch All Data from Fabric
const getAllDataFromFabric = async (req, res) => {
  try {
    console.log("📡 Starting to fetch all data from Fabric...");

    const wallet = await Wallets.newFileSystemWallet(walletPath);
    const identity = await wallet.get('admin');
    if (!identity) throw new Error('Admin identity missing');

    const gateway = new Gateway();
    await gateway.connect(ccp, { wallet, identity: 'admin', discovery: { enabled: true, asLocalhost: true } });

    const network = await gateway.getNetwork('mychannel');
    const contract = network.getContract('tokenized');

    console.log("📡 Sending query to Fabric to fetch all data...");
    const result = await contract.evaluateTransaction('QueryAllData');

    // ✅ Handle empty response gracefully
    if (!result || result.length === 0) {
      console.log("⚠️ No data found on Fabric");
      res.json({ message: "No data found" });
      return;
    }

    const parsedResult = JSON.parse(result.toString());
    console.log("📡 Data fetched from Fabric:", parsedResult);
    res.json(parsedResult);

    await gateway.disconnect();
  } catch (error) {
    console.error("❌ Fetch Error:", error.message);
    res.status(500).json({ error: "Fetch Failed" });
  }
};

// ✅ Fetch Single Data Entry from Fabric by ID
const getDataByID = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: "ID is required" });

    const wallet = await Wallets.newFileSystemWallet(walletPath);
    const identity = await wallet.get('admin');
    if (!identity) throw new Error('Admin identity missing');

    const gateway = new Gateway();
    await gateway.connect(ccp, { wallet, identity: 'admin', discovery: { enabled: true, asLocalhost: true } });

    const network = await gateway.getNetwork('mychannel');
    const contract = network.getContract('tokenized');

    const result = await contract.evaluateTransaction('QueryDataByID', id);
    res.json(JSON.parse(result.toString()));

    await gateway.disconnect();
  } catch (error) {
    console.error("❌ Fetch Error:", error.message);
    res.status(500).json({ error: "Fetch Failed" });
  }
};

// ✅ Export API Functions
module.exports = { storeDataOnFabric, getAllDataFromFabric, getDataByID };
