// routes/swapBuyInit.js
const express = require("express");
const axios = require("axios");
const dotenv = require("dotenv");
dotenv.config();

const router = express.Router();

const FALLBACK_PRICE_USD = parseFloat(process.env.FALLBACK_PRICE_USD || "0.000001");
const FALLBACK_SYMBOL = process.env.FALLBACK_SYMBOL || "UNKNOWN";
const FALLBACK_DECIMALS = parseInt(process.env.FALLBACK_DECIMALS || "9", 10);

const SITE_PUBLIC_KEY = process.env.SITE_PUBLIC_KEY;
const TOKEN_MINT = process.env.TOKEN_MINT;

let pendingOrders = {}; // memória simples (pode trocar por Mongo depois)

router.post("/buy/init", express.json(), async (req, res) => {
  try {
    const { usdAmount, buyer } = req.body;

    if (!usdAmount || usdAmount <= 0) {
      return res.status(400).json({ success: false, message: "usdAmount é obrigatório e deve ser > 0" });
    }

    if (!buyer) {
      return res.status(400).json({ success: false, message: "buyer (carteira do usuário) é obrigatória" });
    }

    // preço da moeda
    const priceUsd = FALLBACK_PRICE_USD;

    const tokens = usdAmount / priceUsd;
    const tokensSmallest = Math.floor(tokens * Math.pow(10, FALLBACK_DECIMALS));

    // converter USD → SOL usando preço aproximado vindo do market
    const solPrice = await axios
      .get("https://price.jup.ag/v4/price?ids=SOL")
      .then(r => r.data.data.SOL.price)
      .catch(() => null);

    if (!solPrice) {
      return res.status(500).json({ success: false, message: "Erro ao obter preço do SOL" });
    }

    const solToPay = usdAmount / solPrice;

    // gerar id do pedido
    const orderId = "ORDER_" + Math.random().toString(36).substring(2, 10);

    pendingOrders[orderId] = {
      usdAmount,
      buyer,
      tokensSmallest,
      solToPay,
      createdAt: Date.now()
    };

    return res.json({
      success: true,
      orderId,
      walletToPay: SITE_PUBLIC_KEY,
      solToPay,
      tokensSmallest,
      symbol: FALLBACK_SYMBOL,
      decimals: FALLBACK_DECIMALS,
      tokenMint: TOKEN_MINT
    });

  } catch (err) {
    console.error("swapBuyInit error:", err);
    return res.status(500).json({ success: false, message: "Erro interno", details: err?.message });
  }
});

module.exports = router;
