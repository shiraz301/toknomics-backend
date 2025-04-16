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
      walletAddress TEXT,
      proof_of_reserve TEXT,
      submitterType TEXT,
      apiKey TEXT,
      transactionHash TEXT,
      "transaction" TEXT,
      bank TEXT,
      reference TEXT,
      date TEXT,
      account_name TEXT,
      account_number TEXT,
      bank_name TEXT,
      iban_number TEXT,
      server_id TEXT,
      server_ip TEXT,
      swift_code TEXT,
      validation_process_receiver TEXT,
      validation_process_codes TEXT,
      end_transmitting_validation_process TEXT
    )
  `);



  db.run(`
    CREATE TABLE IF NOT EXISTS minted_rwas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      walletAddress TEXT,
      rwa_hash TEXT UNIQUE,
      proof_of_reserve TEXT,
      minted_amount REAL,
      last_minted_at TEXT,
      eth_tx_hash TEXT
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
