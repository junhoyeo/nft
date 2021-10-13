import Arweave from 'arweave';
import fs from 'fs';
import * as path from 'path';
import TestWeave from 'testweave-sdk';

import { getTransactionUri, uploadData } from './utils/arweave';
import { createCandyMachine } from './utils/metaplex';

const uploadMetadata = async () => {
  const arweave = Arweave.init({
    host: 'localhost',
    port: 1984,
    protocol: 'http',
    timeout: 20000,
    logging: false,
  });
  const testWeave = await TestWeave.init(arweave);
  const jwk = testWeave.rootJWK;

  const imageTransaction = await uploadData({
    connection: arweave,
    data: fs.readFileSync(path.resolve(__dirname, '../assets/nft.png')),
    contentType: 'image/png',
    jwk,
    isChunked: true,
  });

  const imageUri = getTransactionUri({
    connection: arweave,
    transaction: imageTransaction,
  });
  console.log({ imageUri });

  const manifest = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, '../assets/nft.json')).toString(),
  );
  manifest.image = imageUri;
  manifest.properties.files[0].uri = imageUri;
  manifest.properties.files[0].type = 'image/png';

  const manifestTransaction = await uploadData({
    connection: arweave,
    data: JSON.stringify(manifest),
    contentType: 'application/json',
    jwk,
    isChunked: false,
  });

  const manifestUri = getTransactionUri({
    connection: arweave,
    transaction: manifestTransaction,
  });
  console.log({ manifestUri });

  await createCandyMachine({ environment: 'devnet' });
  await testWeave.mine();
};

uploadMetadata();
