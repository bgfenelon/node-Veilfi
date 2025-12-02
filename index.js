// ========================================================
//  SWAP API COMPLETA (Tudo em um arquivo)
//  Com fallback automático para problemas de rede
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
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

// Configuração
const SOL_MINT = "So11111111111111111111111111111111111111112";
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

// Lista de RPCs com fallback
const RPC_ENDPOINTS = [
  "https://api.mainnet-beta.solana.com",
  "https://rpc.ankr.com/solana",
  "https://solana-api.projectserum.com"
];

// Lista de endpoints Jupiter com fallback
const JUPITER_ENDPOINTS = [
  "https://quote-api.jup.ag/v6",
  "https://jupiter-api-v6.fly.dev/v6",
  "https://jup.ag/v6"
];

// ========================================================
//  FUNÇÕES AUXILIARES
// ========================================================

// Cria conexão com fallback
function createConnection() {
  for (const endpoint of RPC_ENDPOINTS) {
    try {
      console.log(`Tentando conectar ao RPC: ${endpoint}`);
      const connection = new Connection(endpoint, "confirmed");
      return connection;
    } catch (error) {
      console.warn(`RPC ${endpoint} falhou: ${error.message}`);
    }
  }
  throw new Error("Não foi possível conectar a nenhum RPC");
}

// Parse da chave privada
function parsePrivateKey(secretKey) {
  try {
    // Se for array JSON (do frontend)
    if (typeof secretKey === 'string' && secretKey.startsWith("[")) {
      const arr = JSON.parse(secretKey);
      return Keypair.fromSecretKey(new Uint8Array(arr));
    }
    // Se for base58
    return Keypair.fromSecretKey(bs58.decode(secretKey));
  } catch (err) {
    console.error("Erro ao parsear chave:", err);
    throw new Error(`Formato de chave inválido: ${err.message}`);
  }
}

// Fetch com timeout e retry
async function fetchWithRetry(url, options = {}, maxRetries = 3) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });
      
      clearTimeout(timeout);
      
      if (response.ok) {
        return response;
      }
      
      lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
      console.warn(`Tentativa ${attempt} falhou: ${lastError.message}`);
      
    } catch (error) {
      lastError = error;
      console.warn(`Tentativa ${attempt} erro: ${error.message}`);
    }
    
    // Aguarda antes de tentar novamente
    if (attempt < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
  
  throw lastError || new Error("Falha após todas as tentativas");
}

// Tenta múltiplos endpoints da Jupiter
async function tryJupiterQuote(inputMint, outputMint, amount, slippageBps = 100) {
  let lastError;
  
  for (const baseUrl of JUPITER_ENDPOINTS) {
    try {
      const quoteUrl = `${baseUrl}/quote` +
        `?inputMint=${inputMint}` +
        `&outputMint=${outputMint}` +
        `&amount=${amount}` +
        `&slippageBps=${slippageBps}` +
        `&onlyDirectRoutes=false`;
      
      console.log(`Tentando quote em: ${baseUrl}`);
      
      const response = await fetchWithRetry(quoteUrl, {}, 2);
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      if (data.outAmount) {
        console.log(`Quote obtida de ${baseUrl}`);
        return { data, baseUrl };
      }
      
    } catch (error) {
      lastError = error;
      console.warn(`Endpoint ${baseUrl} falhou: ${error.message}`);
      continue;
    }
  }
  
  throw lastError || new Error("Todos os endpoints da Jupiter falharam");
}

