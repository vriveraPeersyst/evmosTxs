/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createMessageSend, signatureToWeb3Extension } from '@evmos/transactions'
import { TxRaw } from 'cosmjs-types/cosmos/tx/v1beta1/tx'
import axios from 'axios'
import { DirectSecp256k1HdWallet } from '@cosmjs/proto-signing'
import { makeSignDoc, makeAuthInfoBytes } from '@cosmjs/proto-signing'
import { fromBase64, toBase64 } from '@cosmjs/encoding'
import { Int53 } from '@cosmjs/math'
import { Any } from 'cosmjs-types/google/protobuf/any'
import { PubKey } from 'cosmjs-types/cosmos/crypto/secp256k1/keys'
import Long from 'long'
import { Secp256k1, Secp256k1Keypair } from '@cosmjs/crypto';
import { Bip39, EnglishMnemonic } from '@cosmjs/crypto';
import { Slip10, Slip10Curve } from '@cosmjs/crypto';
import { stringToPath } from '@cosmjs/crypto';

/**
 * Minimal Wallet interface.
 * - getAccounts returns a readonly array.
 * - signDirect returns a response from the offline signer.
 *   (We relax the return type to any to allow for a SignDoc that doesn't include encoded bytes.)
 */
export interface Wallet {
  getAccounts(): Promise<readonly { address: string }[]>;
  signDirect(address: string, signDoc: any): Promise<any>;
}

async function derivePublicKeyFromMnemonic(mnemonic: string, hdPath: string): Promise<Uint8Array> {
  const seed = await Bip39.mnemonicToSeed(new EnglishMnemonic(mnemonic));
  const { privkey } = Slip10.derivePath(Slip10Curve.Secp256k1, seed, stringToPath(hdPath));
  const keypair: Secp256k1Keypair = await Secp256k1.makeKeypair(privkey);
  return keypair.pubkey;
}

