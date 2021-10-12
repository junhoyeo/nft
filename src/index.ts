import Arweave from 'arweave';
import fs from 'fs';
import * as path from 'path';
import TestWeave from 'testweave-sdk';

import { getTransactionUri, uploadData } from './utils/arweave';

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

  await testWeave.mine();

  const imageUri = getTransactionUri({
    connection: arweave,
    transaction: imageTransaction,
  });
  console.log({ imageUri });
};

uploadMetadata();
