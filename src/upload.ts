import Arweave from 'arweave';
import { JWKInterface } from 'arweave/node/lib/wallet';
import fs from 'fs';
import * as path from 'path';
import TestWeave from 'testweave-sdk';

import { getTransactionUri, uploadData } from './utils/arweave';

type UploadMetadataProps =
  | {
      testnet: true;
      mineAfterDone?: boolean;
    }
  | { testnet: false };

export const uploadMetadata = async (props: UploadMetadataProps) => {
  const arweave = Arweave.init({
    host: 'localhost',
    port: 1984,
    protocol: 'http',
    timeout: 20000,
    logging: false,
  });

  let testWeave: TestWeave | undefined = undefined;
  let jwk: JWKInterface | undefined = undefined;
  if (props.testnet) {
    testWeave = await TestWeave.init(arweave);
    jwk = testWeave.rootJWK;
  }

  if (!jwk) {
    throw new Error('No jwk found');
  }

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

  if (props.testnet && props.mineAfterDone && testWeave) {
    await testWeave.mine();
  }
};

uploadMetadata({ testnet: true });
