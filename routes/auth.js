const express = require("express");
const router = express.Router();
const nacl = require("tweetnacl");
const bs58 = require("bs58");
const bip39 = require("bip39");
const { derivePath } = require("ed25519-hd-key");

// Importar wallet via SEED ou PRIVATE KEY
router.post("/import", async (req, res) => {
  try {
    const { input } = req.body;

    if (!input) return res.status(400).json({ ok: false, message: "Input obrigatório" });

    let keypair;

    // SE FOR SEED PHRASE
    if (input.trim().split(" ").length >= 12) {
      const seed = await bip39.mnemonicToSeed(input);
      const derived = derivePath("m/44'/501'/0'/0'", Buffer.from(seed).toString("hex")).key;
      keypair = nacl.sign.keyPair.fromSeed(derived);
    }

    // SE FOR PRIVATE KEY (ARRAY)
    else if (/^\[.*\]$/.test(input.trim())) {
      const arr = JSON.parse(input);
      keypair = nacl.sign.keyPair.fromSecretKey(Uint8Array.from(arr));
    }

    // SE FOR PRIVATE KEY BASE58
    else {
      const decoded = bs58.decode(input);
      keypair = nacl.sign.keyPair.fromSecretKey(decoded);
    }

    const walletAddress = bs58.encode(keypair.publicKey);
    const secretKey = Array.from(keypair.secretKey);

    // salva sessão
    req.session.user = {
      walletPubkey: walletAddress,
      balanceSol: 0,
    };

    return res.json({
      ok: true,
      publicKey: walletAddress,
      secretKey,
    });
  } catch (err) {
    console.error("Erro import:", err);
    return res.status(400).json({
      ok: false,
      message: "Chave inválida",
    });
  }
});

module.exports = router;
