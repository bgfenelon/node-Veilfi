// backend/routes/deposit.js
const express = require('express');
const router = express.Router();
const { query } = require('../db');

// GET /deposit/check?userId=...
router.get('/check', async (req, res) => {
  try {
    const userId = req.query.userId;
    if (!userId) return res.status(400).json({ error: 'missing userId' });

    const r = await query(
      `SELECT id, type, token, amount, signature, metadata, created_at FROM activities
       WHERE user_id=$1 AND type='deposit' ORDER BY created_at DESC LIMIT 50`,
      [userId]
    );
    res.json({ deposits: r.rows });
  } catch (e) {
    console.error('deposit/check error', e);
    res.status(500).json({ error: String(e) });
  }
});

module.exports = router;
