import * as web3 from '@solana/web3.js';

export const PROGRAMS = {
  CANDY_MACHINE: new web3.PublicKey(
    'cndyAnrLdpjq1Ssp1z8xxDsB8dxe7u4HL5Nxi2K5WXZ',
  ),
  TOKEN: new web3.PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
  TOKEN_METADATA: new web3.PublicKey(
    'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s',
  ),
  SPL_ASSOCIATED_TOKEN_ACCOUNT: new web3.PublicKey(
    'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL',
  ),
};
