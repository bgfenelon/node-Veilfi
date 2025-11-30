// server/routes/user.js
const express = require("express");
const router = express.Router();
const { Connection, PublicKey } = require("@solana/web3.js");

const RPC_URL = process.env.RPC_URL || "https://api.mainnet-beta.solana.com";

// ROTA: RETORNA DADOS DO USUÁRIO LOGADO
router.get("/me", (req, res) => {
  if (!req.sessionObject) return res.json({ ok: false });
  return res.json({ ok: true, user: req.sessionObject });
});

// ROTA: BUSCAR SALDO DA CARTEIRA
router.post("/balance", async (req, res) => {
  try {
    const { userPubkey } = req.body;
    if (!userPubkey) {
      return res.status(400).json({ error: "Missing userPubkey" });
    }

    const pubkey = new PublicKey(userPubkey);
    const conn = new Connection(RPC_URL, "confirmed");

    const lamports = await conn.getBalance(pubkey);
    
    return res.json({ balance: lamports / 1_000_000_000 });
  } catch (err) {
    console.error("Balance error:", err);
    return res.status(500).json({ error: "Failed to fetch balance" });
  }
});

module.exports = router;