// Tenta múltiplos endpoints para swap
async function tryJupiterSwap(quoteData, userPublicKey, baseUrl) {
  const swapBody = {
    quoteResponse: quoteData,
    userPublicKey,
    wrapAndUnwrapSol: true,
    dynamicComputeUnitLimit: true,
    prioritizationFeeLamports: {
      priorityLevelWithMaxLamports: {
        priorityLevel: "veryHigh",
        maxLamports: 1000000
      }
    },
    useSharedAccounts: true
  };
  
  // Tenta o mesmo endpoint da quote primeiro
  try {
    const swapUrl = `${baseUrl}/swap`;
    console.log(`Tentando swap em: ${swapUrl}`);
    
    const response = await fetchWithRetry(swapUrl, {
      method: 'POST',
      body: JSON.stringify(swapBody)
    }, 2);
    
    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error);
    }
    
    if (data.swapTransaction) {
      return data;
    }
    
  } catch (error) {
    console.warn(`Swap no endpoint ${baseUrl} falhou: ${error.message}`);
  }
  
  // Se falhar, tenta outros endpoints
  for (const altBaseUrl of JUPITER_ENDPOINTS) {
    if (altBaseUrl === baseUrl) continue;
    
    try {
      const swapUrl = `${altBaseUrl}/swap`;
      console.log(`Tentando swap alternativo em: ${swapUrl}`);
      
      const response = await fetchWithRetry(swapUrl, {
        method: 'POST',
        body: JSON.stringify(swapBody)
      }, 2);
      
      const data = await response.json();
      
      if (data.swapTransaction) {
        return data;
      }
      
    } catch (error) {
      console.warn(`Endpoint alternativo ${altBaseUrl} falhou: ${error.message}`);
      continue;
    }
  }
  
  throw new Error("Não foi possível obter transação de swap de nenhum endpoint");
}

// ========================================================
//  ROTA PRINCIPAL DE SWAP
// ========================================================

router.post("/jupiter", async (req, res) => {
  console.log("=== SWAP REQUEST ===", {
    wallet: req.body.carteiraUsuarioPublica?.substring(0, 8) + "...",
    direction: req.body.direction,
    amount: req.body.amount
  });
  
  try {
    const { 
      carteiraUsuarioPublica, 
      carteiraUsuarioPrivada, 
      amount, 
      direction 
    } = req.body;
    
    // Validações
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
    
    if (!["SOL_TO_USDC", "USDC_TO_SOL"].includes(direction)) {
      return res.status(400).json({ 
        success: false,
        error: "Direction inválida. Use SOL_TO_USDC ou USDC_TO_SOL" 
      });
    }
    
    // Configurar mints
    const inputMint = direction === "SOL_TO_USDC" ? SOL_MINT : USDC_MINT;
    const outputMint = direction === "SOL_TO_USDC" ? USDC_MINT : SOL_MINT;
    const amountInSmallestUnits = direction === "SOL_TO_USDC" 
      ? Math.floor(numAmount * 1e9)  // SOL -> lamports
      : Math.floor(numAmount * 1e6); // USDC -> micro USDC
    
    console.log(`Config: ${numAmount} ${direction}`);
    console.log(`Input: ${inputMint}`);
    console.log(`Output: ${outputMint}`);
    console.log(`Amount: ${amountInSmallestUnits}`);
    
    // 1. OBTER QUOTE (com fallback)
    console.log("Obtendo quote...");
    const { data: quoteData, baseUrl: quoteBaseUrl } = await tryJupiterQuote(
      inputMint,
      outputMint,
      amountInSmallestUnits,
      100 // 1% slippage
    );
    
    console.log("Quote obtida:", {
      inAmount: quoteData.inAmount,
      outAmount: quoteData.outAmount,
      priceImpact: quoteData.priceImpactPct
    });
    
    // 2. OBTER TRANSACTION (com fallback)
    console.log("Obtendo transação...");
    const swapData = await tryJupiterSwap(
      quoteData,
      carteiraUsuarioPublica,
      quoteBaseUrl
    );
    
    if (!swapData.swapTransaction) {
      throw new Error("Transação de swap não gerada");
    }
    
    // 3. ASSINAR TRANSACTION
    console.log("Assinando transação...");
    const userKeypair = parsePrivateKey(carteiraUsuarioPrivada);
    
    // Verificar se a wallet corresponde
    const userPubkey = userKeypair.publicKey.toBase58();
    if (userPubkey !== carteiraUsuarioPublica) {
      console.warn(`Public key mismatch: ${userPubkey} vs ${carteiraUsuarioPublica}`);
    }
    
    // Deserializar e assinar
    const swapTransactionBuf = Buffer.from(swapData.swapTransaction, "base64");
    const transaction = VersionedTransaction.deserialize(swapTransactionBuf);
    transaction.sign([userKeypair]);
    
    // 4. ENVIAR TRANSACTION
    console.log("Enviando transação...");
    const connection = createConnection();
    const rawTransaction = transaction.serialize();
    
    // Tenta múltiplas RPCs
    let signature;
    let sendError;
    
    for (const rpcEndpoint of RPC_ENDPOINTS) {
      try {
        const rpcConnection = new Connection(rpcEndpoint, "confirmed");
        signature = await rpcConnection.sendRawTransaction(rawTransaction, {
          skipPreflight: false,
          preflightCommitment: "confirmed",
          maxRetries: 3,
        });
        
        console.log(`Transação enviada via ${rpcEndpoint}: ${signature}`);
        sendError = null;
        break;
        
      } catch (error) {
        sendError = error;
        console.warn(`Falha ao enviar via ${rpcEndpoint}: ${error.message}`);
        continue;
      }
    }
    
    if (!signature) {
      throw sendError || new Error("Não foi possível enviar a transação");
    }
    
    // 5. RETORNAR RESULTADO (não bloqueia confirmação)
    const outputAmount = direction === "USDC_TO_SOL" 
      ? (quoteData.outAmount / 1e9).toFixed(6)
      : (quoteData.outAmount / 1e6).toFixed(2);
    
    const result = {
      success: true,
      signature,
      direction,
      inputAmount: `${numAmount} ${direction.includes("SOL") ? "SOL" : "USDC"}`,
      outputAmount: `${outputAmount} ${direction.includes("SOL") ? "USDC" : "SOL"}`,
      explorerUrl: `https://solscan.io/tx/${signature}`,
      message: "Swap iniciado com sucesso!",
      timestamp: new Date().toISOString()
    };
    
    console.log("Swap realizado:", result);
    
    // Confirmação assíncrona (opcional)
    setTimeout(async () => {
      try {
        const confirmation = await connection.confirmTransaction(signature, "confirmed");
        console.log(`Confirmação para ${signature}:`, confirmation.value);
      } catch (confErr) {
        console.warn("Erro na confirmação:", confErr.message);
      }
    }, 1000);
    
    return res.json(result);
    
  } catch (error) {
    console.error("ERRO NO SWAP:", error);
    
    // Mensagens de erro amigáveis
    let errorMessage = "Erro ao processar swap";
    
    if (error.message.includes("insufficient funds")) {
      errorMessage = "Saldo insuficiente para realizar o swap";
    } else if (error.message.includes("Blockhash")) {
      errorMessage = "Tempo expirado. Recarregue e tente novamente";
    } else if (error.message.includes("signature")) {
      errorMessage = "Erro na assinatura da transação";
    } else if (error.message.includes("rate limit") || error.message.includes("429")) {
      errorMessage = "Muitas requisições. Aguarde um momento";
    } else if (error.message.includes("ENOTFOUND") || error.message.includes("network")) {
      errorMessage = "Problema de conexão com a rede. Tente novamente";
    } else if (error.message.includes("TOKEN_NOT_TRADABLE")) {
      errorMessage = "Token não disponível para trading";
    }
    
    return res.status(500).json({
      success: false,
      error: errorMessage,
      details: process.env.NODE_ENV === "development" ? error.message : undefined
    });
  }
});

