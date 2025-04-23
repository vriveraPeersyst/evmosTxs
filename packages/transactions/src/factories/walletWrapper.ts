/* eslint-disable @typescript-eslint/no-explicit-any */
import Long from 'long';
import { Wallet } from '../services/send-xrp.service';

/*
  Define a minimal type for an offline signer.
  We let the parameter signDoc be of type any to match the signer's own expectation.
*/
type OfflineDirectSignerMinimal = {
  getAccounts: () => Promise<readonly { address: string }[]>;
  signDirect: (address: string, signDoc: any) => Promise<{
    signed: any;
    signature: { signature: string };
  }>;
};

/**
 * wrapDirectSigner adapts an offline signer (for example, a DirectSecp256k1HdWallet)
 * to the Wallet interface expected by send-xrp.service.ts.
 *
 * The offline signer’s signDirect method returns a SignDoc with camelCase properties
 * (like "body" and "authInfo"), whereas our service expects properties "body_bytes"
 * and "auth_info_bytes". This wrapper converts the response accordingly.
 */
export function wrapDirectSigner(
  signer: OfflineDirectSignerMinimal
): Wallet {
  return {
    getAccounts: () => signer.getAccounts(),
    signDirect: async (address: string, signDoc: any): Promise<any> => {
      const res = await signer.signDirect(address, signDoc);
      // If encoded fields don't exist, create them via a temporary hack:
      if (
        !('body_bytes' in res.signed) &&
        'body' in res.signed &&
        !('auth_info_bytes' in res.signed) &&
        'authInfo' in res.signed
      ) {
        return {
          signature: res.signature,
          signed: {
            body_bytes: new Uint8Array(Buffer.from(JSON.stringify(res.signed.body))),
            auth_info_bytes: new Uint8Array(Buffer.from(JSON.stringify(res.signed.authInfo))),
            chain_id: res.signed.chainId,
            account_number: res.signed.accountNumber instanceof Long
              ? res.signed.accountNumber.toNumber()
              : res.signed.accountNumber,
          },
        };
      }
      return res;
    },
  };
}
