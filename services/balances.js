const { PublicKey } = require("@solana/web3.js");
const { TOKEN_PROGRAM_ID } = require("@solana/spl-token");
const { createConnection } = require("./solana");

async function getUserBalances(pubkeyStr, supportedMints) {
  try {
    const connection = createConnection();
    const pubkey = new PublicKey(pubkeyStr);

    //------------------------------------
    // 1. SOL BALANCE
    //------------------------------------
    const solLamports = await connection.getBalance(pubkey);
    const sol = solLamports / 1e9;

    //------------------------------------
    // 2. SPL TOKEN ACCOUNTS
    //------------------------------------
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      pubkey,
      { programId: TOKEN_PROGRAM_ID }
    );

    const spl = {};

    for (const item of tokenAccounts.value) {
      const info = item.account.data.parsed.info;
      const mint = info.mint;

      // ignorar tokens não suportados
      if (!supportedMints.includes(mint)) continue;

      const amount = info.tokenAmount.uiAmount || 0;
      spl[mint] = amount;
    }

    //------------------------------------
    // 3. Tokens suportados SEM ATA → 0
    //------------------------------------
    supportedMints.forEach((mint) => {
      if (spl[mint] === undefined) {
        spl[mint] = 0;
      }
    });

    return {
      sol,
      spl,
    };

  } catch (err) {
    console.error("Error loading balances:", err);
    throw new Error("Unable to fetch balances");
  }
}

module.exports = {
  getUserBalances,
};
