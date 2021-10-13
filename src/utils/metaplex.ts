import * as anchor from '@project-serum/anchor';
import * as splToken from '@solana/spl-token';
import * as web3 from '@solana/web3.js';

import { PROGRAMS } from '../metaplex/constants';

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function getCandyMachineProgram(
  walletKeyPair: web3.Keypair,
  environment?: web3.Cluster,
) {
  const solConnection = new anchor.web3.Connection(
    anchor.web3.clusterApiUrl(environment),
  );
  const walletWrapper = new anchor.Wallet(walletKeyPair);
  const provider = new anchor.Provider(solConnection, walletWrapper, {
    preflightCommitment: 'recent',
  });

  const idl = await anchor.Program.fetchIdl(PROGRAMS.CANDY_MACHINE, provider);
  if (!idl) {
    return;
  }

  const program = new anchor.Program(idl, PROGRAMS.CANDY_MACHINE, provider);
  const programId = program.programId.toBase58();
  console.log({ programIdFromAnchor: programId });
  return program;
}

export const CONFIG_ARRAY_START =
  32 + // authority
  4 +
  6 + // uuid + u32 len
  4 +
  10 + // u32 len + symbol
  2 + // seller fee basis points
  1 +
  4 +
  5 * 34 + // optional + u32 len + actual vec
  8 + //max supply
  1 + //is mutable
  1 + // retain authority
  4; // max number of lines;
export const CONFIG_LINE_SIZE = 4 + 32 + 4 + 200;

type ConfigData = {
  maxNumberOfLines: anchor.BN;
  symbol: string;
  sellerFeeBasisPoints: number;
  isMutable: boolean;
  maxSupply: anchor.BN;
  retainAuthority: boolean;
  creators: {
    address: web3.PublicKey;
    verified: boolean;
    share: number;
  }[];
};

export async function createConfigAccount(
  anchorProgram: anchor.Program,
  configData: ConfigData,
  payerWallet: web3.PublicKey,
  configAccount: web3.PublicKey,
) {
  const size =
    CONFIG_ARRAY_START +
    4 +
    configData.maxNumberOfLines.toNumber() * CONFIG_LINE_SIZE +
    4 +
    Math.ceil(configData.maxNumberOfLines.toNumber() / 8);

  return anchor.web3.SystemProgram.createAccount({
    fromPubkey: payerWallet,
    newAccountPubkey: configAccount,
    space: size,
    lamports:
      await anchorProgram.provider.connection.getMinimumBalanceForRentExemption(
        size,
      ),
    programId: PROGRAMS.CANDY_MACHINE,
  });
}

// FIXME: why not key itself?
export function uuidFromConfigPubkey(configAccount: web3.PublicKey) {
  return configAccount.toBase58().slice(0, 6);
}

export const createConfig = async function (
  anchorProgram: anchor.Program,
  payerWallet: web3.Keypair,
  configData: ConfigData,
) {
  const configAccount = web3.Keypair.generate();
  const uuid = uuidFromConfigPubkey(configAccount.publicKey);

  return {
    config: configAccount.publicKey,
    uuid,
    transactionId: await anchorProgram.rpc.initializeConfig(
      {
        uuid,
        ...configData,
      },
      {
        accounts: {
          config: configAccount.publicKey,
          authority: payerWallet.publicKey,
          payer: payerWallet.publicKey,
          systemProgram: web3.SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        },
        signers: [payerWallet, configAccount],
        instructions: [
          await createConfigAccount(
            anchorProgram,
            configData,
            payerWallet.publicKey,
            configAccount.publicKey,
          ),
        ],
      },
    ),
  };
};

export const getTokenWallet = async function (
  wallet: web3.PublicKey,
  mint: web3.PublicKey,
) {
  return (
    await web3.PublicKey.findProgramAddress(
      [wallet.toBuffer(), PROGRAMS.TOKEN.toBuffer(), mint.toBuffer()],
      PROGRAMS.SPL_ASSOCIATED_TOKEN_ACCOUNT,
    )
  )[0];
};

