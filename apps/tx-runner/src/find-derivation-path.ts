import { DirectSecp256k1HdWallet } from '@cosmjs/proto-signing';
import { stringToPath } from '@cosmjs/crypto';

const mnemonic = "harsh harsh mean pool tell oval cancel deal unit strategy deny pool"; // Replace with your mnemonic
const prefix = "ethm"; // Replace with your desired prefix
const targetAddress = "ethm12xf5dxa5n8jhfjh9az7aqc29mcnzuvmswm5vat"; // Replace with the target address

async function findDerivationPath() {
  const maxAccount = 10; // Increase this if needed
  const maxIndex = 10; // Increase this if needed
  const basePaths = [
    `m/44'/60'`,  // Ethereum-based
    `m/44'/118'`, // Cosmos-based
    `m/44'/0'`,   // Bitcoin-based
  ];

  for (const basePath of basePaths) {
    for (let account = 0; account < maxAccount; account++) {
      for (let index = 0; index < maxIndex; index++) {
        const path = `${basePath}/${account}'/0/${index}`;
        const hdPath = stringToPath(path);
        const wallet = await DirectSecp256k1HdWallet.fromMnemonic(mnemonic, { prefix, hdPaths: [hdPath] });
        const [derivedAccount] = await wallet.getAccounts();
        console.log(`Path: ${path}, Address: ${derivedAccount.address}`);
        if (derivedAccount.address === targetAddress) {
          console.log(`Match found! Derivation path: ${path}`);
          return;
        }
      }
    }
  }

  console.log("No matching derivation path found.");
}

findDerivationPath().catch(console.error);