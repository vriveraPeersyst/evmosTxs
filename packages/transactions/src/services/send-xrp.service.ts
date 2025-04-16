/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createMessageSend, signatureToWeb3Extension } from '@evmos/transactions'
import { TxRaw } from 'cosmjs-types/cosmos/tx/v1beta1/tx'
import axios from 'axios'
import { DirectSecp256k1HdWallet } from '@cosmjs/proto-signing'
import { makeSignDoc, makeAuthInfoBytes } from '@cosmjs/proto-signing'
import { fromBase64 } from '@cosmjs/encoding'
import { Int53 } from '@cosmjs/math'
import { Any } from 'cosmjs-types/google/protobuf/any'
import { PubKey } from 'cosmjs-types/cosmos/crypto/secp256k1/keys'
import Long from 'long'

/**
 * Minimal Wallet interface.
 * getAccounts returns a readonly array.
 * signDirect returns a response from the offline signer.
 * (We relax the type for signDirect to allow for the SignDoc structure returned by DirectSecp256k1HdWallet.)
 */
export interface Wallet {
  getAccounts(): Promise<readonly { address: string }[]>;
  signDirect(address: string, signDoc: any): Promise<{
    signed: { 
      body_bytes?: Uint8Array; 
      auth_info_bytes?: Uint8Array;
      body?: any;
      auth_info?: any;
      chain_id?: string;
      account_number?: number | Long;
    },
    signature: { signature: string }
  }>;
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
  const accountNumber = (baseAccount.account_number?.toNumber 
    ? baseAccount.account_number.toNumber() 
    : Number(baseAccount.account_number)) || 0;

  // Retrieve the public key as a base64 string.
  const pubkey: string = baseAccount.pub_key?.key || "";

  // Construct the sender object.
  const sender = {
    accountAddress: senderAddress,
    sequence,
    accountNumber,
    pubkey
  };

  // Define amount and fee.
  // Assume: 1 XRP = 1,000,000 axrp.
  const amtStr = '1000000';
  const feeCoins = [{ denom: config.denom, amount: '5000000000000000' }];
  // Add top-level property "denom" to satisfy the Fee type.
  const fee = { amount: feeCoins, gas: '200000', denom: config.denom };

  // Create the message. MessageSendParams expects:
  //   destinationAddress, denom, and amount (as string).
  const msg = createMessageSend(
    config.chainId, // chain id
    sender,         // sender object
    fee,            // fee (as coin array, gas, and top-level denom)
    "",             // memo (empty)
    {
      destinationAddress: config.recipient,
      denom: config.denom,
      amount: amtStr
    }
  );

  // Construct the TxBody object.
  // (Temporarily using JSON-stringification as a hack; in production use proper Protobuf encoding.)
  const txBody = { messages: [msg], memo: "" };
  const bodyBytes = new Uint8Array(Buffer.from(JSON.stringify(txBody)));

  // Build AuthInfo bytes using makeAuthInfoBytes.
  // Build an Any for the public key using the Evmos type.
  const pubkeyAny = Any.fromPartial({
    typeUrl: "/ethermint.crypto.v1.ethsecp256k1.PubKey",
    value: PubKey.encode({ key: fromBase64(pubkey) }).finish(),
  });
  const gasLimit = Int53.fromString(fee.gas).toNumber();
  // Pass feeGranter and feePayer as undefined.
  const authInfoBytes = makeAuthInfoBytes([{ pubkey: pubkeyAny, sequence }], feeCoins, gasLimit, undefined, undefined);

  // Build the sign document.
  const signDoc = makeSignDoc(bodyBytes, authInfoBytes, config.chainId, accountNumber);

  // Sign the transaction using the offline signer.
  const signResponse = await wallet.signDirect(senderAddress, signDoc);
  // signResponse.signed is a SignDoc. We expect encoded bytes in body_bytes and auth_info_bytes.
  const signed = signResponse.signed;

  // Transform the signed response:
  // If signed.body_bytes and signed.auth_info_bytes exist, use them.
  // Otherwise, fall back to JSON-stringify the corresponding fields.
  const bodyBytesEncoded = signed.body_bytes instanceof Uint8Array 
    ? signed.body_bytes 
    : new Uint8Array(Buffer.from(JSON.stringify(signed.body)));
  const authInfoBytesEncoded = signed.auth_info_bytes instanceof Uint8Array 
    ? signed.auth_info_bytes 
    : new Uint8Array(Buffer.from(JSON.stringify(signed.auth_info)));

  // Build the TxRaw object.
  const txRaw = {
    bodyBytes: bodyBytesEncoded,
    authInfoBytes: authInfoBytesEncoded,
    signatures: [fromBase64(signResponse.signature.signature)]
  };

  // Encode the transaction using Protobuf.
  const encodedTx = TxRaw.encode(txRaw).finish();
  const txBytesBase64 = Buffer.from(encodedTx).toString('base64');

  // Broadcast the transaction.
  const res = await axios.post(`${config.rpcUrl}/cosmos/tx/v1beta1/txs`, {
    tx_bytes: txBytesBase64,
    mode: "BROADCAST_MODE_SYNC"
  });

  console.log("📤 Broadcast result:", res.data);
}
