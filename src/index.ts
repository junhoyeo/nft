import fs from 'fs';
import * as path from 'path';

import { createCandyMachine } from './utils/metaplex';

const uploadMetadata = async () => {
  const manifest = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, '../assets/nft.json')).toString(),
  );
  const manifestUri =
    'https://arweave.net:443/ioNfcc4jSvHo0xnbL-IAmE1-dVsxnTkdIUxvWplbv_E';

  await createCandyMachine({
    manifest,
    manifestUri,
    environment: 'devnet',
  });
};

uploadMetadata();
