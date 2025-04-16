/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import {
    createMessageSend,
    signatureToWeb3Extension
  } from '@evmos/transactions'
  import axios from 'axios'
  import { DirectSecp256k1HdWallet } from '@cosmjs/proto-signing'
  
  // Update the Wallet interface to reflect that getAccounts() returns a readonly array.
  export interface Wallet {
    getAccounts(): Promise<readonly { address: string }[]>;
    signDirect(address: string, signDoc: any): Promise<{
      signed: any;
      signature: { signature: string };
    }>;
  }
  
  export async function sendXrp(wallet: Wallet, config: any) {
    const [account] = await wallet.getAccounts();
    const senderAddress = account.address;
  
    const { data: accountData } = await axios.get(
      `${config.rpcUrl}/cosmos/auth/v1beta1/accounts/${senderAddress}`
    );
    const baseAccount = accountData.account.base_account || accountData.account;
    const sequence = Number(baseAccount.sequence);
    const accountNumber = Number(baseAccount.account_number);
  
    const pubkey: string =
      baseAccount.pub_key && baseAccount.pub_key.key ? baseAccount.pub_key.key : "";
  
    const sender = {
      accountAddress: senderAddress,
      sequence,
      accountNumber,
      pubkey
    };
  
    const amtStr = '1000000'; // 1 XRP = 1,000,000 axrp
    const fee = {
      amount: '5000000000000000',  // fee as a string
      gas: '200000',
      denom: config.denom
    };
  
    const msg = createMessageSend(
      config.chainId,          // chain
      sender,                  // sender object
      fee,                     // fee object
      "",                      // memo
      {
        destinationAddress: config.recipient,
        denom: config.denom,
        amount: amtStr
      }
    );
  
    const signDoc = {
      accountNumber,
      sequence,
      chainId: config.chainId,
      fee,
      msgs: [msg],
      memo: ''
    };
  
    const signerData = await wallet.signDirect(senderAddress, signDoc);
  
    const extension = signatureToWeb3Extension(
      { chainId: config.chainId, cosmosChainId: config.chainId },
      sender,
      signerData.signature.signature
    );
  
    const rawTx = {
      auth_info: signerData.signed.auth_info,
      body: signerData.signed.body,
      signatures: [signerData.signature.signature]
    };
  
    const txBytes = Buffer.from(JSON.stringify(rawTx)).toString('base64');
  
    const res = await axios.post(`${config.rpcUrl}/cosmos/tx/v1beta1/txs`, {
      tx_bytes: txBytes,
      mode: 'BROADCAST_MODE_SYNC'
    });
  
    console.log('📤 Broadcast result:', res.data);
  }
  