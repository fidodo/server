const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const admin = require('firebase-admin');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Initialize Firebase Admin
let serviceAccount;
try {
  // If you have a JSON file
  // serviceAccount = require('./serviceAccountKey.json');
  
  // Or if you're using environment variables
  serviceAccount = {
    type: process.env.FIREBASE_TYPE,
    project_id: process.env.FIREBASE_PROJECT_ID,
    private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
    private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    client_id: process.env.FIREBASE_CLIENT_ID,
    auth_uri: process.env.FIREBASE_AUTH_URI,
    token_uri: process.env.FIREBASE_TOKEN_URI,
    auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_CERT_URL,
    client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL
  };

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  console.log('✅ Firebase Admin initialized');
} catch (error) {
  console.error('❌ Firebase Admin initialization error:', error);
}

// Initialize PostgreSQL connection pool
const pool = new Pool({
  user: process.env.PG_USER,
  host: process.env.PG_HOST,
  database: process.env.PG_DATABASE,
  password: process.env.PG_PASSWORD,
  port: process.env.PG_PORT,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Verify database connection
pool.connect((err, client, release) => {
  if (err) {
    return console.error('❌ Error acquiring client:', err.stack);
  }
  client.query('SELECT NOW()', (err, result) => {
    release();
    if (err) {
      return console.error('❌ Error executing query:', err.stack);
    }
    console.log('✅ Connected to PostgreSQL database');
  });
});

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Authentication middleware
const authenticateUser = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error('❌ Authentication error:', error);
    res.status(401).json({ error: 'Unauthorized' });
  }
};

// API Routes
app.get('/api/thoughts', authenticateUser, async (req, res) => {
  try {
    const userId = req.user.uid;
    console.log('Fetching thoughts for user:', userId);
    
    const { rows } = await pool.query('SELECT * FROM thoughts WHERE user_id = $1', [userId]);
    res.status(200).json({ thoughts: rows });
  } catch (error) {
    console.error('❌ Error fetching thoughts:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/api/thoughts', authenticateUser, async (req, res) => {
  try {
    const userId = req.user.uid;
    const userEmail = req.user.email || null;
    const userName = userEmail ? userEmail.split('@')[0] : 'anonymous';
    const createdAt = new Date().toISOString();

    // Check if user exists
    const userCheck = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    if (userCheck.rows.length === 0) {
      await pool.query(
        'INSERT INTO users (id, username, email, password_hash, created_at) VALUES ($1, $2, $3, $4, $5)',
        [userId, userName, userEmail, null, createdAt]
      );
    }

    // Create thought
    const { text, section, folder } = req.body;
    console.log('Creating thought:', { text, section, folder });
    
    const { rows } = await pool.query(
      'INSERT INTO thoughts (user_id, text, section, folder, timestamp) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [userId, text, section, folder || null, new Date().toISOString()]
    );

    res.status(201).json({ thought: rows[0] });
  } catch (error) {
    console.error('❌ Error creating thought:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.put('/api/thoughts', authenticateUser, async (req, res) => {
  try {
    const userId = req.user.uid;
    const { id, text, section, folder } = req.body;

    if (!id) {
      return res.status(400).json({ error: 'Missing thought ID' });
    }

    console.log('Updating thought:', { id, text, section, folder });

    const { rows } = await pool.query(
      'UPDATE thoughts SET text = COALESCE($1, text), section = COALESCE($2, section), folder = COALESCE($3, folder) WHERE id = $4 AND user_id = $5 RETURNING *',
      [text, section, folder, id, userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Thought not found or unauthorized' });
    }

    res.status(200).json({ thought: rows[0] });
  } catch (error) {
    console.error('❌ Error updating thought:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.delete('/api/thoughts', authenticateUser, async (req, res) => {
  try {
    const userId = req.user.uid;
    const { id } = req.body;

    if (!id) {
      return res.status(400).json({ error: 'Missing thought ID' });
    }

    console.log('Deleting thought:', id);

    const { rows } = await pool.query(
      'DELETE FROM thoughts WHERE id = $1 AND user_id = $2 RETURNING *',
      [id, userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Thought not found or unauthorized' });
    }

    res.status(200).json({ deleted: true });
  } catch (error) {
    console.error('❌ Error deleting thought:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Folder routes
app.get('/api/folders', authenticateUser, async (req, res) => {
  try {
    const userId = req.user.uid;
    const { rows } = await pool.query('SELECT * FROM folders WHERE user_id = $1', [userId]);
    res.status(200).json({ folders: rows });
  } catch (error) {
    console.error('❌ Error fetching folders:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/api/folders', authenticateUser, async (req, res) => {
  try {
    const userId = req.user.uid;
    const { name } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Folder name is required' });
    }
    
    const { rows } = await pool.query(
      'INSERT INTO folders (user_id, name, timestamp) VALUES ($1, $2, $3) RETURNING *',
      [userId, name, new Date().toISOString()]
    );
    
    res.status(201).json({ folder: rows[0] });
  } catch (error) {
    console.error('❌ Error creating folder:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.put('/api/folders', authenticateUser, async (req, res) => {
  try {
    const userId = req.user.uid;
    const { id, name } = req.body;
    
    if (!id || !name) {
      return res.status(400).json({ error: 'Folder ID and name are required' });
    }
    
    const { rows } = await pool.query(
      'UPDATE folders SET name = $1 WHERE id = $2 AND user_id = $3 RETURNING *',
      [name, id, userId]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Folder not found or unauthorized' });
    }
    
    res.status(200).json({ folder: rows[0] });
  } catch (error) {
    console.error('❌ Error updating folder:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.delete('/api/folders', authenticateUser, async (req, res) => {
  try {
    const userId = req.user.uid;
    const { id } = req.body;
    
    if (!id) {
      return res.status(400).json({ error: 'Folder ID is required' });
    }
    
    // First, update any thoughts that use this folder
    await pool.query(
      'UPDATE thoughts SET folder = NULL WHERE folder = $1 AND user_id = $2',
      [id, userId]
    );
    
    // Then delete the folder
    const { rows } = await pool.query(
      'DELETE FROM folders WHERE id = $1 AND user_id = $2 RETURNING *',
      [id, userId]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Folder not found or unauthorized' });
    }
    
    res.status(200).json({ deleted: true });
  } catch (error) {
    console.error('❌ Error deleting folder:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});


