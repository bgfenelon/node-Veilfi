// server/routes/auth.js
const express = require("express");
const router = express.Router();

const { createSession } = require("../sessions");
const { Keypair } = require("@solana/web3.js");
const bs58 = require("bs58");
const bip39 = require("bip39");

/**
 * Helper: create a sessionId (simple random string)
 */
function makeSessionId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/**
 * Helper: produce response-safe secretKey array (numbers)
 */
function secretKeyToArray(u8) {
  return Array.from(u8);
}

/**
 * POST /auth/login
 * Creates a new Keypair, stores session and sets cookie `sessionId`
 * Response: { ok: true, walletPubkey }
 */
router.post("/login", (req, res) => {
  try {
    const kp = Keypair.generate();
    const walletPubkey = kp.publicKey.toBase58();
    const secretKey = secretKeyToArray(kp.secretKey);

    const sessionId = makeSessionId();
    createSession(sessionId, {
      walletPubkey,
      secretKey,
    });

    // set cookie named "sessionId"
    res.cookie("sessionId", sessionId, {
      httpOnly: true,
      secure: false, // set true in production with https
      sameSite: "lax",
    });

    console.log("Created new session for", walletPubkey);
    return res.json({ ok: true, walletPubkey });
  } catch (err) {
    console.error("login error:", err);
    return res.status(500).json({ ok: false, error: "LOGIN_FAILED", details: err.message });
  }
});

/**
 * POST /auth/import
 * Body: { input: string }
 *
 * Accepts:
 *  - JSON array of 64 numbers (secretKey)
 *  - base58-encoded secretKey (length 64)
 *  - mnemonic (seed phrase) -> uses bip39 to get seed, take first 32 bytes as seed
 *
 * Stores session (cookie `sessionId`) and returns publicKey + secretKey array.
 */
router.post("/import", async (req, res) => {
  console.log("=== /auth/import hit ===");
  const { input } = req.body ?? {};

  if (!input || typeof input !== "string") {
    return res.status(400).json({ ok: false, error: "MISSING_INPUT" });
  }

  try {
    let keypair = null;

    const trimmed = input.trim();

    // 1) Try JSON array of numbers
    if (/^\[.*\]$/.test(trimmed)) {
      try {
        const arr = JSON.parse(trimmed);
        if (Array.isArray(arr) && arr.length >= 64) {
          // ensure numbers
          const nums = arr.map((v) => Number(v));
          const u8 = Uint8Array.from(nums);
          keypair = Keypair.fromSecretKey(u8);
        } else {
          throw new Error("Invalid secretKey array length");
        }
      } catch (err) {
        // fallthrough to other parsers
      }
    }

    // 2) Try base58 secret key
    if (!keypair) {
      try {
        const decoded = bs58.decode(trimmed);
        if (decoded.length === 64 || decoded.length === 32) {
          // If 32 bytes: treat as seed; if 64: treat as secretKey (ed25519 sk)
          if (decoded.length === 64) {
            keypair = Keypair.fromSecretKey(decoded);
          } else {
            // 32 bytes seed
            keypair = Keypair.fromSeed(decoded);
          }
        }
      } catch (err) {
        // not base58 / ignore
      }
    }

    // 3) Try mnemonic (seed phrase)
    if (!keypair) {
      // Validate mnemonic using bip39
      if (bip39.validateMnemonic(trimmed)) {
        const seed = await bip39.mnemonicToSeed(trimmed); // Buffer
        // use first 32 bytes as seed (common simple derivation for dev)
        const seed32 = seed.slice(0, 32);
        keypair = Keypair.fromSeed(seed32);
      }
    }

    if (!keypair) {
      return res.status(400).json({ ok: false, error: "UNRECOGNIZED_INPUT_FORMAT" });
    }

    const walletPubkey = keypair.publicKey.toBase58();
    const secretKeyArr = secretKeyToArray(keypair.secretKey);

    // create session
    const sessionId = makeSessionId();
    createSession(sessionId, {
      walletPubkey,
      secretKey: secretKeyArr,
    });

    // set cookie named "sessionId"
    res.cookie("sessionId", sessionId, {
      httpOnly: true,
      secure: false, // use true in production with https
      sameSite: "lax",
    });

    console.log("Imported wallet:", walletPubkey);

    // Return secretKey as array (convenient for dev). Remove in production or be careful.
    return res.json({
      ok: true,
      publicKey: walletPubkey,
      secretKey: secretKeyArr,
    });
  } catch (err) {
    console.error("/auth/import error:", err);
    return res.status(500).json({ ok: false, error: "IMPORT_FAILED", details: err.message });
  }
});

module.exports = router;
