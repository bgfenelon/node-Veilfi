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

const RPC = process.env.RPC_URL || "https://api.devnet.solana.com";
const connection = new Connection(RPC, "confirmed");

router.post("/send", async (req, res) => {
  try {
    const sess = req.session?.sessionObject;

    if (!sess) return res.status(401).json({ ok: false, error: "NO_SESSION" });

    const { secretKey, walletPubkey } = sess;
    const { to, amount } = req.body;

    if (!Array.isArray(secretKey) || secretKey.length !== 64) {
      return res.status(400).json({ ok: false, error: "INVALID_SECRET_KEY" });
    }

    const fromKeypair = Keypair.fromSecretKey(
      Uint8Array.from(secretKey)
    );

    const toPubkey = new PublicKey(to);
    const lamports = Math.floor(Number(amount) * 1e9);

    const instr = SystemProgram.transfer({
      fromPubkey: fromKeypair.publicKey,
      toPubkey,
      lamports,
    });

    const tx = new Transaction().add(instr);

    const latest = await connection.getLatestBlockhash();
    tx.recentBlockhash = latest.blockhash;
    tx.feePayer = fromKeypair.publicKey;

    const signature = await sendAndConfirmTransaction(
      connection,
      tx,
      [fromKeypair]
    );

    res.json({
      ok: true,
      signature,
      explorer: `https://explorer.solana.com/tx/${signature}?cluster=devnet`,
    });

  } catch (e) {
    console.error("SEND ERROR:", e);
    res.status(500).json({ ok: false, error: "SEND_FAILED", details: e.message });
  }
});

module.exports = router;
