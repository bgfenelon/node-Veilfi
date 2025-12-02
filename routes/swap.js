// ========================================================
//  Jupiter Swap (API Atualizada) - COM MINT CORRETO
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

// Conexão RPC (recomendo usar uma RPC rápida)
const connection = new Connection(
  "https://solana-mainnet.g.alchemy.com/v2/demo", // Use sua própria ou alchemy
  "confirmed"
);

// Mints CORRETOS para Solana Mainnet
const SOL_MINT = "So11111111111111111111111111111111111111112";
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"; // ← USDC CORRETO

// ========================================================
//  Parse da chave privada
// ========================================================
function parsePrivateKey(secretKey) {
  try {
    // Se for string JSON array
    if (secretKey.startsWith("[")) {
      const arr = JSON.parse(secretKey);
      return Keypair.fromSecretKey(new Uint8Array(arr));
    }
    // Se for base58 (como no seu exemplo)
    return Keypair.fromSecretKey(bs58.decode(secretKey));
  } catch (err) {
    console.error("Erro ao parsear chave:", err.message);
    throw new Error(`Formato de chave inválido: ${err.message}`);
  }
}

// ========================================================
//  SWAP via Jupiter API (funcional)
// ========================================================
router.post("/jupiter", async (req, res) => {
  try {
    console.log("=== SWAP REQUEST ===", {
      wallet: req.body.carteiraUsuarioPublica?.substring(0, 8) + "...",
      direction: req.body.direction,
      amount: req.body.amount
    });
    
    const { 
      carteiraUsuarioPublica, 
      carteiraUsuarioPrivada, 
      amount, 
      direction 
    } = req.body;

    // Validações básicas
    if (!carteiraUsuarioPublica || !carteiraUsuarioPrivada) {
      return res.status(400).json({ 
        success: false,
        error: "Wallet e chave privada são obrigatórios" 
      });
    }

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ 
        success: false,
        error: `Amount inválido: ${amount}` 
      });
    }

    // Verificar direction
    if (!["SOL_TO_USDC", "USDC_TO_SOL"].includes(direction)) {
      return res.status(400).json({ 
        success: false,
        error: "Direction inválida" 
      });
    }

    // Configurar mints e converter amount
    let inputMint, outputMint, amountInSmallestUnits;
    let inputSymbol, outputSymbol;

    if (direction === "SOL_TO_USDC") {
      inputMint = SOL_MINT;
      outputMint = USDC_MINT;
      amountInSmallestUnits = Math.floor(numAmount * 1e9); // SOL -> lamports
      inputSymbol = "SOL";
      outputSymbol = "USDC";
    } else { // USDC_TO_SOL
      inputMint = USDC_MINT;
      outputMint = SOL_MINT;
      amountInSmallestUnits = Math.floor(numAmount * 1e6); // USDC -> micro USDC
      inputSymbol = "USDC";
      outputSymbol = "SOL";
    }

    console.log(`Swap config: ${numAmount} ${inputSymbol} -> ${outputSymbol}`);
    console.log(`Input mint: ${inputMint}`);
    console.log(`Output mint: ${outputMint}`);
    console.log(`Amount in smallest units: ${amountInSmallestUnits}`);

    // ========================================================
    // 1. OBTER QUOTE
    // ========================================================
    const quoteUrl = `https://quote-api.jup.ag/v6/quote` +
      `?inputMint=${inputMint}` +
      `&outputMint=${outputMint}` +
      `&amount=${amountInSmallestUnits}` +
      `&slippageBps=100` + // 1% slippage
      `&onlyDirectRoutes=false` +
      `&maxAccounts=20`;

    console.log("Fetching quote from Jupiter...");
    
    const quoteResponse = await fetch(quoteUrl, {
      headers: {
        'Accept': 'application/json'
      }
    });
    
    const quoteData = await quoteResponse.json();

    if (quoteData.error) {
      console.error("Jupiter quote error:", quoteData);
      return res.status(500).json({
        success: false,
        error: `Jupiter: ${quoteData.error}`,
        details: quoteData
      });
    }

    if (!quoteData.outAmount) {
      return res.status(500).json({
        success: false,
        error: "Não foi possível obter cotação",
        details: quoteData
      });
    }

    console.log("Quote obtida:", {
      inAmount: quoteData.inAmount,
      outAmount: quoteData.outAmount,
      priceImpact: quoteData.priceImpactPct
    });

    // ========================================================
    // 2. OBTER TRANSACTION
    // ========================================================
    console.log("Obtendo transação...");
    
    const swapResponse = await fetch("https://quote-api.jup.ag/v6/swap", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({
        quoteResponse: quoteData,
        userPublicKey: carteiraUsuarioPublica,
        wrapAndUnwrapSol: true,
        dynamicComputeUnitLimit: true,
        prioritizationFeeLamports: {
          priorityLevelWithMaxLamports: {
            priorityLevel: "veryHigh",
            maxLamports: 1000000
          }
        },
        useSharedAccounts: true
      }),
    });

    const swapData = await swapResponse.json();

    if (swapData.error) {
      console.error("Swap transaction error:", swapData);
      return res.status(500).json({
        success: false,
        error: `Swap: ${swapData.error}`,
        details: swapData
      });
    }

    if (!swapData.swapTransaction) {
      return res.status(500).json({
        success: false,
        error: "Transação de swap não gerada",
        details: swapData
      });
    }

    // ========================================================
    // 3. ASSINAR E ENVIAR
    // ========================================================
    console.log("Assinando transação...");
    
    const userKeypair = parsePrivateKey(carteiraUsuarioPrivada);
    
    // Verificar se a public key corresponde
    const userPubkey = userKeypair.publicKey.toBase58();
    if (userPubkey !== carteiraUsuarioPublica) {
      console.warn(`Public key mismatch: ${userPubkey} != ${carteiraUsuarioPublica}`);
    }

    // Deserializar transação
    const swapTransactionBuf = Buffer.from(swapData.swapTransaction, "base64");
    const transaction = VersionedTransaction.deserialize(swapTransactionBuf);
    
    // Assinar
    transaction.sign([userKeypair]);

    // Enviar transação
    console.log("Enviando transação...");
    const rawTransaction = transaction.serialize();
    const signature = await connection.sendRawTransaction(rawTransaction, {
      skipPreflight: false,
      preflightCommitment: "confirmed",
      maxRetries: 5,
    });

    console.log("Transação enviada. Assinatura:", signature);

    // Aguardar confirmação (não bloqueante)
    setTimeout(async () => {
      try {
        const confirmation = await connection.confirmTransaction(signature, "confirmed");
        console.log("Confirmação:", confirmation.value);
      } catch (confErr) {
        console.warn("Erro na confirmação:", confErr.message);
      }
    }, 1000);

    // ========================================================
    // 4. RETORNAR RESULTADO
    // ========================================================
    const outputAmount = direction === "USDC_TO_SOL" 
      ? (quoteData.outAmount / 1e9).toFixed(6) + " SOL"
      : (quoteData.outAmount / 1e6).toFixed(2) + " USDC";

    const result = {
      success: true,
      signature,
      direction,
      inputAmount: `${amount} ${inputSymbol}`,
      outputAmount: outputAmount,
      explorerUrl: `https://solscan.io/tx/${signature}`,
      message: "Swap iniciado com sucesso!",
      timestamp: new Date().toISOString()
    };

    console.log("Swap processado com sucesso!");
    return res.json(result);

  } catch (error) {
    console.error("ERRO NO SWAP:", error);
    
    // Mensagem de erro amigável
    let errorMessage = "Erro ao processar swap";
    
    if (error.message.includes("insufficient funds")) {
      errorMessage = "Saldo insuficiente";
    } else if (error.message.includes("Blockhash not found")) {
      errorMessage = "Tempo expirado. Recarregue e tente novamente";
    } else if (error.message.includes("signature")) {
      errorMessage = "Erro na assinatura";
    } else if (error.message.includes("invalid secret key")) {
      errorMessage = "Chave privada inválida";
    }

    return res.status(500).json({
      success: false,
      error: errorMessage,
      details: process.env.NODE_ENV === "development" ? error.message : undefined
    });
  }
});

// ========================================================
//  Rota para verificar tokens
// ========================================================
router.get("/tokens", async (req, res) => {
  try {
    const response = await fetch("https://token.jup.ag/all");
    const tokens = await response.json();
    
    // Filtrar tokens populares
    const popularTokens = tokens.filter(t => 
      t.symbol === "SOL" || 
      t.symbol === "USDC" ||
      t.symbol === "USDT"
    );
    
    res.json({
      success: true,
      tokens: popularTokens.map(t => ({
        symbol: t.symbol,
        name: t.name,
        mint: t.address,
        decimals: t.decimals
      }))
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;