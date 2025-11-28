// routes/swapBuyConfirm.js
const express = require("express");
const dotenv = require("dotenv");
const { Connection, PublicKey, Transaction, Keypair } = require("@solana/web3.js");
const splToken = require("@solana/spl-token");
const axios = require("axios");
dotenv.config();

const router = express.Router();

const RPC_URL = process.env.RPC_URL;
const TOKEN_MINT = process.env.TOKEN_MINT;

const SITE_SECRET_KEY = process.env.SITE_SECRET_KEY;
const SITE_PUBLIC_KEY = process.env.SITE_PUBLIC_KEY;

const connection = new Connection(RPC_URL, "confirmed");

const bs58 = require("bs58");

// parse secreta
function loadKeypair() {
  try {
    if (SITE_SECRET_KEY.trim().startsWith("[")) {
      const arr = JSON.parse(SITE_SECRET_KEY);
      return Keypair.fromSecretKey(Buffer.from(arr));
    } else {
      return Keypair.fromSecretKey(bs58.decode(SITE_SECRET_KEY));
    }
  } catch (err) {
    console.error("Erro carregando chave secreta:", err);
    return null;
  }
}

const SITE_KEYPAIR = loadKeypair();

let pendingOrders = require("./swapBuyInit").pendingOrders || {}; // se quiser compartilhar memória

router.post("/buy/confirm", express.json(), async (req, res) => {
  try {
    const { orderId, paymentSignature } = req.body;

    if (!orderId || !paymentSignature) {
      return res.status(400).json({ success: false, message: "orderId e paymentSignature são obrigatórios" });
    }

    const order = pendingOrders[orderId];
    if (!order) {
      return res.status(404).json({ success: false, message: "Pedido não encontrado" });
    }

    const buyer = new PublicKey(order.buyer);

    // buscar transação do pagamento
    const tx = await connection.getTransaction(paymentSignature, { commitment: "confirmed" });
    if (!tx) {
      return res.status(400).json({ success: false, message: "Transação não encontrada ou não confirmada" });
    }

    // verifica se a transação enviou SOL para sua carteira
    const paidSite = tx.transaction.message.accountKeys.some(
      key => key.toString() === SITE_PUBLIC_KEY
    );

    if (!paidSite) {
      return res.status(400).json({
        success: false,
        message: "Essa transação não enviou SOL para sua carteira admin"
      });
    }

    // Agora enviar VEIL ao usuário

    const mint = new PublicKey(TOKEN_MINT);

    // cria conta associada (ATA) se não existir
    const siteATA = await splToken.getOrCreateAssociatedTokenAccount(
      connection,
      SITE_KEYPAIR,
      mint,
      SITE_KEYPAIR.publicKey
    );

    const userATA = await splToken.getOrCreateAssociatedTokenAccount(
      connection,
      SITE_KEYPAIR,
      mint,
      buyer
    );

    const txSend = new Transaction().add(
      splToken.createTransferInstruction(
        siteATA.address,
        userATA.address,
        SITE_KEYPAIR.publicKey,
        BigInt(order.tokensSmallest)
      )
    );

    const signature = await connection.sendTransaction(txSend, [SITE_KEYPAIR]);
    await connection.confirmTransaction(signature, "confirmed");

    // remover pedido
    delete pendingOrders[orderId];

    return res.json({
      success: true,
      contractSignature: signature,
      tokensSent: order.tokensSmallest
    });

  } catch (err) {
    console.error("swapBuyConfirm error:", err);
    return res.status(500).json({ success: false, message: "Erro interno", details: err?.message });
  }
});

module.exports = router;
