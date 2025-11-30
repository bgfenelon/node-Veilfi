// server/routes/auth.js
const express = require("express");
const router = express.Router();
const { Keypair } = require("@solana/web3.js");

router.post("/import", async (req, res) => {
  try {
    const { input, name } = req.body;

    if (!input) {
      console.warn("IMPORT: no input provided");
      return res.status(400).json({ ok: false, error: "NO_INPUT" });
    }

    // input é uma string JSON contendo um array (ex: "[1,2,...]" )
    let arr;
    try {
      arr = JSON.parse(input);
    } catch (err) {
      console.warn("IMPORT: BAD_SECRET_KEY - cannot parse input:", err && err.message);
      return res.status(400).json({ ok: false, error: "BAD_SECRET_KEY" });
    }

    if (!Array.isArray(arr) || arr.length !== 64) {
      console.warn("IMPORT: INVALID_SECRET_KEY - not array or wrong length", Array.isArray(arr) ? arr.length : typeof arr);
      return res.status(400).json({ ok: false, error: "INVALID_SECRET_KEY" });
    }

    // Converter para Uint8Array e criar keypair
    let secretKey;
    try {
      secretKey = Uint8Array.from(arr);
    } catch (err) {
      console.error("IMPORT: failed to build Uint8Array:", err);
      return res.status(400).json({ ok: false, error: "BAD_SECRET_KEY" });
    }

    let keypair;
    try {
      keypair = Keypair.fromSecretKey(secretKey);
    } catch (err) {
      console.error("IMPORT: Keypair.fromSecretKey failed:", err && err.message);
      return res.status(400).json({ ok: false, error: "INVALID_KEYPAIR" });
    }

    // Garantir req.session existe
    if (!req.session) {
      console.error("IMPORT: req.session is undefined! session middleware not applied?");
      return res.status(500).json({ ok: false, error: "NO_SESSION_MIDDLEWARE" });
    }

    // Salvar na sessão (sessionObject)
    req.session.sessionObject = {
      walletPubkey: keypair.publicKey.toBase58(),
      secretKey: Array.from(secretKey),
      name: name || null,
    };

    // Salvar e retornar OK (session cookie será enviado automaticamente)
    req.session.save((err) => {
      if (err) {
        console.error("IMPORT: req.session.save error:", err);
        return res.status(500).json({ ok: false, error: "SESSION_SAVE_FAILED" });
      }

      console.log("IMPORT: session saved for", keypair.publicKey.toBase58());
      return res.json({ ok: true, walletPubkey: keypair.publicKey.toBase58() });
    });
  } catch (e) {
    console.error("IMPORT ERROR (unexpected):", e);
    return res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
  }
});

module.exports = router;
