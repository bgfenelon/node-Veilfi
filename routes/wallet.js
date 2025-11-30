router.post("/send", async (req, res) => {
  try {
    const session = req.sessionObject;

    if (!session) {
      return res.status(401).json({ ok: false, error: "NO_SESSION" });
    }

    const { secretKey } = session;
    const { to, amount } = req.body;

    // valida secretKey
    if (!secretKey || !Array.isArray(secretKey) || secretKey.length !== 64) {
      return res.status(400).json({ ok: false, error: "INVALID_SECRET_KEY" });
    }

    // valida amount corretamente
    const solAmount = Number(amount);
    if (!to || isNaN(solAmount) || solAmount <= 0) {
      return res.status(400).json({ ok: false, error: "INVALID_AMOUNT" });
    }

    const fromKeypair = Keypair.fromSecretKey(Uint8Array.from(secretKey));
    const toPubkey = new PublicKey(to);

    const lamports = Math.floor(solAmount * 1e9);

    const instr = SystemProgram.transfer({
      fromPubkey: fromKeypair.publicKey,
      toPubkey,
      lamports,
    });

    const tx = new Transaction().add(instr);

    // Solana SDK recomenda não setar blockhash manualmente
    const signature = await sendAndConfirmTransaction(
      connection,
      tx,
      [fromKeypair],
      { commitment: "confirmed" }
    );

    return res.json({
      ok: true,
      signature,
      explorer: `https://explorer.solana.com/tx/${signature}?cluster=devnet`,
    });
  } catch (err) {
    console.error("SEND ERROR:", err);
    return res.status(500).json({
      ok: false,
      error: "SEND_FAILED",
      details: err.message || String(err),
    });
  }
});
