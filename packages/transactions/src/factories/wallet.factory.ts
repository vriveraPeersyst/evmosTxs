import { DirectSecp256k1HdWallet } from '@cosmjs/proto-signing';
import { stringToPath } from '@cosmjs/crypto';

const evmosHdPath = stringToPath("m/44'/60'/0'/0/0");

export async function createWalletFromMnemonic(mnemonic: string, prefix: string) {
  return DirectSecp256k1HdWallet.fromMnemonic(mnemonic, { prefix, hdPaths: [evmosHdPath] });
}
