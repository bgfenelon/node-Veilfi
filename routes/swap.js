// =============================================================
// VeilFi - Jupiter Public Swap (Render Compatible)
// =============================================================
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

// RPC normal
const connection = new Connection(
  "https://api.mainnet-beta.solana.com",
  "confirmed"
);

// =============================================================
// Converte base58 -> Keypair (sem crashes)
// =============================================================
function parsePrivateKey(raw) {
  try {
    const decoded = bs58.decode(String(raw).trim());
    return Keypair.fromSecretKey(decoded);
  } catch (e) {
    console.error("Erro parsePrivateKey:", e);
    throw new Error("Chave privada inválida.");
  }
}

// =============================================================
//  SWAP Jupiter (Public API) — 100% compatível Render
// =============================================================
router.post("/jupiter", async (req, res) => {
  try {
    const {
      carteiraUsuarioPublica,
      carteiraUsuarioPrivada,
      amount,
      direction,
    } = req.body;

    if (!carteiraUsuarioPublicica || !carteiraUsuarioPrivada) {
      return res.status(400).json({ error: "Dados incompletos." });
    }

    // Tokens oficiais
    const SOL = "So11111111111111111111111111111111111111112";
    const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G3ky6a9qZ7bL92";

    let inputMint, outputMint, atomicAmount;

    if (direction === "SOL_TO_USDC") {
      inputMint = SOL;
      outputMint = USDC;
      atomicAmount = Math.floor(amount * 1e9);
    } else if (direction === "USDC_TO_SOL") {
      inputMint = USDC;
      outputMint = SOL;
      atomicAmount = Math.floor(amount * 1e6);
    } else {
      return res.status(400).json({ error: "Direção inválida." });
    }

    // ============================================================
    // 1) QUOTE Jupiter Public API
    // ============================================================
    const quoteUrl =
      `https://public.jupiterapi.com/quote?inputMint=${inputMint}` +
      `&outputMint=${outputMint}&amount=${atomicAmount}`;

    const quoteRes = await fetch(quoteUrl);
    const quoteJson = await quoteRes.json();

    if (!quoteJson || !quoteJson.outAmount) {
      return res.status(500).json({
        error: "Falha ao obter cotação.",
        details: quoteJson,
      });
    }

    // ============================================================
    // 2) Swap Instructions
    // ============================================================
    const instRes = await fetch(
      "https://public.jupiterapi.com/swap-instructions",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          quoteResponse: quoteJson,
          userPublicKey: carteiraUsuarioPublica,
        }),
      }
    );

    const instJson = await instRes.json();

    if (!instJson.swapTransaction) {
      return res.status(500).json({
        error: "SwapTransaction inválida.",
        details: instJson,
      });
    }

    // ============================================================
    // 3) Assinar transação
    // ============================================================
    const txBuffer = Buffer.from(instJson.swapTransaction, "base64");
    const tx = VersionedTransaction.deserialize(txBuffer);

    const keypair = parsePrivateKey(carteiraUsuarioPrivada);

    tx.sign([keypair]);

    // ============================================================
    // 4) Enviar
    // ============================================================
    const sig = await connection.sendRawTransaction(tx.serialize(), {
      skipPreflight: false,
    });

    await connection.confirmTransaction(sig, "confirmed");

    return res.json({
      sucesso: true,
      signature: sig,
      direction,
      amount,
      received: quoteJson.outAmount,
    });

  } catch (err) {
    console.error("ERRO NO SWAP:", err);
    return res.status(500).json({
      error: "Erro ao executar swap.",
      details: err.message,
    });
  }
});

module.exports = router;
