import nacl from "tweetnacl";
import bs58 from "bs58";
import { Keypair } from "@solana/web3.js";
import { createSession } from "../sessions.js";   // <-- IMPORTANTE

// util: converte seed phrase em 32 bytes determinístico
function seedFromMnemonic(mnemonic) {
  const text = mnemonic.trim();
  const encoder = new TextEncoder();
  let hash = encoder.encode(text);

  if (hash.length > 32) hash = hash.slice(0, 32);

  if (hash.length < 32) {
    const padded = new Uint8Array(32);
    padded.set(hash);
    hash = padded;
  }

  return hash;
}

export async function importWallet(req, res) {
  try {
    const { input } = req.body;

    if (!input || typeof input !== "string") {
      return res.status(400).json({ error: "Input inválido" });
    }

    const trimmed = input.trim();
    let keypair = null;

    // 1 — SEED PHRASE 12–24 palavras
    const words = trimmed.split(/\s+/g);
    if (words.length >= 12 && words.length <= 24) {
      try {
        const seed32 = seedFromMnemonic(trimmed);
        const kp = nacl.sign.keyPair.fromSeed(seed32);
        keypair = Keypair.fromSecretKey(kp.secretKey);

        createSession(keypair.publicKey.toBase58(), res);  //<-- sessão criada

        return res.json({
          walletAddress: keypair.publicKey.toBase58(),
          secretKey: Array.from(keypair.secretKey),
          type: "mnemonic"
        });
      } catch (err) {
        console.log("Erro seed:", err);
      }
    }

    // 2 — PRIVATE KEY BASE58
    try {
      const decoded = bs58.decode(trimmed);
      if (decoded.length === 64) {
        keypair = Keypair.fromSecretKey(decoded);

        createSession(keypair.publicKey.toBase58(), res);  //<-- sessão criada

        return res.json({
          walletAddress: keypair.publicKey.toBase58(),
          secretKey: Array.from(keypair.secretKey),
          type: "base58"
        });
      }
    } catch {}

    // 3 — JSON array 64 bytes
    try {
      const arr = JSON.parse(trimmed);
      if (Array.isArray(arr) && arr.length === 64) {
        keypair = Keypair.fromSecretKey(Uint8Array.from(arr));

        createSession(keypair.publicKey.toBase58(), res);  //<-- sessão criada

        return res.json({
          walletAddress: keypair.publicKey.toBase58(),
          secretKey: arr,
          type: "json"
        });
      }
    } catch {}

    return res.status(400).json({
      error: "Formato inválido. Use seed phrase, base58 ou JSON array."
    });

  } catch (err) {
    console.error("Erro /auth/import", err);
    return res.status(500).json({ error: "Erro interno" });
  }
}
