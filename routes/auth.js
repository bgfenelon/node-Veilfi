// server/routes/auth.js
const express = require("express");
const router = express.Router();
const { Keypair } = require("@solana/web3.js");

router.post("/import", async (req, res) => {
  try {
    const { input, name } = req.body;

    if (!input) return res.status(400).json({ ok: false, error: "NO_INPUT" });

    let arr = input;

    // Se vier string → tentar parse
    if (typeof arr === "string") {
      try {
        arr = JSON.parse(arr);
      } catch {
        return res.status(400).json({ ok: false, error: "BAD_INPUT_FORMAT" });
      }
    }

    arr = Array.from(arr);

    if (!Array.isArray(arr) || arr.length !== 64) {
      return res.status(400).json({ ok: false, error: "INVALID_SECRET_KEY_LENGTH" });
    }

    let keypair;
    try {
      keypair = Keypair.fromSecretKey(Uint8Array.from(arr));
    } catch (e) {
      return res.status(400).json({
        ok: false,
        error: "INVALID_KEYPAIR",
        details: e.message,
      });
    }

    req.session.sessionObject = {
      walletPubkey: keypair.publicKey.toBase58(),
      secretKey: arr,
      name: name || null,
    };

    req.session.save(() => {
      return res.json({
        ok: true,
        walletPubkey: keypair.publicKey.toBase58(),
      });
    });

  } catch (err) {
    console.error("AUTH IMPORT ERROR:", err);
    res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
  }
});

module.exports = router;
