// server/routes/wallet.js

const express = require("express");
const router = express.Router();
const {
  Connection,
  PublicKey,
  Keypair,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} = require("@solana/web3.js");
const bs58 = require("bs58");

const RPC = process.env.RPC_URL;
const connection = new Connection(RPC, "confirmed");

/* ============================================================
   SEND SOL (sem requireAuth)
============================================================ */
router.post("/send", async (req, res) => {
  try {
    const { fromSecret, to, amount } = req.body;

    if (!fromSecret || !to || !amount) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const sender = Keypair.fromSecretKey(Buffer.from(JSON.parse(fromSecret)));

    const recipient = new PublicKey(to);

    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: sender.publicKey,
        toPubkey: recipient,
        lamports: Math.floor(amount * 1_000_000_000),
      })
    );

    const signature = await sendAndConfirmTransaction(connection, tx, [sender]);

    return res.json({
      ok: true,
      signature,
    });
  } catch (err) {
    console.log("SEND ERROR:", err);
    return res.status(500).json({ error: err.message });
  }
});

/* ============================================================
   Address (já estava correto)
============================================================ */
router.get("/address", (req, res) => {
  return res.json({ ok: true, address: req.sessionObject?.walletPubkey });
});

module.exports = router;
