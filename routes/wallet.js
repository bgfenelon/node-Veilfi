// routes/wallet.js
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
  sendAndConfirmRawTransaction,
} = require("@solana/web3.js");

const connection = new Connection(clusterApiUrl("mainnet-beta"), "confirmed"); // ou 'mainnet-beta' ou devnet

// helper: converte secretKey (array/string/base58) para Keypair
function keypairFromSecretKey(pk) {
  if (!pk) throw new Error("No secret key provided");
  if (Array.isArray(pk)) return Keypair.fromSecretKey(Uint8Array.from(pk));
  try {
    const parsed = JSON.parse(pk);
    if (Array.isArray(parsed)) return Keypair.fromSecretKey(Uint8Array.from(parsed));
  } catch (e) { /* ignore */ }
  try {
    return Keypair.fromSecretKey(bs58.decode(pk));
  } catch (e) {
    throw new Error("Invalid secret key format");
  }
}

router.post("/send", async (req, res) => {
  try {
    console.log("📩 /wallet/send body:", req.body);

    const { secretKey, recipient, amount, senderAddress } = req.body;

    if (!secretKey || !recipient || amount === undefined) {
      return res.status(400).json({ error: "Missing fields" });
    }

    // normalize amount (accept comma or dot)
    const numericAmount = Number(String(amount).replace(",", "."));
    if (isNaN(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ error: "Invalid amount" });
    }

    // build keypair and check publicKey
    const sender = keypairFromSecretKey(secretKey);
    const senderPub = sender.publicKey.toBase58();
    console.log("From publicKey (derived):", senderPub);
    if (senderAddress && senderAddress !== senderPub) {
      console.warn("Sender address mismatch:", senderAddress, "vs", senderPub);
      // opcional: retornar erro ou só logar; aqui vamos retornar erro
      return res.status(400).json({ error: "Sender address does not match provided secretKey" });
    }

    const toPub = new PublicKey(recipient);
    const lamports = Math.round(numericAmount * LAMPORTS_PER_SOL);

    // montar transação
    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: sender.publicKey,
        toPubkey: toPub,
        lamports,
      })
    );

    // SIMULAR primeiro para pegar erros e logs
    const { value } = await connection.simulateTransaction(tx, [sender]);
    if (value && value.err) {
      console.error("Simulation failed:", value);
      return res.status(400).json({
        error: "Simulation failed.",
        message: value.err,
        logs: value.logs || [],
      });
    }

    // enviar e confirmar
    const signature = await sendAndConfirmTransaction(connection, tx, [sender]);
    return res.json({ signature });

  } catch (err) {
    console.error("SEND ERROR:", err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

module.exports = router;
