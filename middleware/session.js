// server/routes/session.js
const express = require("express");
const router = express.Router();

router.get("/me", (req, res) => {
  try {
    const sess = req.session?.sessionObject ?? null;

    if (!sess) {
      return res.json({ ok: false });
    }

    return res.json({
      ok: true,
      user: {
        walletPubkey: sess.walletPubkey || null,
        secretKey: Array.isArray(sess.secretKey) ? sess.secretKey : null,
        name: sess.name || null,
      },
    });
  } catch (err) {
    console.error("SESSION /me error:", err);
    return res.status(500).json({ ok: false, error: "SESSION_ERROR" });
  }
});

module.exports = router;