const createAssociatedTokenAccountInstruction = (
  associatedTokenAddress: anchor.web3.PublicKey,
  payer: anchor.web3.PublicKey,
  walletAddress: anchor.web3.PublicKey,
  splTokenMintAddress: anchor.web3.PublicKey,
) => {
  const keys = [
    { pubkey: payer, isSigner: true, isWritable: true },
    { pubkey: associatedTokenAddress, isSigner: false, isWritable: true },
    { pubkey: walletAddress, isSigner: false, isWritable: false },
    { pubkey: splTokenMintAddress, isSigner: false, isWritable: false },
    {
      pubkey: anchor.web3.SystemProgram.programId,
      isSigner: false,
      isWritable: false,
    },
    { pubkey: PROGRAMS.TOKEN, isSigner: false, isWritable: false },
    {
      pubkey: anchor.web3.SYSVAR_RENT_PUBKEY,
      isSigner: false,
      isWritable: false,
    },
  ];
  return new anchor.web3.TransactionInstruction({
    keys,
    programId: PROGRAMS.SPL_ASSOCIATED_TOKEN_ACCOUNT,
    data: Buffer.from([]),
  });
};

export const getMetadata = async (
  mint: anchor.web3.PublicKey,
): Promise<anchor.web3.PublicKey> => {
  return (
    await anchor.web3.PublicKey.findProgramAddress(
      [
        Buffer.from('metadata'),
        PROGRAMS.TOKEN_METADATA.toBuffer(),
        mint.toBuffer(),
      ],
      PROGRAMS.TOKEN_METADATA,
    )
  )[0];
};
const getMasterEdition = async (
  mint: anchor.web3.PublicKey,
): Promise<anchor.web3.PublicKey> => {
  return (
    await anchor.web3.PublicKey.findProgramAddress(
      [
        Buffer.from('metadata'),
        PROGRAMS.TOKEN_METADATA.toBuffer(),
        mint.toBuffer(),
        Buffer.from('edition'),
      ],
      PROGRAMS.TOKEN_METADATA,
    )
  )[0];
};

async function awaitTransactionSignatureConfirmation(
  txid: web3.TransactionSignature,
  timeout: number,
  connection: web3.Connection,
  commitment: web3.Commitment = 'recent',
  queryStatus = false,
): Promise<web3.SignatureStatus | null | void> {
  let done = false;
  let status: web3.SignatureStatus | null | void = {
    slot: 0,
    confirmations: 0,
    err: null,
  };
  let subId = 0;
  // eslint-disable-next-line no-async-promise-executor
  status = await new Promise(async (resolve, reject) => {
    setTimeout(() => {
      if (done) {
        return;
      }
      done = true;
      console.warn('Rejecting for timeout...');
      reject({ timeout: true });
    }, timeout);
    try {
      subId = connection.onSignature(
        txid,
        (result, context) => {
          done = true;
          status = {
            err: result.err,
            slot: context.slot,
            confirmations: 0,
          };
          if (result.err) {
            console.warn('Rejected via websocket', result.err);
            reject(status);
          } else {
            console.debug('Resolved via websocket', result);
            resolve(status);
          }
        },
        commitment,
      );
    } catch (e) {
      done = true;
      console.error('WS error in setup', txid, e);
    }
    while (!done && queryStatus) {
      (async () => {
        try {
          const signatureStatuses = await connection.getSignatureStatuses([
            txid,
          ]);
          status = signatureStatuses && signatureStatuses.value[0];
          if (!done) {
            if (!status) {
              console.debug('REST null result for', txid, status);
            } else if (status.err) {
              console.error('REST error for', txid, status);
              done = true;
              reject(status.err);
            } else if (!status.confirmations) {
              console.error('REST no confirmations for', txid, status);
            } else {
              console.debug('REST confirmation for', txid, status);
              done = true;
              resolve(status);
            }
          }
        } catch (e) {
          if (!done) {
            console.error('REST connection error: txid', txid, e);
          }
        }
      })();
      await sleep(2000);
    }
  });

  //@ts-ignore
  if (connection._signatureSubscriptions[subId])
    connection.removeSignatureListener(subId);
  done = true;
  console.debug('Returning status', status);
  return status;
}

