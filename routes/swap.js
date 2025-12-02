// ========================================================
//  Jupiter Swap (API Atualizada) - COM MELHOR TRATAMENTO DE ERROS
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

// Conexão RPC
const connection = new Connection(
  "https://api.mainnet-beta.solana.com",
  "confirmed"
);

// Mints
const SOL_MINT = "So11111111111111111111111111111111111111112";
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

// Timeout para requisições (em milissegundos)
const REQUEST_TIMEOUT = 30000;

// Função para fetch com timeout
async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        ...options.headers,
      },
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error(`Request timeout after ${REQUEST_TIMEOUT}ms`);
    }
    throw error;
  }
}

// Parse da chave privada
function parsePrivateKey(secretKey) {
  try {
    if (secretKey.startsWith("[")) {
      const arr = JSON.parse(secretKey);
      return Keypair.fromSecretKey(new Uint8Array(arr));
    }
    return Keypair.fromSecretKey(bs58.decode(secretKey));
  } catch (err) {
    throw new Error(`Formato de chave inválido: ${err.message}`);
  }
}

// SWAP
router.post("/jupiter", async (req, res) => {
  try {
    // Log request summary (some fields moved after destructuring)
    
    const { 
      carteiraUsuarioPublica, 
      carteiraUsuarioPrivada, 
      amount, 
      direction 
    } = req.body;

    // Mask private key before logging (after destructuring to avoid ReferenceError)
    const maskedPriv = carteiraUsuarioPrivada ? ("***" + carteiraUsuarioPrivada.slice(-8)) : undefined;
    const debugBody = {
      ...req.body,
      carteiraUsuarioPrivada: maskedPriv || req.body.carteiraUsuarioPrivada
    };

    console.log("=== SWAP REQUEST ===", {
      wallet: carteiraUsuarioPublica?.substring(0, 8) + "...",
      direction: req.body.direction,
      amount: req.body.amount,
      privateKey: maskedPriv,
      from: req.body.from || req.body.fromSymbol || req.body.fromMint || req.body.inputMint,
      to: req.body.to || req.body.toSymbol || req.body.toMint || req.body.outputMint,
      additionalFields: Object.keys(req.body).filter(k => ['carteiraUsuarioPrivada', 'SITE_SECRET_KEY', 'siteSecretKey'].indexOf(k) === -1)
    });
    if (process.env.NODE_ENV !== 'production') {
      // Print debug body trimmed to avoid logging large or binary data
      console.log('Request body (debug):', JSON.stringify(debugBody, Object.keys(debugBody), 2));
    }

    // Normalize amount from several possible request fields (compatibility with different clients)
    const amountCandidates = {
      amount: req.body.amount,
      amt: req.body.amt,
      value: req.body.value,
      quantity: req.body.quantity,
      solAmount: req.body.solAmount || req.body.amountSol,
      usdAmount: req.body.usdAmount || req.body.amountUSD,
      tokens: req.body.tokens,
    };
    let rawAmount = null;
    let amountSource = null;
    for (const [k, v] of Object.entries(amountCandidates)) {
      if (v !== undefined && v !== null && v !== '') {
        rawAmount = v;
        amountSource = k;
        break;
      }
    }
    // fallback: still accept the destructured variable 'amount' if present
    if (rawAmount === null && amount !== undefined) {
      rawAmount = amount;
      amountSource = 'amount';
    }
    console.log('Amount candidate used:', { amountSource, rawAmount });
    if (process.env.NODE_ENV !== 'production') {
      console.log('Amount candidates:', amountCandidates);
    }

    // Validações
    if (!carteiraUsuarioPublica || !carteiraUsuarioPrivada) {
      return res.status(400).json({ 
        success: false,
        error: "Wallet e chave privada são obrigatórios" 
      });
    }

    const numAmount = Number(rawAmount);
    if (rawAmount === null || rawAmount === undefined || isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ 
        success: false,
        error: `Amount inválido ou ausente: ${rawAmount}. Envie 'amount' como número > 0 (ex: 0.01). Campos alternativos aceitos: amount, usdAmount, solAmount, amt, value, quantity.`,
        received: rawAmount,
        usedField: amountSource
      });
    }

    // Normalize direction to be case-insensitive and accept several common formats
    function normalizeDirection(dir, from, to, body) {
      if (!dir && from && to) {
        dir = `${from}_TO_${to}`;
      }
      if (!dir || typeof dir !== 'string') return null;
      // Normalize common symbol names and separators
      let d = dir.trim().toUpperCase();
      // Map common synonyms
      d = d.replace(/SOLANA/g, 'SOL');
      // Map plain 'USD' to 'USDC' only when it's a standalone word, avoid touching 'USDT', 'USDC', etc.
      d = d.replace(/\bUSD\b/g, 'USDC');
      const cleaned = d.replace(/[^A-Z0-9]/g, '_').replace(/_+/g, '_');
      if (cleaned.includes('SOL') && cleaned.includes('USDC')) {
        return cleaned.indexOf('SOL') < cleaned.indexOf('USDC') ? 'SOL_TO_USDC' : 'USDC_TO_SOL';
      }
      // Try to infer by mints present in the body
      const fromMintCandidates = [body?.fromMint, body?.inputMint, body?.from_mint, body?.input_mint];
      const toMintCandidates = [body?.toMint, body?.outputMint, body?.to_mint, body?.output_mint];
      const allMints = [...fromMintCandidates, ...toMintCandidates].filter(Boolean);
      if (allMints.length) {
        const hasSol = allMints.some(m => (m || '').toString() === SOL_MINT);
        const hasUsdc = allMints.some(m => (m || '').toString() === USDC_MINT);
        if (hasSol && hasUsdc) {
          // If fromMint equals SOL_MINT or inputMint equals SOL -> SOL_TO_USDC
          const fromMint = (fromMintCandidates.find(Boolean) || '').toString();
          if (fromMint === SOL_MINT) return 'SOL_TO_USDC';
          if (fromMint === USDC_MINT) return 'USDC_TO_SOL';
          // fallback: check ordering in the body
          return (from && from.toUpperCase && from.toUpperCase().includes('SOL')) ? 'SOL_TO_USDC' : 'USDC_TO_SOL';
        }
      }
      return null;
    }

    const normalizedDirection = normalizeDirection(direction, req.body.from, req.body.to, req.body);
    console.log("Normalized direction computed:", normalizedDirection);
    const hasMints = !!(req.body.inputMint && req.body.outputMint);
    if (!normalizedDirection && !hasMints) {
      return res.status(400).json({ 
        success: false,
        error: "Direction inválida. Envie 'direction' como 'SOL_TO_USDC' ou 'USDC_TO_SOL' (aceita formas como 'SOL-USDC', 'sol->usdc', 'sol_usdc' etc.), ou envie 'from' e 'to' (e.g. from: 'SOL', to: 'USDC').",
        received: direction
      });
    }
    // Use canonical direction value going forward
    const canonicalDirection = normalizedDirection;

    let inputMint, outputMint, amountInSmallestUnits;
    let inputSymbol, outputSymbol;
    let inputDecimals = 9;
    let outputDecimals = 9;

    // Helper to get decimals for known mints; fallback to 9
    function getDecimalsForMint(mint) {
      if (!mint) return 9;
      if (mint === SOL_MINT) return 9;
      if (mint === USDC_MINT) return 6;
      // Extend if you add other known mints: e.g. VEIL_MINT: 9
      return 9; // default
    }

    // If inputMint/outputMint are explicitly provided by the client, use them
    if (req.body.inputMint && req.body.outputMint) {
      inputMint = req.body.inputMint;
      outputMint = req.body.outputMint;
      inputDecimals = getDecimalsForMint(inputMint);
      outputDecimals = getDecimalsForMint(outputMint);
      // Determine if client sent amount in smallest units already
      if (req.body.amountInSmallestUnits) {
        amountInSmallestUnits = Number(req.body.amountInSmallestUnits);
        console.log('Using amountInSmallestUnits from request:', amountInSmallestUnits);
      } else if (Number.isInteger(Number(rawAmount)) && Number(rawAmount) >= Math.pow(10, Math.min(6, inputDecimals))) {
        // heuristic: if an integer and >= 10^min(6,inputDecimals), treat as smallest units
        amountInSmallestUnits = Number(rawAmount);
        console.log('Heuristic: treating raw amount as smallest units:', amountInSmallestUnits);
      } else {
        amountInSmallestUnits = Math.floor(numAmount * Math.pow(10, inputDecimals));
        console.log('Computed amountInSmallestUnits from UI amount:', amountInSmallestUnits);
      }
      // symbols: try to use provided from/to symbol fields, fall back to SOL/USDC mapping
      inputSymbol = req.body.from || req.body.fromSymbol || (inputMint === SOL_MINT ? 'SOL' : inputMint === USDC_MINT ? 'USDC' : 'TOKEN');
      outputSymbol = req.body.to || req.body.toSymbol || (outputMint === SOL_MINT ? 'SOL' : outputMint === USDC_MINT ? 'USDC' : 'TOKEN');
      // derive a canonical direction string purely for logging
      if (inputMint === SOL_MINT && outputMint === USDC_MINT) {
        // Keep backward-compatible canonical value
        // canonicalDirection already exists, but it's OK to keep it unchanged
      }
    } else if (canonicalDirection === "SOL_TO_USDC") {
      inputMint = SOL_MINT;
      outputMint = USDC_MINT;
      inputDecimals = 9;
      outputDecimals = 6;
      amountInSmallestUnits = Math.floor(numAmount * 1e9);
      inputSymbol = "SOL";
      outputSymbol = "USDC";
    } else {
      inputMint = USDC_MINT;
      outputMint = SOL_MINT;
      inputDecimals = 6;
      outputDecimals = 9;
      amountInSmallestUnits = Math.floor(numAmount * 1e6);
      inputSymbol = "USDC";
      outputSymbol = "SOL";
    }

    console.log(`Swap config: ${numAmount} ${inputSymbol} -> ${outputSymbol}`);
    console.log(`Input mint: ${inputMint} (decimals: ${inputDecimals})`);
    console.log(`Output mint: ${outputMint} (decimals: ${outputDecimals})`);
    console.log(`Amount in smallest units: ${amountInSmallestUnits}`);

    // 1. OBTER QUOTE
    const quoteUrl = `https://quote-api.jup.ag/v6/quote` +
      `?inputMint=${inputMint}` +
      `&outputMint=${outputMint}` +
      `&amount=${amountInSmallestUnits}` +
      `&slippageBps=100` +
      `&onlyDirectRoutes=false` +
      `&maxAccounts=20`;

    console.log("Fetching quote from Jupiter...");
    
    let quoteResponse;
    try {
      quoteResponse = await fetchWithTimeout(quoteUrl);
    } catch (fetchError) {
      console.error("Erro ao buscar quote:", fetchError);
      return res.status(500).json({
        success: false,
        error: `Não foi possível conectar à Jupiter API. Verifique a conectividade de rede do servidor.`,
        details: fetchError.message
      });
    }
    
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

    // 2. OBTER TRANSACTION
    console.log("Obtendo transação...");
    
    const swapResponse = await fetchWithTimeout("https://quote-api.jup.ag/v6/swap", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
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

    // 3. ASSINAR E ENVIAR
    console.log("Assinando transação...");
    
    const userKeypair = parsePrivateKey(carteiraUsuarioPrivada);
    
    const swapTransactionBuf = Buffer.from(swapData.swapTransaction, "base64");
    const transaction = VersionedTransaction.deserialize(swapTransactionBuf);
    
    transaction.sign([userKeypair]);

    console.log("Enviando transação...");
    const rawTransaction = transaction.serialize();
    const signature = await connection.sendRawTransaction(rawTransaction, {
      skipPreflight: false,
      preflightCommitment: "confirmed",
      maxRetries: 5,
    });

    console.log("Transação enviada. Assinatura:", signature);

    // Aguardar confirmação (assíncrono)
    setTimeout(async () => {
      try {
        const confirmation = await connection.confirmTransaction(signature, "confirmed");
        console.log("Confirmação:", confirmation.value);
      } catch (confErr) {
        console.warn("Erro na confirmação:", confErr.message);
      }
    }, 1000);

    // 4. RETORNAR RESULTADO
    const outputAmount = (quoteData.outAmount / Math.pow(10, outputDecimals)).toFixed(outputDecimals === 9 ? 6 : 2) + ` ${outputSymbol}`;

    const result = {
      success: true,
      signature,
      direction: canonicalDirection || `${inputSymbol}_TO_${outputSymbol}`,
      inputAmount: `${rawAmount} ${inputSymbol}`,
      outputAmount: outputAmount,
      explorerUrl: `https://solscan.io/tx/${signature}`,
      message: "Swap iniciado com sucesso!",
      timestamp: new Date().toISOString()
    };

    console.log("Swap processado com sucesso!");
    return res.json(result);

  } catch (error) {
    console.error("ERRO NO SWAP:", error);
    
    let errorMessage = "Erro ao processar swap";
    
    if (error.message.includes("insufficient funds")) {
      errorMessage = "Saldo insuficiente";
    } else if (error.message.includes("Blockhash not found")) {
      errorMessage = "Tempo expirado. Recarregue e tente novamente";
    } else if (error.message.includes("signature")) {
      errorMessage = "Erro na assinatura";
    } else if (error.message.includes("invalid secret key")) {
      errorMessage = "Chave privada inválida";
    } else if (error.message.includes("Request timeout")) {
      errorMessage = "Timeout ao conectar com a Jupiter. Tente novamente mais tarde.";
    } else if (error.message.includes("ENOTFOUND") || error.message.includes("getaddrinfo")) {
      errorMessage = "Erro de conexão. Verifique a rede do servidor.";
    }

    return res.status(500).json({
      success: false,
      error: errorMessage,
      details: process.env.NODE_ENV === "development" ? error.message : undefined
    });
  }
});

// Health check com teste de conectividade com Jupiter
router.get("/health", async (req, res) => {
  try {
    // Tenta obter uma quote simples
    const quoteUrl = `https://quote-api.jup.ag/v6/quote?inputMint=${SOL_MINT}&outputMint=${USDC_MINT}&amount=10000000&slippageBps=50`;
    
    const quoteResponse = await fetchWithTimeout(quoteUrl);
    const quoteData = await quoteResponse.json();

    if (quoteData.error) {
      throw new Error(quoteData.error);
    }

    res.json({
      status: "healthy",
      jupiterApi: "online",
      solanaConnection: "connected",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Health check error:", error);
    res.status(500).json({
      status: "unhealthy",
      error: error.message,
      jupiterApi: "offline"
    });
  }
});

module.exports = router;