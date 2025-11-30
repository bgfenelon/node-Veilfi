const express = require("express");
const router = express.Router();
const {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
} = require("@solana/web3.js");
const {
  getAssociatedTokenAddress,
  createTransferInstruction,
  createAssociatedTokenAccountInstruction,
} = require("@solana/spl-token");
const bs58 = require("bs58");
require("dotenv").config();

/* ============================================
   CONFIGURAÇÃO (.env)
============================================ */

const RPC = process.env.RPC_URL;
const connection = new Connection(RPC, "confirmed");

const TREASURY_PUBKEY = new PublicKey(process.env.TREASURY_PUBKEY);
const TREASURY_PRIVATE_KEY = bs58.decode(process.env.TREASURY_PRIVATE_KEY);
const treasuryWallet = require("@solana/web3.js").Keypair.fromSecretKey(
  TREASURY_PRIVATE_KEY
);

const TOKEN_MINT = new PublicKey(process.env.TOKEN_MINT);

const RATE = Number(process.env.SWAP_RATE || 1000); // tokens por SOL
const FEE_PERCENT = Number(process.env.SWAP_FEE_PERCENT || 2) / 100;

/* ============================================
   1. QUOTE — quanto o usuário recebe?
============================================ */

router.post("/quote", async (req, res) => {
  try {
    const { solAmount } = req.body;

    if (!solAmount || solAmount <= 0)
      return res.status(400).json({ error: "Invalid solAmount" });

    const fee = solAmount * FEE_PERCENT;
    const amountAfterFee = solAmount - fee;

    const tokens = amountAfterFee * RATE;

    return res.json({
      success: true,
      solAmount,
      feePercent: FEE_PERCENT * 100,
      amountAfterFee,
      tokens,
    });
  } catch (err) {
    console.error("QUOTE ERROR:", err);
    return res.status(500).json({ error: "Internal quote error" });
  }
});

/* ============================================
   2. TRANSACTION — gerar TX para o usuário assinar
============================================ */

router.post("/transaction", async (req, res) => {
  try {
    const { solAmount, userWallet } = req.body;

    if (!solAmount || solAmount <= 0)
      return res.status(400).json({ error: "Invalid solAmount" });

    if (!userWallet) return res.status(400).json({ error: "Missing userWallet" });

    const userPubkey = new PublicKey(userWallet);

    const fee = solAmount * FEE_PERCENT;
    const amountAfterFee = solAmount - fee;

    const lamports = Math.floor(amountAfterFee * 1_000_000_000);
    const lamportsFee = Math.floor(fee * 1_000_000_000);

    // Usuário → Treasury
    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: userPubkey,
        toPubkey: TREASURY_PUBKEY,
        lamports: lamports + lamportsFee,
      })
    );

    const blockhash = await connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash.blockhash;
    tx.feePayer = userPubkey;

    const serialized = tx.serialize({
      requireAllSignatures: false,
    });

    return res.json({
      success: true,
      transaction: serialized.toString("base64"),
      feePercent: FEE_PERCENT * 100,
    });
  } catch (err) {
    console.error("TX ERROR:", err);
    return res.status(500).json({ error: "Transaction error" });
  }
});

/* ============================================
   3. EXECUTE — enviar tokens após SOL confirmado
============================================ */

router.post("/execute", async (req, res) => {
  try {
    const { solAmount, userWallet } = req.body;

    if (!solAmount) return res.status(400).json({ error: "Missing solAmount" });
    if (!userWallet) return res.status(400).json({ error: "Missing userWallet" });

    const user = new PublicKey(userWallet);

    /* Quantidade de tokens */
    const fee = solAmount * FEE_PERCENT;
    const amountAfterFee = solAmount - fee;
    const tokenAmount = Math.floor(amountAfterFee * RATE);

    /* ATA do usuário */
    const userAta = await getAssociatedTokenAddress(TOKEN_MINT, user);
    const treasuryAta = await getAssociatedTokenAddress(
      TOKEN_MINT,
      TREASURY_PUBKEY
    );

    const tx = new Transaction();

    // criar ATA se não existe
    const info = await connection.getAccountInfo(userAta);
    if (!info) {
      tx.add(
        createAssociatedTokenAccountInstruction(
          treasuryWallet.publicKey,
          userAta,
          user,
          TOKEN_MINT
        )
      );
    }

    // enviar tokens
    tx.add(
      createTransferInstruction(
        treasuryAta,
        userAta,
        treasuryWallet.publicKey,
        tokenAmount
      )
    );

    const blockhash = await connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash.blockhash;
    tx.feePayer = treasuryWallet.publicKey;

    tx.sign(treasuryWallet);

    const signature = await connection.sendRawTransaction(tx.serialize(), {
      skipPreflight: false,
    });

    return res.json({
      success: true,
      signature,
      amountAfterFee,
      tokensSent: tokenAmount,
    });
  } catch (err) {
    console.error("EXECUTE ERROR:", err);
    return res.status(500).json({ error: "Execution error" });
  }
});

module.exports = router;
