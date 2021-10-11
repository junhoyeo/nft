import * as splToken from '@solana/spl-token';
import * as web3 from '@solana/web3.js';

type CreateTokenProps = {
  connection: web3.Connection;
  payer: web3.Signer;
  mintAuthority: web3.PublicKey;
  freezeAuthority: web3.PublicKey | null;
  decimals: number;
  programId: web3.PublicKey;
};
export const createToken = (props: CreateTokenProps) =>
  splToken.Token.createMint(
    props.connection,
    props.payer,
    props.mintAuthority,
    props.freezeAuthority,
    props.decimals,
    props.programId,
  );

export const createNFT = (props: Omit<CreateTokenProps, 'decimals'>) =>
  createToken({ ...props, decimals: 0 });
