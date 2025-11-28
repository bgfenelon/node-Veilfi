const express = require("express");
const router = express.Router();
const { connection } = require("../services/solana");
const { PublicKey } = require("@solana/web3.js");

router.post("/balance", async (req, res) => {
  try {
    const { userPubkey } = req.body;

    if (!userPubkey) {
      return res.status(400).json({
        ok: false,
        message: "userPubkey obrigatório",
      });
    }

    const pubkey = new PublicKey(userPubkey);

    const lamports = await connection.getBalance(pubkey);
    const solBalance = lamports / 1e9;

    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(pubkey, {
      programId: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
    });

    const tokens = tokenAccounts.value.map((acc) => ({
      mint: acc.account.data.parsed.info.mint,
      uiAmount: acc.account.data.parsed.info.tokenAmount.uiAmount,
    }));

    return res.json({
      ok: true,
      solBalance,
      tokens,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, message: "Erro interno" });
  }
});

module.exports = router;
