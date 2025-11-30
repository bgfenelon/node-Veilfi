const express = require("express");
const router = express.Router();
const {
  Connection,
  PublicKey,
  Keypair,
  SystemProgram,
  sendAndConfirmTransaction,
  Transaction
} = require("@solana/web3.js");

// RPC principal
const RPC = process.env.RPC_URL || "https://api.mainnet-beta.solana.com";

// CARTEIRA DA TREASURY (recebe a taxa)
const TREASURY_PUBKEY = process.env.TREASURY_PUBKEY;

router.post("/send", async (req, res) => {
  try {
    let { fromPubkey, fromSecretKey, toPubkey, amount } = req.body;

    if (!fromPubkey || !fromSecretKey || !toPubkey || !amount) {
      return res.status(400).json({ error: "Missing fields" });
    }

    amount = Number(amount);
    if (isNaN(amount) || amount <= 0) {
      return res.status(400).json({ error: "Invalid amount" });
    }

    if (!TREASURY_PUBKEY) {
      return res.status(500).json({ error: "TREASURY_PUBKEY not configured" });
    }

    // Conexão
    const connection = new Connection(RPC);

    // Secret key base64 → Uint8Array
    const secretKeyBytes = Uint8Array.from(Buffer.from(fromSecretKey, "base64"));
    const userKeypair = Keypair.fromSecretKey(secretKeyBytes);

    const from = new PublicKey(fromPubkey);
    const to = new PublicKey(toPubkey);
    const treasury = new PublicKey(TREASURY_PUBKEY);

    // 🔥 CÁLCULO DA TAXA
    const fee = amount * 0.02; // 2%
    const realAmount = amount - fee;

    if (realAmount <= 0) {
      return res.status(400).json({ error: "Amount too small after fee" });
    }

    // lamports
    const lamportsToSend = Math.floor(realAmount * 1e9);
    const lamportsFee = Math.floor(fee * 1e9);

    // 🔥 CRIAÇÃO DA TRANSAÇÃO: 1) transferência para usuário 2) taxa para treasury
    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: from,
        toPubkey: to,
        lamports: lamportsToSend,
      }),
      SystemProgram.transfer({
        fromPubkey: from,
        toPubkey: treasury,
        lamports: lamportsFee,
      })
    );

    const signature = await sendAndConfirmTransaction(connection, tx, [
      userKeypair,
    ]);

    return res.json({
      success: true,
      signature,
      sent: realAmount,
      fee: fee,
      to: toPubkey,
      treasury: TREASURY_PUBKEY,
    });

  } catch (err) {
    console.error("SEND ERROR:", err);
    return res.status(500).json({
      error: "Transaction failed",
      details: err.message,
    });
  }
});

module.exports = router;
