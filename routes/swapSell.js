// server/routes/swapSell.js
require("dotenv").config();
const express = require("express");
const axios = require("axios");

const router = express.Router();

// ENV config
const PUMP_API_BASE = (process.env.PUMP_API_BASE || "https://frontend-api.pump.fun").replace(/\/$/, "");
const FALLBACK_PRICE_USD = parseFloat(process.env.FALLBACK_PRICE_USD || "0");
const FALLBACK_SYMBOL = process.env.FALLBACK_SYMBOL || "UNKNOWN";
const FALLBACK_DECIMALS = parseInt(process.env.FALLBACK_DECIMALS || "9");

// ----------------------------------------------
// Tenta pegar preço real da Pump
// ----------------------------------------------
async function fetchPumpPrice(mint) {
  try {
    if (!mint) return null;

    const url = `${PUMP_API_BASE}/coin/${encodeURIComponent(mint)}`;

    const resp = await axios.get(url, { timeout: 4000 });
    const data = resp.data;

    const priceUsd =
      Number(
        data?.price_usd ||
        data?.market?.price_usd ||
        data?.price ||
        data?.quote?.USD?.price
      ) || null;

    const priceSol =
      Number(
        data?.priceSol ||
        data?.market?.priceSol ||
        (priceUsd ? priceUsd / (data?.solPrice || 1) : null)
      ) || null;

    const symbol = data?.symbol || data?.ticker || null;
    const decimals = parseInt(data?.decimals || data?.mintDecimals || `${FALLBACK_DECIMALS}`, 10);

    return {
      priceUsd,
      priceSol,
      symbol,
      decimals,
      raw: data
    };

  } catch (err) {
    return null; // fallback será usado
  }
}

// ----------------------------------------------
// Resolve preço (Pump → fallback)
// ----------------------------------------------
async function resolvePrice(mint) {
  if (mint) {
    const pump = await fetchPumpPrice(mint);

    if (pump && (pump.priceUsd || pump.priceSol)) {
      return {
        priceUsd: pump.priceUsd || FALLBACK_PRICE_USD,
        priceSol: pump.priceSol || null,
        symbol: pump.symbol || FALLBACK_SYMBOL,
        decimals: pump.decimals || FALLBACK_DECIMALS,
        source: "pump",
        raw: pump.raw || null
      };
    }
  }

  return {
    priceUsd: FALLBACK_PRICE_USD,
    priceSol: null,
    symbol: FALLBACK_SYMBOL,
    decimals: FALLBACK_DECIMALS,
    source: "fallback",
    raw: null
  };
}

// ----------------------------------------------
// POST /swap/sell
// ----------------------------------------------
router.post("/sell", async (req, res) => {
  try {
    const { mint, amount, wallet, slippage } = req.body || {};

    if (amount === undefined) {
      return res.status(400).json({ success: false, message: "Campo 'amount' é obrigatório." });
    }

    const numericAmount = Number(amount);
    if (isNaN(numericAmount) || numericAmount < 0) {
      return res.status(400).json({
        success: false,
        message: "Campo 'amount' deve ser número >= 0."
      });
    }

    const priceInfo = await resolvePrice(mint);

    const amountOutUsd = (priceInfo.priceUsd || 0) * numericAmount;

    const swapFeePct = 0.003; // 0.3%
    const estimatedFeesUsd = amountOutUsd * swapFeePct + 0.0005;

    const slippagePct = typeof slippage === "number" ? slippage / 100 : 0;
    const amountOutUsdAfterSlippage = amountOutUsd * (1 - slippagePct);

    return res.json({
      success: true,
      priceUsd: priceInfo.priceUsd,
      priceSol: priceInfo.priceSol,
      symbol: priceInfo.symbol,
      decimals: priceInfo.decimals,
      source: priceInfo.source,
      amountIn: numericAmount,
      amountOutUsd: Number(amountOutUsdAfterSlippage.toFixed(12)),
      estimatedFeesUsd: Number(estimatedFeesUsd.toFixed(12)),
      tx: null,
      rawPriceData: priceInfo.raw
    });

  } catch (err) {
    console.error("Error /swap/sell:", err);
    return res.status(500).json({
      success: false,
      message: "Erro interno no servidor",
      details: err.message
    });
  }
});

module.exports = router;
