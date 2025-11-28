const express = require("express");
const router = express.Router();
const { connection, platformKeypair, platformPubkey, tokenMint } = require("../services/solana");
const { TOKEN_PRICE_SOL, TOKEN_DECIMALS } = require("../env");
const { getOrCreateAssociatedTokenAccount, transfer } = require("@solana/spl-token");
const { PublicKey } = require("@solana/web3.js");

router.post("/init", async (req, res) => {
  const { buyer } = req.body;

  if (!buyer) return res.json({ success: false, message: "buyer obrigatório" });

  const orderId = "ORDER_" + Math.random().toString(36).substring(2, 10);

  res.json({
    success: true,
    orderId,
    walletToPay: platformPubkey.toBase58(),
  });
});

router.post("/confirm", async (req, res) => {
  try {
    const { orderId, paymentSignature, buyer } = req.body;

    if (!orderId || !paymentSignature || !buyer)
      return res.json({ success: false, message: "Campos obrigatórios" });

    const tx = await connection.getTransaction(paymentSignature, {
      maxSupportedTransactionVersion: 0,
    });

    if (!tx) return res.json({ success: false, message: "TX não encontrada" });

    const solPaid = tx.meta.postBalances[0] - tx.meta.preBalances[0];
    const solReal = solPaid / 1e9;

    const tokens = solReal / TOKEN_PRICE_SOL;
    const tokensSmallest = Math.floor(tokens * 10 ** TOKEN_DECIMALS);

    const buyerPubkey = new PublicKey(buyer);

    const buyerAta = await getOrCreateAssociatedTokenAccount(connection, platformKeypair, tokenMint, buyerPubkey);
    const platformAta = await getOrCreateAssociatedTokenAccount(connection, platformKeypair, tokenMint, platformKeypair.publicKey);

    const sig = await transfer(
      connection,
      platformKeypair,
      platformAta.address,
      buyerAta.address,
      platformKeypair,
      tokensSmallest
    );

    res.json({
      success: true,
      contractSignature: sig,
      tokensSent: tokensSmallest,
    });
  } catch (err) {
    console.error(err);
    res.json({ success: false, message: "Erro interno" });
  }
});

module.exports = router;
