// server/routes/user.js
const express = require("express");
const router = express.Router();
const { Connection, PublicKey, LAMPORTS_PER_SOL } = require("@solana/web3.js");

// MAINNET RPC — Helios (ou padrão caso não exista)
const RPC_URL =
  process.env.RPC_URL ||
  "https://mainnet.helius-rpc.com/?api-key=1581ae46-832d-4d46-bc0c-007c6269d2d9";

// ROTA: RETORNA DADOS DO USUÁRIO LOGADO
router.get("/me", (req, res) => {
  if (!req.sessionObject) return res.json({ ok: false });
  return res.json({ ok: true, user: req.sessionObject });
});

// ROTA: BUSCAR SALDO MAINNET
router.post("/balance", async (req, res) => {
  try {
    const { userPubkey } = req.body;

    if (!userPubkey) {
      return res.status(400).json({ error: "Missing userPubkey" });
    }

    const pubkey = new PublicKey(userPubkey);

    // conexão REAL da MAINNET ✔
    const conn = new Connection(RPC_URL, "confirmed");

    const lamports = await conn.getBalance(pubkey);

    return res.json({
      balance: lamports / LAMPORTS_PER_SOL, // conversão mais segura
    });

  } catch (err) {
    console.error("Balance error:", err);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
