// server/routes/withdraw.js
const express = require("express");
const router = express.Router();

const {
  Connection,
  PublicKey,
  Keypair,
  SystemProgram,
  Transaction
} = require("@solana/web3.js");

const { query } = require("../db");
const { decryptPrivateKey } = require("../services/crypto"); // FIXED

const RPC = process.env.RPC_URL;
const connection = new Connection(RPC, "confirmed");

router.post("/sol", async (req, res) => {
  console.log("BODY RECEIVED:", req.body);

  try {
    const { userId, passphrase, destination, amount } = req.body;

    if (!userId || !passphrase || !destination || !amount) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Load encrypted wallet from DB
    const r = await query(
      "SELECT ciphertext, iv, salt, tag, pubkey FROM users WHERE id=$1 LIMIT 1",
      [userId]
    );

    if (r.rowCount === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const { ciphertext, iv, salt, tag, pubkey } = r.rows[0];

    // decrypt private key (AES-256-GCM)
    const secretKey = decryptPrivateKey(ciphertext, passphrase, salt, iv, tag);

    const keypair = Keypair.fromSecretKey(new Uint8Array(secretKey));

    const fromPubkey = new PublicKey(pubkey);
    const toPubkey = new PublicKey(destination);
    const lamports = Math.floor(Number(amount) * 1e9);

    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey,
        toPubkey,
        lamports
      })
    );

    const signature = await connection.sendTransaction(tx, [keypair]);

    await query(
      `INSERT INTO activities (user_id, type, token, amount, signature, metadata)
       VALUES ($1,'withdraw','SOL',$2,$3,$4)`,
      [userId, lamports, signature, JSON.stringify({ to: destination })]
    );

    res.json({ success: true, signature });

  } catch (err) {
    console.error("Withdraw SOL error:", err);
    res.status(500).json({ error: String(err) });
  }
});

module.exports = router;
