router.post("/send", async (req, res) => {
  try {
    const { secretKey, recipient, amount } = req.body;

    // validação correta
    if (!secretKey || !recipient || amount === undefined) {
      return res.status(400).json({ error: "Missing data" });
    }

    const numericAmount = Number(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ error: "Invalid amount" });
    }

    const from = keypairFromSecretKey(secretKey);
    const to = new PublicKey(recipient);
    const lamports = Math.floor(numericAmount * LAMPORTS_PER_SOL);

    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: from.publicKey,
        toPubkey: to,
        lamports,
      })
    );

    const signature = await sendAndConfirmTransaction(connection, tx, [from]);
    res.json({ signature });

  } catch (err) {
    console.error("SEND ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});
