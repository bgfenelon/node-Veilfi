// server/routes/auth.js
const express = require("express");
const router = express.Router();
const bs58 = require("bs58");
const { Keypair, PublicKey } = require("@solana/web3.js");

// ======================================================
// IMPORT WALLET (PRIVATE KEY EM ARRAY DE 64 BYTES)
// ======================================================
router.post("/import", async (req, res) => {
  try {
    const { input, name } = req.body;

    if (!input) {
      return res.status(400).json({ ok: false, error: "NO_INPUT" });
    }

    // Conversão do secretKey vindo do frontend
    let arr;
    try {
      arr = JSON.parse(input); // recebe string JSON do frontend
    } catch {
      return res.status(400).json({ ok: false, error: "BAD_SECRET_KEY" });
    }

    if (!Array.isArray(arr) || arr.length !== 64) {
      return res.status(400).json({ ok: false, error: "INVALID_SECRET_KEY" });
    }

    // Criar keypair
    const secretKey = Uint8Array.from(arr);
    const keypair = Keypair.fromSecretKey(secretKey);

    // SALVAR NA SESSÃO
    req.session.sessionObject = {
      walletPubkey: keypair.publicKey.toBase58(),
      secretKey: arr, // array puro, o frontend precisa disso
      name: name || null,
    };

    req.session.save(() => {
      return res.json({
        ok: true,
        walletPubkey: keypair.publicKey.toBase58(),
      });
    });
  } catch (e) {
    console.error("IMPORT ERROR:", e);
    return res.status(500).json({ ok: false, error: "INTERNAL_IMPORT_ERROR" });
  }
});

module.exports = router;
