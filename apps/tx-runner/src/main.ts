import { sendXrp } from '@transactions/services/send-xrp.service'
import { createWalletFromMnemonic } from '@transactions/factories/wallet.factory'
import { config } from './config'

async function main() {
  const wallet = await createWalletFromMnemonic(config.mnemonic, config.prefix)
  await sendXrp(wallet, config)
}

main().catch(console.error)
