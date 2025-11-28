const { Connection, PublicKey } = require("@solana/web3.js");

const connection = new Connection("https://api.mainnet-beta.solana.com");

app.post("/user/balance", async (req, res) => {
  const { userPubkey } = req.body;

  if (!userPubkey) {
    return res.status(400).json({ message: "userPubkey is required" });
  }

  try {
    const pubkey = new PublicKey(userPubkey);
    const lamports = await connection.getBalance(pubkey);
    const sol = lamports / 1e9;
    res.json({ balance: sol });
  } catch (err) {
    console.error("Erro ao buscar saldo:", err.message);
    res.status(400).json({ message: "Erro ao buscar saldo" });
  }
});
