// backend/services/depositTracker.js
// Polling deposit tracker per-user (simple, reliable for MVP).

const solana = require("./solana");   // <--- IMPORT CORRIGIDO
const connection = solana.connection; // <--- CONNECTION GARANTIDA
const { query } = require("../db");
const { PublicKey } = require("@solana/web3.js");

const POLL_INTERVAL_MS = Number(process.env.DEPOSIT_POLL_INTERVAL_MS || 15000);

async function getTrackedSignaturesForAddress(pubkey) {
  try {
    const sigs = await connection.getSignaturesForAddress(pubkey, { limit: 20 });
    return sigs || [];
  } catch (e) {
    console.error(
      "Error fetching signatures for",
      pubkey.toBase58?.() || pubkey,
      e.message || e
    );
    return [];
  }
}

async function signatureExists(signature) {
  const r = await query(
    "SELECT 1 FROM activities WHERE signature=$1 LIMIT 1",
    [signature]
  );
  return r.rowCount > 0;
}

async function insertDepositActivity(userId, signature, amountLamports, slot, txInfo) {
  await query(
    `INSERT INTO activities (user_id, type, token, amount, signature, metadata)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [
      userId,
      "deposit",
      "SOL",
      amountLamports,
      signature,
      JSON.stringify({ slot, txInfo }),
    ]
  );
}

async function handleSignatureForUser(user) {
  const pub = new PublicKey(user.pubkey);

  const sigs = await getTrackedSignaturesForAddress(pub);

  for (const s of sigs) {
    const sig = s.signature;

    const exists = await signatureExists(sig);
    if (exists) continue;

    try {
      const tx = await connection.getTransaction(sig, {
        commitment: "confirmed",
      });
      if (!tx || !tx.meta) continue;

      const accounts = tx.transaction.message.accountKeys.map((k) =>
        k.toBase58()
      );
      const idx = accounts.indexOf(pub.toBase58());
      if (idx === -1) continue;

      const preBalances = tx.meta.preBalances || [];
      const postBalances = tx.meta.postBalances || [];

      const delta = (postBalances[idx] || 0) - (preBalances[idx] || 0);

      if (delta > 0) {
        await insertDepositActivity(user.id, sig, delta, tx.slot, {
          blockTime: tx.blockTime,
        });
        console.log(
          `Detected deposit for user ${user.id} ${delta} lamports sig ${sig}`
        );
      }
    } catch (e) {
      console.error("Error processing tx", sig, e.message || e);
    }
  }
}

let running = false;
async function start() {
  if (running) return;
  running = true;
  console.log(
    "Starting deposit tracker (polling) every",
    POLL_INTERVAL_MS,
    "ms"
  );

  setInterval(async () => {
    try {
      const res = await query("SELECT id, pubkey FROM users");
      for (const row of res.rows) {
        try {
          await handleSignatureForUser(row);
        } catch (err) {
          console.error(
            "Error handling user",
            row.id,
            err.message || err
          );
        }
      }
    } catch (e) {
      console.error("Deposit tracker top-level error", e.message || e);
    }
  }, POLL_INTERVAL_MS);
}

module.exports = { start };
