import Arweave from 'arweave';
import { JWKInterface } from 'arweave/node/lib/wallet';
import fs from 'fs';
import * as path from 'path';
import TestWeave from 'testweave-sdk';

import { getTransactionUri, uploadData } from './utils/arweave';

const API_CONFIG = {
  MAINNET: {
    host: 'arweave.net',
    port: 443,
    protocol: 'https',
    timeout: 20000,
    logging: false,
  },
  TESTNET: {
    host: 'localhost',
    port: 1984,
    protocol: 'http',
    timeout: 20000,
    logging: false,
  },
};
type UploadMetadataProps =
  | {
      testnet: true;
      mineAfterDone?: boolean;
    }
  | {
      testnet: false;
      key: JWKInterface;
    };

export const uploadMetadata = async (props: UploadMetadataProps) => {
  const arweave = Arweave.init(
    props.testnet ? API_CONFIG.TESTNET : API_CONFIG.MAINNET,
  );

  let testWeave: TestWeave | undefined = undefined;
  let jwk: JWKInterface | undefined = undefined;
  if (props.testnet) {
    testWeave = await TestWeave.init(arweave);
    jwk = testWeave.rootJWK;
  } else {
    jwk = props.key;
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

/*
const jtk = JSON.parse(
  fs
    .readFileSync(path.resolve(__dirname, '../assets/arweave-key.json'))
    .toString(),
);
uploadMetadata({ testnet: false, key: jtk });
*/
uploadMetadata({ testnet: true, mineAfterDone: true });
