// server/routes/session.js
const express = require("express");
const router = express.Router();
const { getSession } = require("../sessions");

function respondSession(req, res) {
  const sessionId = req.cookies?.sessionId;

  if (!sessionId) {
    return res.status(401).json({ ok: false, error: "NO_SESSION" });
  }

  const session = getSession(sessionId);
  if (!session) {
    return res.status(401).json({ ok: false, error: "INVALID_SESSION" });
  }

  return res.json({
    ok: true,
    user: {
      walletPubkey: session.walletPubkey,
      secretKey: session.secretKey,  // <-- ESSENCIAL PARA SWAP E SEND
    },
  });
}

router.get("/me", respondSession);
router.post("/me", respondSession);

module.exports = router;
