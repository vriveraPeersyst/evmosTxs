# evmosTxs

**evmosTxs** is a monorepo for creating and broadcasting transactions on an Evmos-based chain with EVM support. The project is organized into multiple workspaces:

- **apps/tx-runner** – A command-line tool that loads configuration (from a .env file), creates a wallet from a mnemonic, and sends a transaction.
- **packages/transactions** – A reusable package that contains all the core transaction logic (including message creation, signing, and broadcast).
- **stubs/** – Local stub packages for Buf dependencies that are not published on npm.
- **declarations.d.ts** – Global module declarations for packages that do not provide their own TypeScript types.

## Prerequisites

- [Node.js (v14 or higher)](https://nodejs.org/)
- [PNPM](https://pnpm.io/)
- For building protobuf files (if needed):  
  - **macOS:** Install `protoc` via Homebrew (e.g. `brew install protoc`)  
  - **Linux:** Install `protoc` using your package manager
- (Optional) Global dependencies for protobuf generation (see scripts in the repo).

## Installation

1. **Clone the repository:**

   ```bash
   git clone <repository_url>
   cd evmosTxs
   ```

2. **Install dependencies (from the root):**

   ```bash
   pnpm install
   ```

   The monorepo uses PNPM workspaces, so all dependencies for the different packages and apps will be installed.

## Configuration

The main configuration is stored in the **apps/tx-runner/src/config.ts** file, which loads environment variables from the `.env` file. For example:

```env
MNEMONIC="your twelve (or twenty-four) word mnemonic here"
```

Ensure the `rpcUrl` does **not** have a trailing slash. For example, use:

```ts
export const config = {
  mnemonic: process.env.MNEMONIC!,
  prefix: 'ethm',
  denom: 'axrp',
  chainId: 'xrplevm_1449000-1',
  rpcUrl: 'https://rpc.xrpl.cumulo.com.es',  // no trailing slash!
  recipient: 'ethm10e82dmed8mudr8ey09c0lhx6uh682ugyh44czc'
}
```

> **Note:** A trailing slash may lead to double slashes in the generated URL (e.g. `//cosmos/auth/...`), which could result in a 404 error if the endpoint is strict.

## Usage

From the root of the repository, start the tx-runner app with:

```bash
pnpm --filter tx-runner start
```

This command uses `ts-node` (with path alias resolution) to run **apps/tx-runner/src/main.ts**, which then creates a wallet, signs a transaction, and broadcasts it via the specified RPC endpoint.

### Troubleshooting Account 404 Errors

If you encounter a 404 error when querying for an account (for example, the RPC returns "404 page not found"), check the following:
- **RPC URL:** Verify that the `rpcUrl` is correct (and that you are not using a trailing slash).
- **Account Existence:** Ensure the account exists on the network (the account may need to be created or funded).
- **Endpoint Support:** Confirm that the RPC node supports the `/cosmos/auth/v1beta1/accounts/` endpoint.

## Repository Structure

```text
evmosTxs/
├── .eslintrc.js
├── .prettierrc
├── README.md
├── apps
│   └── tx-runner
│       ├── .env              # Secrets and environment configuration (not committed)
│       ├── package.json
│       ├── src
│       │   ├── config.ts      # Main configuration (loads from .env)
│       │   └── main.ts        # Entry point that runs the tx-runner app
│       └── tsconfig.json
├── backup_and_export.sh       # Script to generate a repo report
├── declarations.d.ts          # Global module declarations
├── package.json               # Root package definition (PNPM workspaces)
├── packages
│   └── transactions
│       ├── package.json       # Contains transaction building/signing logic
│       └── src
│           ├── factories
│           │   └── wallet.factory.ts  # Creates wallets from mnemonics
│           └── services
│               └── send-xrp.service.ts   # Contains logic to create, sign, and broadcast transactions
├── pnpm-lock.yaml             # PNPM lockfile
├── pnpm-workspace.yaml        # Defines workspace packages
├── repo_report.txt            # Generated repository report
├── stubs
│   ├── buf-cosmos_cosmos-sdk.bufbuild_es
│   │   ├── index.js
│   │   └── package.json
│   ├── buf-cosmos_ibc.bufbuild_es
│   │   ├── index.js
│   │   └── package.json
│   └── buf-evmos_evmos.bufbuild_es
│       ├── index.js
│       └── package.json
└── tsconfig.json              # Root TypeScript config
```

## Scripts

- **backup_and_export.sh**: Generates a report of your repository structure and important file contents.

## Contributing

Feel free to submit issues or pull requests. Any contributions that improve the transaction logic or developer experience are welcome!

## License

[MIT License](LICENSE)