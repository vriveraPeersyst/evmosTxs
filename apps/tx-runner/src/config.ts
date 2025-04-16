import * as dotenv from 'dotenv';

dotenv.config();


export const config = {
    mnemonic: process.env.MNEMONIC!, // use dotenv in dev, or Docker secrets in prod
    prefix: 'ethm',
    denom: 'axrp',
    chainId: 'xrplevm_1449000-1',
    rpcUrl: 'https://rpc.xrpl.cumulo.com.es',
    recipient: 'ethm10e82dmed8mudr8ey09c0lhx6uh682ugyh44czc' // replace with actual address
  }
  