import Arweave from 'arweave';
import Transaction from 'arweave/node/lib/transaction';
import { JWKInterface } from 'arweave/node/lib/wallet';
import cliProgress from 'cli-progress';
import colors from 'colors';

type UploadDataProps = {
  connection: Arweave;
  data: string | Uint8Array | ArrayBuffer;
  contentType: string;
  jwk?: JWKInterface | 'use_wallet';
  isChunked?: boolean;
};
export const uploadData = async ({
  connection,
  data,
  contentType,
  jwk,
  isChunked = false,
}: UploadDataProps): Promise<Transaction> => {
  const transaction = await connection.createTransaction({ data: data }, jwk);
  transaction.addTag('Content-Type', contentType);

  await connection.transactions.sign(transaction, jwk);
  if (isChunked) {
    const uploader = await connection.transactions.getUploader(transaction);
    const progressBar = new cliProgress.SingleBar({
      format:
        'Uploading |' +
        colors.cyan('{bar}') +
        '| {percentage}% || {value}/{total} Chunks',
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
      hideCursor: true,
    });

    progressBar.start(uploader.totalChunks, 0);

    while (!uploader.isComplete) {
      await uploader.uploadChunk();
      progressBar.update(uploader.uploadedChunks);
    }

    progressBar.stop();
  }
  await connection.transactions.post(transaction);
  return transaction;
};

type GetTransactionUri = {
  connection: Arweave;
  transaction: Transaction;
};
export const getTransactionUri = ({
  connection,
  transaction,
}: GetTransactionUri) => {
  const baseURL = connection.api.request().defaults.baseURL;
  return `${baseURL}/${transaction.id}`;
};
