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

    // ----------------------------------
    // 1) Carregar chave do usuário
    // ----------------------------------
    const userPublicKey = new PublicKey(carteiraUsuarioPublica);
    const userPrivateKey = Uint8Array.from(JSON.parse(carteiraUsuarioPrivada));
    const userKeypair = Keypair.fromSecretKey(userPrivateKey);

    // ----------------------------------
    // 2) Configurar direção
    // ----------------------------------
    let inputMint, outputMint, amountAtomic;

    if (direction === "SOL_TO_USDC") {
      inputMint = SOL_MINT;
      outputMint = USDC_MINT;
      amountAtomic = Math.floor(parseFloat(amount.replace(",", ".")) * 1e9);
    } else if (direction === "USDC_TO_SOL") {
      inputMint = USDC_MINT;
      outputMint = SOL_MINT;
      amountAtomic = Math.floor(parseFloat(amount.replace(",", ".")) * 1e6);
    } else {
      return res.status(400).json({ error: "Direção inválida." });
    }

    // ----------------------------------
    // 3) Obter cotação Jupiter
    // ----------------------------------
    const quoteResponse = await fetch(
      `https://quote-api.jup.ag/v6/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amountAtomic}`
    );

    const quote = await quoteResponse.json();

    if (!quote || !quote.outAmount) {
      return res.status(500).json({ error: "Falha ao obter cotação." });
    }

    // ----------------------------------
    // 4) Montar transação Jupiter
    // ----------------------------------
    const swapResp = await fetch("https://quote-api.jup.ag/v6/swap", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        quote,
        userPublicKey: userPublicKey.toBase58(),
        wrapAndUnwrapSol: true,
      }),
    });

    const swapData = await swapResp.json();

    if (!swapData.swapTransaction) {
      console.error("SwapTransaction veio vazio:", swapData);
      return res.status(500).json({ error: "Falha ao montar a transação Jupiter." });
    }

    // ----------------------------------
    // 5) Assinar e enviar
    // ----------------------------------
    const txBuffer = Buffer.from(swapData.swapTransaction, "base64");
    const transaction = VersionedTransaction.deserialize(txBuffer);

    transaction.sign([userKeypair]);

    const signature = await connection.sendRawTransaction(
      transaction.serialize(),
      { skipPreflight: false }
    );

    console.log("Assinatura do swap:", signature);

    await connection.confirmTransaction(signature, "confirmed");

    // ----------------------------------
    // 6) Retornar ao front
    // ----------------------------------
    return res.json({
      sucesso: true,
      mensagem: "Swap realizado com sucesso!",
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
