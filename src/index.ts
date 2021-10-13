import fs from 'fs';
import * as path from 'path';

import { bs58 } from '@project-serum/anchor/dist/cjs/utils/bytes';
import { Keypair } from '@solana/web3.js';

import { createCandyMachine } from './utils/metaplex';

type MainProps =
  | {
      environment: 'mainnet-beta';
      secretKey: string;
    }
  | {
      environment: 'testnet' | 'devnet';
    };

const main = async (props: MainProps) => {
  const manifest = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, '../assets/nft.json')).toString(),
  );
  const manifestUri =
    'https://arweave.net:443/ioNfcc4jSvHo0xnbL-IAmE1-dVsxnTkdIUxvWplbv_E';

  await createCandyMachine({
    manifest,
    manifestUri,
    environment: props.environment,
    fromWallet:
      props.environment === 'mainnet-beta'
        ? Keypair.fromSecretKey(bs58.decode(props.secretKey))
        : Keypair.generate(),
  });
};

main({ environment: 'testnet' });
