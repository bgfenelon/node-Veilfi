const express = require("express");
const router = express.Router();
const bs58 = require("bs58");

const {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} = require("@solana/web3.js");

const {
  getOrCreateAssociatedTokenAccount,
  createTransferInstruction,
} = require("@solana/spl-token");

// === RPC MAINNET ===
const RPC_URL =
  process.env.RPC_URL ||
  "https://mainnet.helius-rpc.com/?api-key=1581ae46-832d-4d46-bc0c-007c6269d2d9";

const connection = new Connection(RPC_URL, {
  commitment: "confirmed",
});

// =======================================================
// MINTS
// =======================================================
const USDC_MINT = new PublicKey(
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
);

const VEIL_MINT = new PublicKey(
  "VSKXrgwu5mtbdSZS7Au81p1RgLQupWwYXX1L2cWpump"
);

// =======================================================
// Converter a secretKey enviada
// =======================================================
function keypairFromSecretKey(pk) {
  if (Array.isArray(pk)) {
    return Keypair.fromSecretKey(Uint8Array.from(pk));
  }

  try {
    const json = JSON.parse(pk);
    if (Array.isArray(json)) {
      return Keypair.fromSecretKey(Uint8Array.from(json));
    }
  } catch {}

  try {
    return Keypair.fromSecretKey(bs58.decode(pk));
  } catch {
    throw new Error("Invalid secret key format");
  }
}

// =======================================================
// SEND: SOL or USDC or VEIL
// =======================================================
router.post("/send", async (req, res) => {
  try {
    let { secretKey, recipient, amount, token } = req.body;

    if (!secretKey || !recipient || !amount || !token) {
      return res.status(400).json({ error: "Missing fields" });
    }

    amount = Number(amount);
    if (isNaN(amount) || amount <= 0) {
      return res.status(400).json({ error: "Invalid amount" });
    }

    const sender = keypairFromSecretKey(secretKey);
    const senderPublicKey = sender.publicKey;
    const recipientPubkey = new PublicKey(recipient);

    // ====================================================
    // 1. SOL TRANSFER
    // ====================================================
    if (token === "SOL") {
      const lamports = Math.floor(amount * 1e9); // 9 decimals

      const tx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: senderPublicKey,
          toPubkey: recipientPubkey,
          lamports,
        })
      );

      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
      tx.feePayer = senderPublicKey;

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
    }

    // ====================================================
    // 2. SPL TOKENS (USDC / VEIL)
    // ====================================================

    let mint;
    let decimals;

    if (token === "USDC") {
      mint = USDC_MINT;
      decimals = 6;
    } else if (token === "VEIL") {
      mint = VEIL_MINT;
      decimals = 6; // ajuste para o decimal real do token VEIL
    } else {
      return res.status(400).json({ error: "Invalid token" });
    }

    // ATA do sender / recipient
    const fromATA = await getOrCreateAssociatedTokenAccount(
      connection,
      sender,
      mint,
      senderPublicKey
    );

    const toATA = await getOrCreateAssociatedTokenAccount(
      connection,
      sender,
      mint,
      recipientPubkey
    );

    // Converter amount para formato SPL
    const rawAmount = Math.floor(amount * 10 ** decimals);

    const ix = createTransferInstruction(
      fromATA.address,
      toATA.address,
      senderPublicKey,
      rawAmount,
      [],
    );

    const tx = new Transaction().add(ix);

    tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    tx.feePayer = senderPublicKey;

    const signature = await sendAndConfirmTransaction(
      connection,
      tx,
      [sender],
      { skipPreflight: false, commitment: "confirmed" }
    );

    return res.json({ signature });

  } catch (err) {
    console.error("SEND ERROR:", err);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
