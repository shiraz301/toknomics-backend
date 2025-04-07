const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./wallets.db');

/**
 * Fetch data from SQLite3 based on the given ID.
 * @param {string} id - The unique data ID
 * @returns {Promise<object>} - Returns an object containing walletAddress, proof_of_reserve, and amount
 */
function fetchData(id) {
    console.log(`🔍 Fetching data for ID: ${id}`);

    return new Promise((resolve, reject) => {
        db.get(
            "SELECT walletAddress, proof_of_reserve, amount FROM tokenized_data WHERE id = ?",
            [id],
            (err, row) => {
                if (err) {
                    console.error("❌ Database query error:", err);
                    return reject("Database query failed");
                }
                if (!row) {
                    console.warn("⚠️ No data found for ID:", id);
                    return reject("No data found");
                }

                console.log("✅ Data fetched successfully:", row);
                resolve(row);
            }
        );
    });
}

module.exports = { fetchData };
