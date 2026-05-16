const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(__dirname)); // Serves your HTML file

// Create a simple database file
const db = new sqlite3.Database('./database.sqlite');

// Create our manual donation claim table
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS claims (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        handle TEXT,
        refCode TEXT,
        status TEXT DEFAULT 'pending'
    )`);
});

// Endpoint to submit a "I paid" claim
app.post('/claim', (req, res) => {
    const { handle, refCode } = req.body;
    db.run(`INSERT INTO claims (handle, refCode) VALUES (?, ?)`, [handle, refCode], (err) => {
        if (err) return res.status(500).send("Error saving claim.");
        res.send("Claim submitted! Awaiting your manual approval.");
    });
});

// Start the server
app.listen(3000, () => {
    console.log('Server running! Open http://localhost:3000 in your Chrome browser.');
});