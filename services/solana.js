const { Connection, Keypair, PublicKey } = require("@solana/web3.js");
const bs58 = require("bs58");
const env = require("../env");

const connection = new Connection(env.RPC_URL, "confirmed");

const platformSecretKeyBase58 = process.env.SITE_SECRET_KEY;
const platformSecretKey = bs58.decode(platformSecretKeyBase58);
const platformKeypair = Keypair.fromSecretKey(platformSecretKey);
const platformPubkey = platformKeypair.publicKey;

const tokenMint = new PublicKey(env.TOKEN_MINT);

module.exports = {
  connection,
  platformKeypair,
  platformPubkey,
  tokenMint,
};
