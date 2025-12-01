// ========================
//  swap.js — Raydium SOL <-> USDC (Render Stable Version)
// ========================

require("dotenv").config();
const express = require("express");
const router = express.Router();
const {
  Connection,
  PublicKey,
  Keypair,
  Transaction,
  sendAndConfirmTransaction,
} = require("@solana/web3.js");

const bs58 = require("bs58");

// ============================================================
//  Chave: aceita qualquer formato (array, string, base58, objeto)
// ============================================================
function toUint8Array(secretKey) {
  try {
    if (secretKey instanceof Uint8Array) return secretKey;
    if (Array.isArray(secretKey)) return Uint8Array.from(secretKey);

    if (typeof secretKey === "object" && secretKey !== null) {
      const values = Object.values(secretKey);
      if (values.length === 64) return Uint8Array.from(values);
    }

    if (typeof secretKey === "string" && secretKey.trim().startsWith("[")) {
      return Uint8Array.from(JSON.parse(secretKey));
    }

    if (typeof secretKey === "string" && /^[1-9A-HJ-NP-Za-km-z]+$/.test(secretKey)) {
      return bs58.decode(secretKey);
    }

    if (typeof secretKey === "string" && secretKey.includes(",")) {
      const arr = secretKey.split(",").map(n => Number(n.trim()));
      if (arr.length === 64) return Uint8Array.from(arr);
    }

    throw new Error("Formato de secretKey inválido.");
  } catch (err) {
    console.error("ERRO CHAVE:", err);
    throw new Error("SecretKey inválida.");
  }
}

// ============================================================
//  Configurações
// ============================================================
const connection = new Connection("https://api.mainnet-beta.solana.com", "confirmed");

const USDC = "EPjFWdd5AufqSSqeM2q9HGnFz4Hh9ms4HjHpx2xJLxY";
const SOL = "So11111111111111111111111111111111111111112";

// ============================================================
//  Raydium quote endpoint
// ============================================================
async function getRaydiumQuote(inputMint, outputMint, amount) {
  const url =
    `https://api.raydium.io/v2/pools/amm/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}`;

  const res = await fetch(url);
  const json = await res.json().catch(() => null);

  if (!json || !json.outAmount) return null;

  return json;
}

// ============================================================
//  Raydium swap transaction
// ============================================================
async function getRaydiumSwapTx(quote, userPublicKey) {
  const res = await fetch("https://api.raydium.io/v2/pools/amm/swap", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      quote,
      owner: userPublicKey.toBase58(),
      wrapAndUnwrapSol: true,
    })
  });

  const json = await res.json().catch(() => null);

  if (!json || !json.transaction) return null;

  return json.transaction;
}

// ============================================================
//  🚀 Rota de Swap
// ============================================================
router.post("/usdc", async (req, res) => {
  try {
    const { carteiraUsuarioPublica, carteiraUsuarioPrivada, amount, direction } = req.body;

    if (!carteiraUsuarioPublica || !carteiraUsuarioPrivada || !amount || !direction) {
      return res.status(400).json({ error: "Dados incompletos." });
    }

    console.log("=== RAYDIUM SWAP ===");
    console.log("Public:", carteiraUsuarioPublica);

    const userUint8 = toUint8Array(carteiraUsuarioPrivada);
    const userKeypair = Keypair.fromSecretKey(userUint8);
    const userPublicKey = new PublicKey(carteiraUsuarioPublica);

    let inputMint, outputMint, amountAtomic;

    if (direction === "SOL_TO_USDC") {
      inputMint = SOL;
      outputMint = USDC;
      amountAtomic = Math.floor(amount * 1e9);
    } else if (direction === "USDC_TO_SOL") {
      inputMint = USDC;
      outputMint = SOL;
      amountAtomic = Math.floor(amount * 1e6);
    } else {
      return res.status(400).json({ error: "Direção inválida." });
    }

    // 1. Cotação
    const quote = await getRaydiumQuote(inputMint, outputMint, amountAtomic);

    if (!quote) {
      return res.status(500).json({ error: "Erro ao obter cotação Raydium." });
    }

    // 2. Criar tx
    const txBase64 = await getRaydiumSwapTx(quote, userPublicKey);

    if (!txBase64) {
      return res.status(500).json({ error: "Erro ao gerar transação Raydium." });
    }

    // 3. Converter, assinar e enviar
    const txBuffer = Buffer.from(txBase64, "base64");
    const transaction = Transaction.from(txBuffer);

    transaction.sign(userKeypair);

    const sig = await sendAndConfirmTransaction(connection, transaction, [userKeypair]);

    return res.json({
      sucesso: true,
      assinatura: sig,
      direcao: direction,
      valor_recebido: quote.outAmount,
    });

  } catch (err) {
    console.error("Erro no swap Raydium:", err);
    res.status(500).json({ error: "Erro ao realizar o swap." });
  }
});

module.exports = router;
