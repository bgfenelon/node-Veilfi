// ========================
//  swap.js — Jupiter SOL <-> USDC
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

// =======================================
//   Função embutida: converte qualquer
//   chave privada para Uint8Array (64 bytes)
// =======================================
function toUint8Array(secretKey) {
  try {
    // Caso seja base58 (ex: "3xhGXHvj...")
    if (typeof secretKey === "string" && !secretKey.startsWith("[")) {
      return bs58.decode(secretKey);
    }

    // Caso seja string JSON (ex: "[12,55,88...]")
    if (typeof secretKey === "string" && secretKey.startsWith("[")) {
      return Uint8Array.from(JSON.parse(secretKey));
    }

    // Caso seja array puro
    if (Array.isArray(secretKey)) {
      return Uint8Array.from(secretKey);
    }

    // Caso já seja Uint8Array
    if (secretKey instanceof Uint8Array) {
      return secretKey;
    }

    throw new Error("Formato de secretKey não reconhecido.");
  } catch (err) {
    console.error("ERRO CONVERSÃO DE CHAVE:", err);
    throw new Error("SecretKey inválida.");
  }
}

// =======================================
//   Config
// =======================================
const USDC_MINT = "EPjFWdd5AufqSSqeM2q9HGnFz4Hh9ms4HjHpx2xJLxY";
const SOL_MINT = "So11111111111111111111111111111111111111112";

const connection = new Connection("https://api.mainnet-beta.solana.com", "confirmed");

// =======================================
//     ROTA ÚNICA DE SWAP
// =======================================
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

    // 1) Carregar chave do usuário
    const userPublicKey = new PublicKey(carteiraUsuarioPublica);

    // 👉 Aqui usamos a função embutida
    const userPrivateKey = toUint8Array(carteiraUsuarioPrivada);

    const userKeypair = Keypair.fromSecretKey(userPrivateKey);

    // 2) Configurar direção
    let inputMint, outputMint, amountAtomic;

    if (direction === "SOL_TO_USDC") {
      inputMint = SOL_MINT;
      outputMint = USDC_MINT;
      amountAtomic = Math.floor(parseFloat(amount) * 1e9);
    } else if (direction === "USDC_TO_SOL") {
      inputMint = USDC_MINT;
      outputMint = SOL_MINT;
      amountAtomic = Math.floor(parseFloat(amount) * 1e6);
    } else {
      return res.status(400).json({ error: "Direção inválida." });
    }

    // 3) Obter cotação Jupiter
    const quoteResponse = await fetch(
      `https://quote-api.jup.ag/v6/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amountAtomic}`
    );
    const quote = await quoteResponse.json();

    if (!quote.outAmount) {
      return res.status(500).json({ error: "Falha ao obter cotação." });
    }

    // 4) Montar transação
    const swapResp = await fetch("https://quote-api.jup.ag/v6/swap", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        quote,
        userPublicKey: userPublicKey.toBase58(),
        wrapAndUnwrapSol: true,
      }),
    });

    const { swapTransaction } = await swapResp.json();

    if (!swapTransaction) {
      return res.status(500).json({ error: "Falha ao montar transação Jupiter." });
    }

    // 5) Assinar e enviar
    const txBuffer = Buffer.from(swapTransaction, "base64");
    const transaction = VersionedTransaction.deserialize(txBuffer);

    transaction.sign([userKeypair]);

    const signature = await connection.sendRawTransaction(
      transaction.serialize(),
      { skipPreflight: false }
    );

    console.log("Assinatura do swap:", signature);

    await connection.confirmTransaction(signature, "confirmed");

    // 6) Retorno
    return res.json({
      sucesso: true,
      assinatura: signature,
      direcao: direction,
      valor_recebido: Number(quote.outAmount),
    });

  } catch (err) {
    console.error("Erro no swap:", err);
    return res.status(500).json({ error: "Erro ao realizar o swap." });
  }
});

module.exports = router;
