const express = require("express");
const router = express.Router();
const bs58 = require("bs58");
const {
  Connection,
  Keypair,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
  PublicKey,
  LAMPORTS_PER_SOL,
  clusterApiUrl,
} = require("@solana/web3.js");

// RPC connection
const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

// Convert secret key to Keypair
function keypairFromSecretKey(pk) {
  try {
    if (Array.isArray(pk)) {
      return Keypair.fromSecretKey(Uint8Array.from(pk));
    }

    const parsed = JSON.parse(pk);
    if (Array.isArray(parsed)) {
      return Keypair.fromSecretKey(Uint8Array.from(parsed));
    }
  } catch {}

  try {
    return Keypair.fromSecretKey(bs58.decode(pk));
  } catch {
    throw new Error("Invalid secret key");
  }
}

router.post("/send", async (req, res) => {
  console.log("📩 BODY RECEBIDO:", req.body);

  try {
    const { secretKey, recipient, amount } = req.body;

    if (!secretKey || !recipient || amount === undefined) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const numericAmount = Number(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ error: "Invalid amount" });
    }

    const from = keypairFromSecretKey(secretKey);
    const to = new PublicKey(recipient);
    const lamports = Math.floor(numericAmount * LAMPORTS_PER_SOL);

    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: from.publicKey,
        toPubkey: to,
        lamports,
      })
    );

    const signature = await sendAndConfirmTransaction(connection, tx, [from]);

    return res.json({ signature });

  } catch (err) {
    console.error("❌ SEND ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
