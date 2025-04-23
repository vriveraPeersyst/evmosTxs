import { sendXrp } from '@transactions/services/send-xrp.service';
import { createWalletFromMnemonic } from '@transactions/factories/wallet.factory';
import { wrapDirectSigner } from '@transactions/factories/walletWrapper';
import { config } from './config';

async function main() {
  const rawWallet = await createWalletFromMnemonic(config.mnemonic, config.prefix);
  const wallet = wrapDirectSigner(rawWallet);  // Wrap the raw wallet with our adapter
  await sendXrp(wallet, config);
}

main().catch(console.error);
