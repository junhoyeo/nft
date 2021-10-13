import fs from 'fs';
import * as path from 'path';

import { createCandyMachine } from './utils/metaplex';

const uploadMetadata = async () => {
  const manifest = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, '../assets/nft.json')).toString(),
  );
  manifest.properties.files[0].uri =
    'http://localhost/6h-2-XJF0Q6ofmQix8MqczRQzhZ_gVpyHOxtmnrrcKY';
  manifest.properties.files[0].type = 'image/png';

  const manifestUri =
    'http://localhost/vh5wUJ8QoDcgzrVrRfMY-EMorsZi--V2qImcGroZ-QQ';

  await createCandyMachine({
    manifest,
    manifestUri,
    environment: 'devnet',
  });
};

uploadMetadata();
