app.post("/wallet/balance", async (req, res) => {
  try {
    const { userPubkey } = req.body;

    if (!userPubkey) {
      return res.status(400).json({ message: "userPubkey obrigatório" });
    }

    const pubkey = new PublicKey(userPubkey);
    const lamports = await connection.getBalance(pubkey);
    const sol = lamports / 1e9;

    return res.json({ ok: true, balance: sol });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "FAILED", details: e.message });
  }
});