// FIXME: damn
export async function mint(
  wallet: web3.Keypair,
  anchorProgram: anchor.Program,
  candyMachineAddress: web3.PublicKey,
  configAddress: web3.PublicKey,
): Promise<string> {
  const mint = web3.Keypair.generate();
  const userTokenAccountAddress = await getTokenWallet(
    wallet.publicKey,
    mint.publicKey,
  );

  const candyMachine: any = await anchorProgram.account.candyMachine.fetch(
    candyMachineAddress,
  );

  const remainingAccounts = [];
  const signers = [mint, wallet];
  const instructions = [
    anchor.web3.SystemProgram.createAccount({
      fromPubkey: wallet.publicKey,
      newAccountPubkey: mint.publicKey,
      space: splToken.MintLayout.span,
      lamports:
        await anchorProgram.provider.connection.getMinimumBalanceForRentExemption(
          splToken.MintLayout.span,
        ),
      programId: PROGRAMS.TOKEN,
    }),
    splToken.Token.createInitMintInstruction(
      PROGRAMS.TOKEN,
      mint.publicKey,
      0,
      wallet.publicKey,
      wallet.publicKey,
    ),
    createAssociatedTokenAccountInstruction(
      userTokenAccountAddress,
      wallet.publicKey,
      wallet.publicKey,
      mint.publicKey,
    ),
    splToken.Token.createMintToInstruction(
      PROGRAMS.TOKEN,
      mint.publicKey,
      userTokenAccountAddress,
      wallet.publicKey,
      [],
      1,
    ),
  ];

  let tokenAccount;
  if (candyMachine.tokenMint) {
    const transferAuthority = anchor.web3.Keypair.generate();

    tokenAccount = await getTokenWallet(
      wallet.publicKey,
      candyMachine.tokenMint,
    );

    remainingAccounts.push({
      pubkey: tokenAccount,
      isWritable: true,
      isSigner: false,
    });
    remainingAccounts.push({
      pubkey: wallet.publicKey,
      isWritable: false,
      isSigner: true,
    });

    instructions.push(
      splToken.Token.createApproveInstruction(
        PROGRAMS.TOKEN,
        tokenAccount,
        transferAuthority.publicKey,
        wallet.publicKey,
        [],
        candyMachine.data.price.toNumber(),
      ),
    );
  }
  const metadataAddress = await getMetadata(mint.publicKey);
  const masterEdition = await getMasterEdition(mint.publicKey);

  instructions.push(
    anchorProgram.instruction.mintNft({
      accounts: {
        config: configAddress,
        candyMachine: candyMachineAddress,
        payer: wallet.publicKey,
        wallet: candyMachine.wallet,
        mint: mint.publicKey,
        metadata: metadataAddress,
        masterEdition,
        mintAuthority: wallet.publicKey,
        updateAuthority: wallet.publicKey,
        tokenMetadataProgram: PROGRAMS.TOKEN_METADATA,
        tokenProgram: PROGRAMS.TOKEN,
        systemProgram: web3.SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
      },
      remainingAccounts,
    }),
  );

  if (tokenAccount) {
    instructions.push(
      splToken.Token.createRevokeInstruction(
        PROGRAMS.TOKEN,
        tokenAccount,
        wallet.publicKey,
        [],
      ),
    );
  }

  const transaction = new web3.Transaction();
  instructions.forEach((instruction) => transaction.add(instruction));
  transaction.recentBlockhash = (
    await anchorProgram.provider.connection.getRecentBlockhash('singleGossip')
  ).blockhash; // FIXME: wtf is that
  transaction.sign(...[wallet, ...signers]);

  const transactionId =
    await anchorProgram.provider.connection.sendRawTransaction(
      transaction.serialize(),
      {
        skipPreflight: true,
      },
    );

  const confirmation = await awaitTransactionSignatureConfirmation(
    transactionId,
    // timeout:
    15000,
    // connection:
    anchorProgram.provider.connection,
    'recent',
    true,
  );

  if (confirmation?.err) {
    throw new Error(`Failed to mint token: ${confirmation.err}`);
  }

  const confirmationSlot = confirmation?.slot || 0;
  console.log({ slot: confirmationSlot });

  return transactionId;
}

