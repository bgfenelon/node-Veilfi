// backend/services/solana.js
const {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction
} = require('@solana/web3.js');

const {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction
} = require('@solana/spl-token');

const { decryptSecret } = require('./crypto');

const RPC = process.env.RPC_URL || 'https://api.devnet.solana.com';
const connection = new Connection(RPC, 'confirmed');

function keypairFromSecret(secretUint8) {
  try {
    return Keypair.fromSecretKey(secretUint8);
  } catch {
    return Keypair.fromSeed(secretUint8.slice(0, 32));
  }
}

async function getBalance(pubkey) {
  return await connection.getBalance(new PublicKey(pubkey));
}

async function getTokens(pubkey) {
  const resp = await connection.getParsedTokenAccountsByOwner(new PublicKey(pubkey), { programId: TOKEN_PROGRAM_ID });
  return resp.value.map(acc => {
    const info = acc.account.data.parsed.info;
    return {
      mint: info.mint,
      amount: Number(info.tokenAmount.amount),
      decimals: info.tokenAmount.decimals,
      address: acc.pubkey.toBase58()
    };
  });
}

async function withdrawSol(ciphertext, iv, passphrase, salt, to, amountLamports) {
  const secret = await decryptSecret(ciphertext, iv, passphrase, salt);
  const kp = keypairFromSecret(secret);

  const balance = BigInt(await getBalance(kp.publicKey.toBase58()));
  const amount = BigInt(amountLamports);
  const estimatedFee = 5000n;

  if (balance < amount + estimatedFee) throw new Error('insufficient funds');

  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: kp.publicKey,
      toPubkey: new PublicKey(to),
      lamports: amount
    })
  );

  const sig = await sendAndConfirmTransaction(connection, tx, [kp], { commitment: 'confirmed' });
  return sig;
}

async function sendSpl(ciphertext, iv, passphrase, salt, to, mint, amountBaseUnits) {
  const secret = await decryptSecret(ciphertext, iv, passphrase, salt);
  const kp = keypairFromSecret(secret);
  const owner = kp.publicKey;
  const mintPub = new PublicKey(mint);
  const recipient = new PublicKey(to);

  const fromAta = await getAssociatedTokenAddress(mintPub, owner);
  const toAta = await getAssociatedTokenAddress(mintPub, recipient);

  const instructions = [];
  const toInfo = await connection.getAccountInfo(toAta);
  if (!toInfo) {
    const ataRent = await connection.getMinimumBalanceForRentExemption(165);
    // Throw if owner has insufficient SOL to cover ata rent + fee
    const ownerSol = BigInt(await getBalance(owner.toBase58()));
    const conservativeFee = 5000n;
    if (ownerSol < ataRent + conservativeFee) {
      throw new Error('owner has insufficient SOL to create recipient ATA (rent + fee)');
    }
    instructions.push(createAssociatedTokenAccountInstruction(owner, toAta, recipient, mintPub));
  }

  instructions.push(createTransferInstruction(fromAta, toAta, owner, BigInt(amountBaseUnits), [], TOKEN_PROGRAM_ID));

  const tx = new Transaction().add(...instructions);
  const sig = await sendAndConfirmTransaction(connection, tx, [kp], { commitment: 'confirmed' });
  return sig;
}

module.exports = { connection, getBalance, getTokens, withdrawSol, sendSpl };
