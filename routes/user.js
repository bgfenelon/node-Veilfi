const express = require("express");
const router = express.Router();

const { Connection, PublicKey } = require("@solana/web3.js");
const {
  getAccount,
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID
} = require("@solana/spl-token");

const RPC = process.env.RPC_URL;
const SUPPORTED_MINTS = (process.env.SUPPORTED_MINTS || "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

router.post("/balance", async (req, res) => {
  const { pubkey } = req.body;
  if (!pubkey) return res.status(400).json({ error: "Missing pubkey" });

  try {
    const connection = new Connection(RPC, "confirmed");
    const owner = new PublicKey(pubkey);

    // -------- SOLANA --------
    const lamports = await connection.getBalance(owner);
    const sol = lamports / 1e9;

    // -------- SPL TOKENS (ambos programas) --------

    async function fetchTokens(programId) {
      const list = await connection.getTokenAccountsByOwner(owner, {
        programId
      });

      const tokens = [];
      for (const { pubkey: ata } of list.value) {
        try {
          const acc = await getAccount(connection, ata, "confirmed");
          const mint = acc.mint.toBase58();

          if (SUPPORTED_MINTS.includes(mint)) {
            tokens.push({
              mint,
              decimals: acc.decimals,
              amount: acc.amount,
              uiAmount: Number(acc.amount) / 10 ** acc.decimals
            });
          }
        } catch {}
      }
      return tokens;
    }

    const tokensClassic = await fetchTokens(TOKEN_PROGRAM_ID);      // USDT
    const tokens2022   = await fetchTokens(TOKEN_2022_PROGRAM_ID);   // TEST, pump.fun

    const tokens = [...tokensClassic, ...tokens2022];

    return res.json({ pubkey, sol, tokens });

  } catch (e) {
    console.error("BALANCE ERROR:", e);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
