// controllers/walletController.js
require("dotenv").config();
const {
  Connection,
  PublicKey,
  Keypair,
  SystemProgram,
  LAMPORTS_PER_SOL,
  Transaction,
  sendAndConfirmTransaction
} = require("@solana/web3.js");

const RPC =
  process.env.RPC_URL &&
  (process.env.RPC_URL.startsWith("http://") || process.env.RPC_URL.startsWith("https://"))
    ? process.env.RPC_URL
    : "https://api.mainnet-beta.solana.com";

console.log("⚡ Using RPC:", RPC);

const connection = new Connection(RPC, {
  commitment: "confirmed",
});

exports.sendSOL = async (req, res) => {
  try {
    const { fromSecretKey, to, amount } = req.body;

    console.log("📦 SEND REQUEST:", req.body);

    if (!fromSecretKey || !to || !amount) {
      return res.status(400).json({ error: "Missing params" });
    }

    const sender = Keypair.fromSecretKey(Uint8Array.from(fromSecretKey));
    const toPubkey = new PublicKey(to);

    const lamports = Math.floor(amount * LAMPORTS_PER_SOL);

    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: sender.publicKey,
        toPubkey,
        lamports,
      })
    );

    const signature = await sendAndConfirmTransaction(connection, tx, [sender]);

    res.json({
      success: true,
      signature,
    });

  } catch (err) {
    console.error("❌ SEND ERROR:", err);
    res.status(500).json({ error: "Failed sending SOL" });
  }
};
