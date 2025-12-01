// ==========================================================
//   swap.js — Universal Swap (Jupiter Aggregator API)
// ==========================================================

require("dotenv").config();
const express = require("express");
const router = express.Router();
const {
  Connection,
  PublicKey,
  Keypair,
  VersionedTransaction,
} = require("@solana/web3.js");

const bs58 = require("bs58");
const fetch = require("node-fetch");

// ==========================================================
// Convert private key (base58 or JSON array)
// ==========================================================
function toUint8Array(secretKey) {
  try {
    if (!secretKey) throw new Error("SecretKey vazia.");

    if (typeof secretKey === "string" && !secretKey.startsWith("[")) {
      return bs58.decode(secretKey); // base58
    }

    if (typeof secretKey === "string" && secretKey.startsWith("[")) {
      return Uint8Array.from(JSON.parse(secretKey)); // JSON array
    }

    if (Array.isArray(secretKey)) return Uint8Array.from(secretKey);

    throw new Error("Formato desconhecido de secretKey.");
  } catch (err) {
    console.error("Erro convertendo chave:", err);
    throw new Error("Chave privada inválida.");
  }
}

// ==========================================================
// RPC
// ==========================================================
const connection = new Connection(
  "https://api.mainnet-beta.solana.com",
  "confirmed"
);

// ==========================================================
//  UNIVERSAL SWAP VIA JUPITER
// ==========================================================
router.post("/jupiter", async (req, res) => {
  try {
    console.log("=== JUPITER SWAP REQUEST ===");

    const {
      carteiraUsuarioPublica,
      carteiraUsuarioPrivada,
      amount,
      inputMint,
      outputMint,
    } = req.body;

    if (!carteiraUsuarioPublica || !carteiraUsuarioPrivada || !amount) {
      return res.status(400).json({ error: "Dados incompletos." });
    }

    const userPubkey = new PublicKey(carteiraUsuarioPublica.trim());
    const privateKeyArray = toUint8Array(carteiraUsuarioPrivada);
    const userKeypair = Keypair.fromSecretKey(privateKeyArray);

    console.log("Input Mint:", inputMint);
    console.log("Output Mint:", outputMint);
    console.log("Amount:", amount);

    // ==========================================================
    // 1 — GET QUOTE (Jupiter API)
    // ==========================================================
    const quoteUrl =
      `https://quote-api.jup.ag/v6/quote?` +
      `inputMint=${inputMint}&` +
      `outputMint=${outputMint}&` +
      `amount=${amount}&` +
      `slippageBps=50`; // 0.5%

    console.log("QUOTE URL:", quoteUrl);

    const quoteResponse = await fetch(quoteUrl);
    const quote = await quoteResponse.json();

    console.log("JUPITER QUOTE RAW:", quote);

    if (!quote || !quote.routePlan) {
      return res.status(500).json({
        error: "Jupiter não retornou rota válida.",
        details: quote,
      });
    }

    // ==========================================================
    // 2 — GET SWAP TRANSACTION
    // ==========================================================
    const swapResponse = await fetch(
      "https://quote-api.jup.ag/v6/swap-instructions",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          quoteResponse: quote,
          userPublicKey: userPubkey.toBase58(),
          wrapAndUnwrapSol: true,
        }),
      }
    );

    const swapJson = await swapResponse.json();

    console.log("SWAP INSTRUCTIONS RAW:", swapJson);

    if (!swapJson.swapTransaction) {
      return res.status(500).json({
        error: "Jupiter não retornou transação de swap.",
        details: swapJson,
      });
    }

    // ==========================================================
    // 3 — ASSINAR & ENVIAR TRANSAÇÃO
    // ==========================================================
    const swapTxBuf = Buffer.from(swapJson.swapTransaction, "base64");
    const transaction = VersionedTransaction.deserialize(swapTxBuf);

    transaction.sign([userKeypair]);

    const signature = await connection.sendRawTransaction(
      transaction.serialize()
    );

    console.log("Tx Signature:", signature);

    await connection.confirmTransaction(signature, "confirmed");

    // ==========================================================
    // 4 — SUCESSO
    // ==========================================================
    return res.json({
      sucesso: true,
      assinatura: signature,
      quote: quote.outAmount,
    });

  } catch (err) {
    console.error("ERRO NO JUPITER SWAP:", err);
    return res.status(500).json({
      error: "Erro ao executar swap.",
      details: err.message,
    });
  }
});

module.exports = router;
