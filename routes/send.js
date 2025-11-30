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
} = require("@solana/web3.js");

// === MAINNET REAL ===
const RPC_URL =
  process.env.RPC_URL ||
  "https://mainnet.helius-rpc.com/?api-key=1581ae46-832d-4d46-bc0c-007c6269d2d9";

const connection = new Connection(RPC_URL, {
  commitment: "confirmed",
});

// Converte a secretKey recebida (array / base58 / json)
function keypairFromSecretKey(pk) {
  // array direto
  if (Array.isArray(pk)) {
    return Keypair.fromSecretKey(Uint8Array.from(pk));
  }

  // JSON
  try {
    const json = JSON.parse(pk);
    if (Array.isArray(json)) {
      return Keypair.fromSecretKey(Uint8Array.from(json));
    }
  } catch {}

  // base58
  try {
    return Keypair.fromSecretKey(bs58.decode(pk));
  } catch (err) {
    throw new Error("Invalid secret key format");
  }
}

// ========== SEND REAL SOL ==========
router.post("/send", async (req, res) => {
  try {
    let { secretKey, recipient, amount } = req.body;

    if (!secretKey || !recipient || !amount) {
      return res.status(400).json({ error: "Missing fields" });
    }

    // Amount sempre em número
    amount = Number(amount);
    if (isNaN(amount) || amount <= 0) {
      return res.status(400).json({ error: "Invalid amount" });
    }

    const sender = keypairFromSecretKey(secretKey);
    const to = new PublicKey(recipient);

    const lamports = Math.floor(amount * LAMPORTS_PER_SOL);

    // Criar transação REAL
    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: sender.publicKey,
        toPubkey: to,
        lamports,
      })
    );

    tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    tx.feePayer = sender.publicKey;

    const signature = await sendAndConfirmTransaction(
      connection,
      tx,
      [sender],
      {
        skipPreflight: false,
        commitment: "confirmed",
      }
    );

    return res.json({ signature });

  } catch (err) {
    console.error("SEND ERROR:", err);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
