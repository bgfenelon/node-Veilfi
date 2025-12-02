// ========================================================
//  Jupiter Swap (Public API) — NO API KEY NEEDED
// ========================================================
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

// Solana RPC
const connection = new Connection("https://api.mainnet-beta.solana.com", "confirmed");

// ========================================================
//  Converte secret key (base58)
// ========================================================
function parsePrivateKey(raw) {
  try {
    return Keypair.fromSecretKey(bs58.decode(raw));
  } catch (err) {
    throw new Error("Chave privada inválida (não é base58)");
  }
}

// ========================================================
//  SWAP via Jupiter PUBLIC API
// ========================================================
router.post("/jupiter", async (req, res) => {
  try {
    const { carteiraUsuarioPublica, carteiraUsuarioPrivada, amount, direction } = req.body;

    if (!carteiraUsuarioPublica) return res.status(400).json({ error: "Falta walletAddress" });
    if (!carteiraUsuarioPrivada) return res.status(400).json({ error: "Falta privateKey" });

    // --------------------------------------------------------
    // 1) Escolher mints (SOL <-> USDC)
    // --------------------------------------------------------
    const SOL = "So11111111111111111111111111111111111111112";
    const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G3ky6a9qZ7bL92";

    let inputMint, outputMint, lamports;

    if (direction === "SOL_TO_USDC") {
      inputMint = SOL;
      outputMint = USDC;
      lamports = Math.floor(Number(amount) * 1e9);
    } else if (direction === "USDC_TO_SOL") {
      inputMint = USDC;
      outputMint = SOL;
      lamports = Math.floor(Number(amount) * 1e6);
    } else {
      return res.status(400).json({ error: "Direção inválida." });
    }

    console.log("=== JUPITER SWAP REQUEST ===");
    console.log("Input:", inputMint);
    console.log("Output:", outputMint);
    console.log("Amount:", lamports);

    // --------------------------------------------------------
    // 2) QUOTE
    // --------------------------------------------------------
    const quoteUrl =
      `https://public.jupiterapi.com/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${lamports}`;

    const quoteRes = await fetch(quoteUrl);
    const quoteJson = await quoteRes.json();

    if (!quoteJson.outAmount) {
      return res.status(500).json({
        error: "Jupiter quote failed",
        details: quoteJson,
      });
    }

    // --------------------------------------------------------
    // 3) PEGAR TRANSAÇÃO PRONTA
    // --------------------------------------------------------
    const swapRes = await fetch("https://public.jupiterapi.com/swap-instructions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        quoteResponse: quoteJson,
        userPublicKey: carteiraUsuarioPublica,
      }),
    });

    const swapJson = await swapRes.json();

    if (!swapJson.swapTransaction) {
      return res.status(500).json({
        error: "Swap instructions inválidas",
        details: swapJson,
      });
    }

    // --------------------------------------------------------
    // 4) ASSINAR E ENVIAR
    // --------------------------------------------------------
    const userKeypair = parsePrivateKey(carteiraUsuarioPrivada);

    const txBuffer = Buffer.from(swapJson.swapTransaction, "base64");
    const tx = VersionedTransaction.deserialize(txBuffer);

    tx.sign([userKeypair]);

    const signature = await connection.sendRawTransaction(tx.serialize(), {
      skipPreflight: false,
    });

    console.log("Swap Signature:", signature);

    return res.json({
      sucesso: true,
      signature,
      direction,
      amount,
      received: quoteJson.outAmount,
    });

  } catch (err) {
    console.error("JUPITER SWAP ERROR:", err);
    return res.status(500).json({
      error: "Erro ao executar swap.",
      details: err.message,
    });
  }
});

module.exports = router;
