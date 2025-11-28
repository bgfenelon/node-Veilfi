require("dotenv").config();

module.exports = {
  RPC_URL: process.env.RPC_URL,
  JUP_BASE: process.env.JUP_BASE,
  TOKEN_PRICE_SOL: parseFloat(process.env.TOKEN_PRICE_SOL || "0.000001"),
  TOKEN_DECIMALS: parseInt(process.env.FALLBACK_DECIMALS || "9"),
  TOKEN_MINT: process.env.TOKEN_MINT,
  PORT: process.env.PORT || 3001,
  SERVER_MASTER_KEY: process.env.SERVER_MASTER_KEY,
};
