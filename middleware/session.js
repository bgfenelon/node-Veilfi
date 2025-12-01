// server/routes/session.js
const express = require("express");
const router = express.Router();

router.get("/me", (req, res) => {
  try {
    const sess = req.session?.sessionObject ?? null;

    if (!sess) {
      return res.json({ ok: false, user: null });
    }

    let secretKey = sess.secretKey;

    // 🔥 Normalizar secretKey: garantir ARRAY REAL
    if (typeof secretKey === "string") {
      try {
        const parsed = JSON.parse(secretKey);
        if (Array.isArray(parsed) && parsed.length === 64) {
          secretKey = parsed;
        } else {
          secretKey = null;
        }
      } catch {
        secretKey = null;
      }
    }

    // Se for array mas não tiver 64 bytes, também é inválido
    if (Array.isArray(secretKey) && secretKey.length !== 64) {
      secretKey = null;
    }

    return res.json({
      ok: true,
      user: {
        walletPubkey: sess.walletPubkey || null,
        secretKey: secretKey,
        name: sess.name || null,
      },
    });

  } catch (e) {
    console.error("SESSION ERROR:", e);
    return res.status(500).json({ ok: false, error: "SESSION_ERROR" });
  }
});

module.exports = router;
