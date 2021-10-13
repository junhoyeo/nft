import * as anchor from '@project-serum/anchor';
import * as splToken from '@solana/spl-token';
import * as web3 from '@solana/web3.js';

import { createNFT } from './token';

export const CANDY_MACHINE_PROGRAM_ID = new web3.PublicKey(
  'cndyAnrLdpjq1Ssp1z8xxDsB8dxe7u4HL5Nxi2K5WXZ',
);

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

  const idl = await anchor.Program.fetchIdl(CANDY_MACHINE_PROGRAM_ID, provider);
  if (!idl) {
    return;
  }

  const program = new anchor.Program(idl, CANDY_MACHINE_PROGRAM_ID, provider);
  const programId = program.programId.toBase58();
  console.log({ programIdFromAnchor: programId });
  return program;
}

type CreateCandyMachineProps = {
  environment?: web3.Cluster;
};
export const createCandyMachine = async ({
  environment,
}: CreateCandyMachineProps) => {
  const fromWallet = web3.Keypair.generate();
  const toWallet = web3.Keypair.generate();

  const program = await getCandyMachineProgram(fromWallet, environment);
  if (!program) {
    return;
  }

  const connection = program.provider.connection;

  const fromAirdropSignature = await connection.requestAirdrop(
    fromWallet.publicKey,
    web3.LAMPORTS_PER_SOL,
  );
  await connection.confirmTransaction(fromAirdropSignature);

  // Create new NFT
  const token = await createNFT({
    connection,
    payer: fromWallet,
    mintAuthority: fromWallet.publicKey,
    freezeAuthority: null,
    programId: splToken.TOKEN_PROGRAM_ID,
  });
  console.log({ tokenMintInfo: await token.getMintInfo() });

  const fromTokenAccount = await token.getOrCreateAssociatedAccountInfo(
    fromWallet.publicKey,
  );
  const toTokenAccount = await token.getOrCreateAssociatedAccountInfo(
    toWallet.publicKey,
  );

  // Minting 1 new token to the "fromTokenAccount" account we just returned/created
  await token.mintTo(fromTokenAccount.address, fromWallet.publicKey, [], 1);

  // Disable future minting to fix total suppy
  await token.setAuthority(
    token.publicKey,
    null,
    'MintTokens',
    fromWallet.publicKey,
    [],
  );

  // Add token transfer instructions to transaction
  const transaction = new web3.Transaction().add(
    splToken.Token.createTransferInstruction(
      splToken.TOKEN_PROGRAM_ID,
      fromTokenAccount.address,
      toTokenAccount.address,
      fromWallet.publicKey,
      [],
      1,
    ),
  );

  // Sign transaction, broadcast, and confirm
  const signature = await web3.sendAndConfirmTransaction(
    connection,
    transaction,
    [fromWallet],
    { commitment: 'confirmed' },
  );
  console.log('SIGNATURE', signature);
};
