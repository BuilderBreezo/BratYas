const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const multer = require('multer');
const basicAuth = require('express-basic-auth');

const app = express();
app.use(express.json());
app.use(express.static(__dirname)); 

// --- SECURITY LOCK ---
app.use((req, res, next) => {
    if (req.path.startsWith('/admin')) {
        return basicAuth({
            users: { 'boss': 'secret123' }, // CHANGE THESE BEFORE DEPLOYING!
            challenge: true,
            unauthorizedResponse: 'Access Denied. Admins Only.'
        })(req, res, next);
    }
    next();
});

// Setup file uploader
const storage = multer.diskStorage({
    destination: './uploads/',
    filename: function(req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname)); 
    }
});
const upload = multer({ storage: storage });

const db = new sqlite3.Database('./database.sqlite');

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS claims (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        handle TEXT,
        refCode TEXT,
        status TEXT DEFAULT 'pending'
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS content (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT,
        filename TEXT
    )`);
});

// --- MAIN PAYWALL ROUTE ---
app.post('/claim', (req, res) => {
    const { handle, refCode } = req.body;
    db.run(`INSERT INTO claims (handle, refCode) VALUES (?, ?)`, [handle, refCode], (err) => {
        if (err) return res.status(500).send("Error saving claim.");
        res.send("Claim submitted! After the host approves it, go to The Vault.");
    });
});

// --- THE VAULT (USER ACCESS) ---
app.post('/vault/access', (req, res) => {
    const { handle } = req.body;
    db.get(`SELECT * FROM claims WHERE handle = ? AND status = 'approved'`, [handle], (err, row) => {
        if (!row) return res.status(403).json({ error: "Access Denied. Wait for approval or check spelling." });
        
        db.all(`SELECT * FROM content`, [], (err, files) => {
            res.json(files);
        });
    });
});

// Securely serve the media files
app.get('/protected-media/:filename', (req, res) => {
    const handle = req.query.handle;
    db.get(`SELECT * FROM claims WHERE handle = ? AND status = 'approved'`, [handle], (err, row) => {
        if (!row) return res.status(403).send("Unauthorized");
        res.sendFile(path.join(__dirname, 'uploads', req.params.filename));
    });
});

// --- ADMIN ROUTES ---
app.get('/admin/claims', (req, res) => {
    db.all(`SELECT * FROM claims WHERE status = 'pending'`, [], (err, rows) => {
        res.json(rows);
    });
});

app.post('/admin/approve', (req, res) => {
    const { id } = req.body;
    db.run(`UPDATE claims SET status = 'approved' WHERE id = ?`, [id], () => {
        res.send("Approved!");
    });
});

app.post('/admin/upload', upload.single('mediaFile'), (req, res) => {
    const title = req.body.title;
    const filename = req.file.filename;
    db.run(`INSERT INTO content (title, filename) VALUES (?, ?)`, [title, filename], () => {
        res.redirect('/admin.html'); 
    });
});

// THIS IS THE LINE THAT CHANGED FOR DEPLOYMENT!
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});