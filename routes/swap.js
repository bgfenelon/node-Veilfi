// ========================
//  swap.js — Jupiter SOL <-> USDC (Render Stable Version)
// ========================

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

// ============================================================
//  🔥 Função DEFINITIVA para aceitar QUALQUER secretKey
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
    console.error("ERRO CONVERSÃO DE CHAVE:", err);
    throw new Error("SecretKey inválida.");
  }
}

// ============================================================
//  Config
// ============================================================
const USDC_MINT = "EPjFWdd5AufqSSqeM2q9HGnFz4Hh9ms4HjHpx2xJLxY";
const SOL_MINT = "So11111111111111111111111111111111111111112";

const connection = new Connection("https://api.mainnet-beta.solana.com", "confirmed");

// ============================================================
//  🔥 ROTA ÚNICA DO SWAP VIA JUPITER
// ============================================================
router.post("/usdc", async (req, res) => {
  try {
    const {
      carteiraUsuarioPublica,
      carteiraUsuarioPrivada,
      amount,
      direction,
    } = req.body;

    if (!carteiraUsuarioPublica || !carteiraUsuarioPrivada || !amount || !direction) {
      return res.status(400).json({ error: "Dados incompletos." });
    }

    console.log("\n=== SWAP REQUEST RECEIVED ===");
    console.log("Public:", carteiraUsuarioPublica);
    console.log("PRIVATE RAW:", carteiraUsuarioPrivada);
    console.log("TYPE:", typeof carteiraUsuarioPrivada);

    // Converter chave
    const userUint8 = toUint8Array(carteiraUsuarioPrivada);
    const userKeypair = Keypair.fromSecretKey(userUint8);
    const userPublicKey = new PublicKey(carteiraUsuarioPublica);

    // 1) Direção
    let inputMint, outputMint, amountAtomic;

    if (direction === "SOL_TO_USDC") {
      inputMint = SOL_MINT;
      outputMint = USDC_MINT;
      amountAtomic = Math.floor(Number(amount) * 1e9);
    } else if (direction === "USDC_TO_SOL") {
      inputMint = USDC_MINT;
      outputMint = SOL_MINT;
      amountAtomic = Math.floor(Number(amount) * 1e6);
    } else {
      return res.status(400).json({ error: "Direção inválida." });
    }

    // ============================================================
    //  2) COTAÇÃO — usando endpoint estável da Jupiter (sem bloqueio)
    // ============================================================
    const quoteUrl =
      `https://public.jupiterapi.com/quote/v6?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amountAtomic}`;

    const quoteResponse = await fetch(quoteUrl, {
      headers: {
        "User-Agent": "Veilfi-Server",
        "Accept": "application/json"
      }
    });

    const quote = await quoteResponse.json();

    if (!quote.outAmount) {
      console.log("ERRO AO OBTER COTAÇÃO:", quote);
      return res.status(500).json({ error: "Falha ao obter cotação Jupiter." });
    }

    // ============================================================
    //  3) ENVIAR COTAÇÃO PARA GERAR TRANSAÇÃO
    // ============================================================
    const swapResp = await fetch("https://public.jupiterapi.com/swap/v6", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "User-Agent": "Veilfi-Server",
        "Accept": "application/json"
      },
      body: JSON.stringify({
        quote,
        userPublicKey: userPublicKey.toBase58(),
        wrapAndUnwrapSol: true,
      }),
    });

    const jsonSwap = await swapResp.json();

    if (!jsonSwap.swapTransaction) {
      console.log("ERRO AO MONTAR TRANSAÇÃO:", jsonSwap);
      return res
        .status(500)
        .json({ error: "Falha ao montar transação Jupiter." });
    }

    // ============================================================
    //  4) ASSINAR E ENVIAR TRANSAÇÃO PARA A REDE SOLANA
    // ============================================================
    const txBuffer = Buffer.from(jsonSwap.swapTransaction, "base64");
    const transaction = VersionedTransaction.deserialize(txBuffer);

    transaction.sign([userKeypair]);

    const signature = await connection.sendRawTransaction(
      transaction.serialize(),
      { skipPreflight: false }
    );

    console.log("TX SIGNATURE:", signature);

    await connection.confirmTransaction(signature, "confirmed");

    return res.json({
      sucesso: true,
      assinatura: signature,
      direcao: direction,
      valor_recebido: quote.outAmount,
    });
  } catch (err) {
    console.error("Erro no swap:", err);
    return res.status(500).json({ error: "Erro ao realizar o swap." });
  }
});

module.exports = router;