type GetAirdropProps = {
  connection: anchor.web3.Connection;
  wallet: web3.Keypair;
};
const getAirdrop = async ({ connection, wallet }: GetAirdropProps) => {
  const fromAirdropSignature = await connection.requestAirdrop(
    wallet.publicKey,
    web3.LAMPORTS_PER_SOL,
  );
  await connection.confirmTransaction(fromAirdropSignature);
};

type CreateCandyMachineProps = {
  manifest: Record<string, any>;
  manifestUri: string;
  environment: web3.Cluster;
  fromWallet: web3.Keypair;
};
export const createCandyMachine = async ({
  manifest,
  manifestUri,
  environment,
  fromWallet,
}: CreateCandyMachineProps) => {
  // Upload
  const program = await getCandyMachineProgram(fromWallet, environment);
  if (!program) {
    return;
  }
  const connection = program.provider.connection;

  if (environment && ['testnet', 'devnet'].includes(environment)) {
    await getAirdrop({ connection, wallet: fromWallet });
  }

  const {
    uuid,
    config,
    transactionId: initializeConfigTransactionId,
  } = await createConfig(program, fromWallet, {
    maxNumberOfLines: new anchor.BN(1),
    symbol: manifest.symbol,
    sellerFeeBasisPoints: manifest.seller_fee_basis_points,
    isMutable: true,
    maxSupply: new anchor.BN(0),
    retainAuthority: true,
    creators: manifest.properties.creators.map((creator: any) => {
      return {
        address: new web3.PublicKey(creator.address),
        verified: true,
        share: creator.share,
      };
    }),
  });
  console.log({ initializeConfigTransactionId });

  const candyMachineConfig = config.toBase58();
  console.log({ candyMachineConfig });

  const addConfigLinesTransactionId = await program.rpc.addConfigLines(
    0,
    [
      {
        uri: manifestUri,
        name: manifest.name,
      },
    ],
    {
      accounts: {
        config,
        authority: fromWallet.publicKey,
      },
      signers: [fromWallet],
    },
  );
  console.log({ addConfigLinesTransactionId });

  // Create Candy Machine
  const [candyMachine, bump] = await anchor.web3.PublicKey.findProgramAddress(
    [Buffer.from('candy_machine'), config.toBuffer(), Buffer.from(uuid)],
    PROGRAMS.CANDY_MACHINE,
  );

  const goLiveDate = Date.now() / 1000;
  const initializeCandyMachineTransactionId =
    await program.rpc.initializeCandyMachine(
      bump,
      {
        uuid,
        price: new anchor.BN(0.1),
        itemsAvailable: new anchor.BN(1),
        goLiveDate: new anchor.BN(goLiveDate),
      },
      {
        accounts: {
          candyMachine,
          wallet: fromWallet.publicKey,
          config: config,
          authority: fromWallet.publicKey,
          payer: fromWallet.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        },
        signers: [],
        remainingAccounts: [],
      },
    );
  console.log({ initializeCandyMachineTransactionId });

  const candyMachineAddress = candyMachine.toBase58();
  console.log({ candyMachineAddress });

  // Mint one
  const configAddress = new web3.PublicKey(candyMachineConfig);
  const mintOneTransactionId = await mint(
    fromWallet,
    program,
    candyMachine,
    configAddress,
  );
  console.log({ mintOneTransactionId });
};