// ========================================================
//  ROTAS ADICIONAIS
// ========================================================

// Health check
router.get("/health", async (req, res) => {
  try {
    // Testa conexão com a Jupiter
    const testQuote = await fetchWithRetry(
      `${JUPITER_ENDPOINTS[0]}/quote?inputMint=${SOL_MINT}&outputMint=${USDC_MINT}&amount=1000000&slippageBps=50`,
      {},
      1
    ).catch(() => null);
    
    // Testa conexão com Solana
    const connection = createConnection();
    const slot = await connection.getSlot();
    
    res.json({
      status: "healthy",
      jupiterApi: testQuote ? "online" : "offline",
      solanaConnection: slot ? "connected" : "disconnected",
      timestamp: new Date().toISOString(),
      endpoints: JUPITER_ENDPOINTS
    });
    
  } catch (error) {
    res.status(500).json({
      status: "unhealthy",
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Get quote apenas (para preview)
router.post("/quote", async (req, res) => {
  try {
    const { inputMint = SOL_MINT, outputMint = USDC_MINT, amount, slippage = 50 } = req.body;
    
    if (!amount) {
      return res.status(400).json({ error: "Amount é obrigatório" });
    }
    
    const { data: quoteData, baseUrl } = await tryJupiterQuote(
      inputMint,
      outputMint,
      amount,
      slippage
    );
    
    res.json({
      success: true,
      inputAmount: quoteData.inAmount,
      outputAmount: quoteData.outAmount,
      priceImpactPct: quoteData.priceImpactPct,
      endpoint: baseUrl,
      routes: quoteData.routePlan || []
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;