export async function sendXrp(wallet: Wallet, config: any): Promise<void> {
  const [account] = await wallet.getAccounts();
  const senderAddress = account.address;

  // Query account details from RPC.
  const { data: accountData } = await axios.get(
    `${config.rpcUrl}/cosmos/auth/v1beta1/accounts/${senderAddress}`
  );
  const baseAccount = accountData.account.base_account || accountData.account;
  const sequence = Number(baseAccount.sequence);
  const accountNumber = baseAccount.account_number instanceof Long
    ? baseAccount.account_number.toNumber()
    : Number(baseAccount.account_number) || 0;

  // Attempt to retrieve the public key from the account data.
  let pubkey = baseAccount.pub_key?.key;

  // If the public key is missing, derive it from the mnemonic.
  if (!pubkey) {
    console.warn(`Public key is missing for account: ${senderAddress}. Deriving it from the mnemonic.`);
    const pubKeyBytes = await derivePublicKeyFromMnemonic(config.mnemonic, "m/44'/60'/0'/0/0");
    if (!pubKeyBytes) {
      throw new Error('Failed to derive public key bytes.');
    }
    pubkey = toBase64(pubKeyBytes);
    console.log(`Derived public key (base64): ${pubkey}`);
  }

  // Ensure the public key is defined.
  if (!pubkey) {
    throw new Error(`Public key is undefined for account: ${senderAddress}`);
  }

  // Construct the sender object.
  const sender = {
    accountAddress: senderAddress,
    sequence,
    accountNumber,
    pubkey,
  };

  // Define amount and fee.
  const amtStr = '1000000'; // 1 XRP in micro-units
  const feeCoins = [{ denom: config.denom, amount: '5000' }];
  const fee = { amount: '5000', gas: '200000', denom: config.denom };

  // Create the message.
  const msg = createMessageSend(
    config.chainId,
    sender,
    fee,
    '',
    {
      destinationAddress: config.recipient,
      denom: config.denom,
      amount: amtStr,
    }
  );

  // Construct the TxBody object.
  const txBody = { messages: [msg], memo: '' };
  const txBodyBytes = new Uint8Array(Buffer.from(JSON.stringify(txBody)));

  // Ensure the public key is a valid Uint8Array.
  const pubKeyBytes = fromBase64(pubkey);
  if (!pubKeyBytes || !(pubKeyBytes instanceof Uint8Array)) {
    throw new Error('Invalid public key format. Expected a Uint8Array.');
  }

  // Build the PubKey object.
  const pubKeyObject = PubKey.fromPartial({
    key: pubKeyBytes,
  });

  // Validate the PubKey object.
  if (!pubKeyObject.key || !(pubKeyObject.key instanceof Uint8Array)) {
    throw new Error('Invalid PubKey object. The key property is missing or invalid.');
  }

  // Encode the PubKey object.
  const pubkeyAny = Any.fromPartial({
    typeUrl: '/ethermint.crypto.v1.ethsecp256k1.PubKey',
    value: PubKey.encode(pubKeyObject).finish(),
  });

  const gasLimit = 200000;
  const authInfoBytes = makeAuthInfoBytes(
    [{ pubkey: pubkeyAny, sequence }],
    feeCoins,
    gasLimit,
    undefined, // feeGranter
    undefined  // feePayer
  );

  // Build the sign document.
  const signDoc = makeSignDoc(txBodyBytes, authInfoBytes, config.chainId, accountNumber);

  // Sign the transaction using the offline signer.
  const signResponse = await wallet.signDirect(senderAddress, signDoc);
  const signed = signResponse.signed;

  // Debug log to inspect the structure
  console.debug('signResponse:', signResponse);
  console.debug('signed:', signed);

  // Use unique variable names for signed values
  let bodyBytes: Uint8Array;
  let authInfoBytesFinal: Uint8Array;

  // Accept both camelCase and snake_case for bodyBytes
  if (signed.body_bytes instanceof Uint8Array) {
    bodyBytes = signed.body_bytes;
  } else if (signed.bodyBytes instanceof Uint8Array) {
    bodyBytes = signed.bodyBytes;
  } else if (typeof signed.body_bytes === 'string') {
    bodyBytes = fromBase64(signed.body_bytes);
  } else if (typeof signed.bodyBytes === 'string') {
    bodyBytes = fromBase64(signed.bodyBytes);
  } else {
    throw new Error('signed.body_bytes/bodyBytes is missing or invalid');
  }

  // Accept both camelCase and snake_case for authInfoBytes
  if (signed.auth_info_bytes instanceof Uint8Array) {
    authInfoBytesFinal = signed.auth_info_bytes;
  } else if (signed.authInfoBytes instanceof Uint8Array) {
    authInfoBytesFinal = signed.authInfoBytes;
  } else if (typeof signed.auth_info_bytes === 'string') {
    authInfoBytesFinal = fromBase64(signed.auth_info_bytes);
  } else if (typeof signed.authInfoBytes === 'string') {
    authInfoBytesFinal = fromBase64(signed.authInfoBytes);
  } else {
    throw new Error('signed.auth_info_bytes/authInfoBytes is missing or invalid');
  }

  // Ensure both are Uint8Array
  if (
    !bodyBytes ||
    !(bodyBytes instanceof Uint8Array) ||
    !authInfoBytesFinal ||
    !(authInfoBytesFinal instanceof Uint8Array)
  ) {
    throw new Error(
      'Wallet did not return valid signed.body_bytes or signed.auth_info_bytes. ' +
      'Both must be Uint8Array.'
    );
  }

  // Decode and check the signature
  const decodedSignature = fromBase64(signResponse.signature.signature);
  if (!decodedSignature || !(decodedSignature instanceof Uint8Array)) {
    throw new Error('Decoded signature is not a valid Uint8Array.');
  }

  // Encode the transaction.
  const txRaw = {
    bodyBytes,
    authInfoBytes: authInfoBytesFinal,
    signatures: [decodedSignature],
  };
  const encodedTx = TxRaw.encode(txRaw).finish();
  const txBytesBase64 = Buffer.from(encodedTx).toString('base64');

  // Broadcast the transaction.
  const res = await axios.post(`${config.rpcUrl}/cosmos/tx/v1beta1/txs`, {
    tx_bytes: txBytesBase64,
    mode: 'BROADCAST_MODE_SYNC',
  });

  console.log('📤 Broadcast result:', res.data);
}
