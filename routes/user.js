// server/routes/user.js
const express = require("express");
const router = express.Router();
const { Connection, PublicKey } = require("@solana/web3.js");
const sessions = require("../sessions");

const RPC = process.env.SOLANA_RPC || "https://api.mainnet-beta.solana.com";
const connection = new Connection(RPC, "confirmed");

router.post("/balance", async (req, res) => {
  try {
    let { userPubkey } = req.body || {};

    if (!userPubkey) {
      const sessionId = req.cookies?.sessionId;
      if (sessionId && sessions[sessionId]) {
        userPubkey = sessions[sessionId].walletPubkey;
      }
    }

    if (!userPubkey) {
      return res.status(400).json({ error: "Missing userPubkey" });
    }

    const pub = new PublicKey(userPubkey);

    const lamports = await connection.getBalance(pub);
    const solBalance = lamports / 1e9;

    const tokenResp = await connection.getParsedTokenAccountsByOwner(pub, {
      programId: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
    });

    const tokens = tokenResp.value
      .map((v) => {
        try {
          const info = v.account.data.parsed.info;
          return {
            mint: info.mint,
            uiAmount: info.tokenAmount.uiAmount,
          };
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    res.json({ solBalance, tokens });
  } catch (err) {
    console.error("user/balance error:", err);
    res.status(500).json({ error: "Failed to get balance" });
  }
});

module.exports = router;
