const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');

const db = new sqlite3.Database('./wallets.db');

db.serialize(() => {
  // Create Institutions Table
  db.run(`
    CREATE TABLE IF NOT EXISTS institutions (
      id TEXT PRIMARY KEY,
      institutionName TEXT UNIQUE,
      apiKey TEXT UNIQUE,
      apiSecret TEXT UNIQUE,
      walletAddress TEXT UNIQUE,
      encryptedPrivateKey TEXT,
      mnemonic TEXT
    )
  `);

  // Create Tokenized Data Table
  db.run(`
    CREATE TABLE IF NOT EXISTS tokenized_data (
      id TEXT PRIMARY KEY,
      deploy TEXT,
      data TEXT,
      bytecode TEXT,
      functions TEXT,
      walletAddress TEXT,
      proof_of_reserve TEXT,
      totalSupply INTEGER,
      amount INTEGER,
      submitterType TEXT,  -- 'admin' or 'institution'
      apiKey TEXT,         -- API Key if submitted by institution
      apiSecret TEXT       -- API Secret if submitted by institution
    )
  `);

  // Create Minting Transactions Table
  db.run(`
    CREATE TABLE IF NOT EXISTS minting_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      walletAddress TEXT,
      amount TEXT,
      transactionHash TEXT UNIQUE,
      timestamp TEXT
    )
  `);
  
  // Create Admin Table
  db.run(`
    CREATE TABLE IF NOT EXISTS admin (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE,
      password TEXT
    )
  `);

  // Insert Default Admin (Only if table is empty)
  db.get(`SELECT * FROM admin LIMIT 1`, [], async (err, row) => {
    if (!row) {
      const hashedPassword = await bcrypt.hash('admin123', 10); // Default password
      db.run(`INSERT INTO admin (id, username, password) VALUES (?, ?, ?)`, [
        'admin-uuid',
        'admin',
        hashedPassword,
      ]);
      console.log('🔹 Default Admin Created (Username: admin, Password: admin123)');
    }
  });
});

module.exports = db;
