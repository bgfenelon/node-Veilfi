// services/solana.js
const {
  Connection,
  PublicKey,
} = require("@solana/web3.js");

const {
  getMint,
} = require("@solana/spl-token");

// ---------------------------------------------
// RPC
// ---------------------------------------------
const connection = new Connection(
  process.env.RPC_URL,
  { commitment: "confirmed" }
);

// Program IDs
const TOKEN_KEG = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const TOKEN_2022 = new PublicKey("TokenzQdBNbLqZEWHy2LJjWCVzno7pBzuQ42v9oGwLz");

// ---------------------------------------------
// GET BALANCE
// ---------------------------------------------
async function getBalance(pubkey) {
  try {
    const lamports = await connection.getBalance(new PublicKey(pubkey));
    return lamports / 1e9;
  } catch (err) {
    console.log("ERRO getBalance:", err.message);
    return 0;
  }
}

// ---------------------------------------------
// BUSCA DE TOKENS 100% COMPATÍVEL COM PUMP
// ---------------------------------------------
async function getTokens(ownerPubkeyBase58) {
  const owner = new PublicKey(ownerPubkeyBase58);
  const result = {};

  async function parseList(list, programType) {
    for (const acc of list.value) {
      const info = acc.account.data.parsed?.info;
      if (!info) continue;

      const mint = info.mint;
      const amount = info.tokenAmount?.amount || "0";
      const decimals = info.tokenAmount?.decimals || 0;

      result[mint] = {
        mint,
        amount,
        decimals,
        uiAmount: Number(amount) / 10 ** decimals,
        program: programType,
      };
    }
  }

  // SPL
  try {
    const spl = await connection.getParsedTokenAccountsByOwner(
      owner,
      { programId: TOKEN_KEG }
    );
    await parseList(spl, "SPL");
  } catch (e) {
    console.log("ERRO SPL:", e.message);
  }

  // TOKEN‑2022 (PUMP)
  try {
    const t22 = await connection.getParsedTokenAccountsByOwner(
      owner,
      { programId: TOKEN_2022 }
    );
    await parseList(t22, "TOKEN_2022");
  } catch (e) {
    console.log("ERRO 2022:", e.message);
  }

  return Object.values(result);
}

// ---------------------------------------------
// EXPORTS
// ---------------------------------------------
module.exports = {
  connection,
  getBalance,
  getTokens
};
