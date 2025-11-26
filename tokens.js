const express = require("express");
const router = express.Router();
const { Connection, PublicKey } = require("@solana/web3.js");

const RPC = process.env.RPC_URL;
const TOKEN_PROGRAM = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const TOKEN_2022_PROGRAM = new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");

router.get("/:wallet", async (req, res) => {
  const wallet = req.params.wallet;
  const connection = new Connection(RPC, "confirmed");
  const owner = new PublicKey(wallet);

  try {
    const results = [];

    // 1) SPL
    const spl = await connection.getParsedTokenAccountsByOwner(owner, {
      programId: TOKEN_PROGRAM
    });

    for (const acc of spl.value) {
      const info = acc.account.data.parsed.info;
      results.push({
        mint: info.mint,
        amount: info.tokenAmount.uiAmount,
        decimals: info.tokenAmount.decimals,
        program: "SPL"
      });
    }

    // 2) Token‑2022
    const t22 = await connection.getParsedTokenAccountsByOwner(owner, {
      programId: TOKEN_2022_PROGRAM
    });

    for (const acc of t22.value) {
      const info = acc.account.data.parsed.info;
      results.push({
        mint: info.mint,
        amount: info.tokenAmount.uiAmount,
        decimals: info.tokenAmount.decimals,
        program: "Token-2022"
      });
    }

    res.json({
      wallet,
      tokens: results
    });

  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
