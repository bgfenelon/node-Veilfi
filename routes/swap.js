// swap.js – Jupiter v6 – SOL <-> USDC

const express = require("express");
const router = express.Router();
const fetch = require("node-fetch");
const bs58 = require("bs58");
const {
  Connection,
  PublicKey,
  Keypair,
  VersionedTransaction,
} = require("@solana/web3.js");

// RPC
const RPC_URL =
  process.env.RPC_URL ||
  "https://mainnet.helius-rpc.com/?api-key=1581ae46-832d-4d46-bc0c-007c6269d2d9";

const connection = new Connection(RPC_URL, "confirmed");

// Jupiter v6 correct endpoints
const JUP_QUOTE_URL = "https://quote-api.jup.ag/v6/quote";
const JUP_SWAP_URL = "https://swap-api.jup.ag/v6/swap";

// Mints
const SOL_MINT = "So11111111111111111111111111111111111111112";
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

// Parse secret key
function parseSecretKey(secretKey) {
  if (!secretKey) throw new Error("Missing secretKey");

  if (Array.isArray(secretKey))
    return Keypair.fromSecretKey(Uint8Array.from(secretKey));

  if (typeof secretKey === "string" && secretKey.trim().startsWith("[")) {
    const arr = JSON.parse(secretKey);
    return Keypair.fromSecretKey(Uint8Array.from(arr));
  }

  return Keypair.fromSecretKey(bs58.decode(secretKey));
}

function toAtomic(amount, mint) {
  amount = Number(amount);
  if (isNaN(amount) || amount <= 0) throw new Error("Invalid amount");

  return mint === SOL_MINT
    ? Math.floor(amount * 1e9)
    : Math.floor(amount * 1e6);
}

// MAIN SWAP ROUTE
router.post("/jupiter", async (req, res) => {
  try {
    const { carteiraUsuarioPublica, carteiraUsuarioPrivada, amount, direction } =
      req.body;

    if (!carteiraUsuarioPublica || !carteiraUsuarioPrivada || !amount || !direction)
      return res.status(400).json({ error: "Missing fields" });

    const userPub = new PublicKey(carteiraUsuarioPublica);
    const kp = parseSecretKey(carteiraUsuarioPrivada);

    const isSolToUsdc = direction.toUpperCase() === "SOL_TO_USDC";

    const inputMint = isSolToUsdc ? SOL_MINT : USDC_MINT;
    const outputMint = isSolToUsdc ? USDC_MINT : SOL_MINT;

    const atomicAmount = toAtomic(amount, inputMint);

    // 1) GET QUOTE
    const quoteURL =
      `${JUP_QUOTE_URL}?inputMint=${inputMint}` +
      `&outputMint=${outputMint}&amount=${atomicAmount}&slippageBps=50`;

    const quoteResp = await fetch(quoteURL);
    const quoteJson = await quoteResp.json();

    if (!quoteJson.data || quoteJson.data.length === 0)
      return res.status(500).json({ error: "No route found", quoteJson });

    const route = quoteJson.data[0];

    // 2) CREATE SWAP TX
    const swapResp = await fetch(JUP_SWAP_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        quoteResponse: route,
        userPublicKey: userPub.toBase58(),
        wrapAndUnwrapSol: true,
      }),
    });

    const swapJson = await swapResp.json();

    if (!swapJson.swapTransaction)
      return res.status(500).json({ error: "Jupiter did not return swapTransaction" });

    // 3) Sign transaction
    const buffer = Buffer.from(swapJson.swapTransaction, "base64");
    const tx = VersionedTransaction.deserialize(buffer);

    tx.sign([kp]);

    // 4) Send to chain
    const sig = await connection.sendRawTransaction(tx.serialize());
    await connection.confirmTransaction(sig, "confirmed");

    res.json({ success: true, signature: sig });
  } catch (err) {
    console.error("JUPITER SWAP ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
