const express = require("express");
const router = express.Router();
const { connection } = require("../services/solana");

router.post("/check", async (req, res) => {
  try {
    const { signature } = req.body;

    if (!signature) return res.json({ ok: false, message: "Signature obrigatório" });

    const tx = await connection.getTransaction(signature, {
      maxSupportedTransactionVersion: 0,
    });

    if (!tx) return res.json({ ok: false, message: "TX não encontrada" });

    const lamports = tx.meta.postBalances[0] - tx.meta.preBalances[0];
    const amountSol = lamports / 1e9;

    return res.json({
      ok: true,
      amountSol,
    });
  } catch (err) {
    console.error(err);
    res.json({ ok: false });
  }
});

module.exports = router;
