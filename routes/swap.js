// swap.js - USANDO JUPITER DIRETO
const express = require("express");
const router = express.Router();
const { Connection, Keypair, VersionedTransaction } = require("@solana/web3.js");
const bs58 = require("bs58");
const https = require("https"); // Usar módulo nativo

const SOL_MINT = "So11111111111111111111111111111111111111112";
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

// Função para fazer requisições HTTPS
function httpsRequest(url, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let data = "";
      
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        try {
          resolve({
            ok: res.statusCode >= 200 && res.statusCode < 300,
            json: () => Promise.resolve(JSON.parse(data)),
            status: res.statusCode
          });
        } catch (err) {
          reject(err);
        }
      });
    });
    
    req.on("error", reject);
    
    if (body) {
      req.write(JSON.stringify(body));
    }
    
    req.end();
  });
}

router.post("/jupiter", async (req, res) => {
  try {
    const { carteiraUsuarioPublica, carteiraUsuarioPrivada, amount, direction } = req.body;
    
    // Validações
    if (!carteiraUsuarioPublica || !carteiraUsuarioPrivada || !amount || !direction) {
      return res.status(400).json({ error: "Dados incompletos" });
    }
    
    // Configurar swap
    const isSolToUsdc = direction === "SOL_TO_USDC";
    const inputMint = isSolToUsdc ? SOL_MINT : USDC_MINT;
    const outputMint = isSolToUsdc ? USDC_MINT : SOL_MINT;
    const amountInSmallestUnits = isSolToUsdc ? Math.floor(amount * 1e9) : Math.floor(amount * 1e6);
    
    // 1. Obter quote
    const quoteUrl = `https://quote-api.jup.ag/v6/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amountInSmallestUnits}&slippageBps=100`;
    
    const quoteRes = await httpsRequest(quoteUrl, {
      method: "GET",
      headers: { "Accept": "application/json" }
    });
    
    const quoteData = await quoteRes.json();
    if (!quoteRes.ok || quoteData.error) {
      throw new Error(quoteData.error || "Erro ao obter quote");
    }
    
    // 2. Obter transação
    const swapRes = await httpsRequest(
      "https://quote-api.jup.ag/v6/swap",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      },
      {
        quoteResponse: quoteData,
        userPublicKey: carteiraUsuarioPublica,
        wrapAndUnwrapSol: true
      }
    );
    
    const swapData = await swapRes.json();
    if (!swapRes.ok || swapData.error) {
      throw new Error(swapData.error || "Erro ao obter transação");
    }
    
    // 3. Assinar
    let keypair;
    try {
      if (carteiraUsuarioPrivada.startsWith("[")) {
        const arr = JSON.parse(carteiraUsuarioPrivada);
        keypair = Keypair.fromSecretKey(new Uint8Array(arr));
      } else {
        keypair = Keypair.fromSecretKey(bs58.decode(carteiraUsuarioPrivada));
      }
    } catch (err) {
      throw new Error("Chave privada inválida");
    }
    
    // 4. Enviar
    const transaction = VersionedTransaction.deserialize(
      Buffer.from(swapData.swapTransaction, "base64")
    );
    
    transaction.sign([keypair]);
    
    const connection = new Connection("https://api.mainnet-beta.solana.com", "confirmed");
    const signature = await connection.sendRawTransaction(transaction.serialize(), {
      skipPreflight: false,
      preflightCommitment: "confirmed"
    });
    
    res.json({
      success: true,
      signature,
      explorerUrl: `https://solscan.io/tx/${signature}`
    });
    
  } catch (error) {
    console.error("Swap error:", error);
    res.status(500).json({
      error: error.message || "Erro no swap"
    });
  }
});

module.exports = router;