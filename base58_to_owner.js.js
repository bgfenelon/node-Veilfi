// base58_to_owner.js
// Coloque sua private key Base58 em base58.txt (apenas no seu PC).
const fs = require("fs");
const bs58 = require("bs58");
const { Keypair } = require("@solana/web3.js");

const file = "./base58.txt";
if (!fs.existsSync(file)) {
  console.error("Crie base58.txt com sua chave privada BASE58 (apenas no seu PC).");
  process.exit(1);
}

const b58 = fs.readFileSync(file, "utf8").trim();
if (!b58) { console.error("base58.txt vazio"); process.exit(1); }

let secret;
try {
  secret = bs58.decode(b58);
} catch (e) {
  console.error("Erro ao decodificar base58:", e.message);
  process.exit(1);
}

let keypair;
if (secret.length === 64) {
  keypair = Keypair.fromSecretKey(secret);
} else if (secret.length === 32) {
  // seed 32 bytes
  keypair = Keypair.fromSeed(secret);
} else {
  console.error("Chave decodificada tem comprimento inesperado:", secret.length);
  process.exit(1);
}

// grava owner.json (array) local
fs.writeFileSync("owner.json", JSON.stringify(Array.from(keypair.secretKey)));
console.log("owner.json criado com sucesso. Public key:", keypair.publicKey.toBase58());
