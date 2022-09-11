import { Drip, DripVault, findVaultPubkey, Network, VaultAccount } from '@dcaf-labs/drip-sdk';
import { Address, AnchorProvider, BN } from '@project-serum/anchor';
import NodeWallet from '@project-serum/anchor/dist/cjs/nodewallet';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { Token, TOKEN_PROGRAM_ID } from '@solana/spl-token';

// export your wallet as such
// export EXAMPLE_WALLET="[92,116,...,245,129]"
const keypairData = process.env.EXAMPLE_WALLET;
const programID = Uint8Array.from(JSON.parse(keypairData));
const walletKeypair = Keypair.fromSecretKey(programID);
console.log('connected wallet', walletKeypair.publicKey.toString());

// Setup
const network = Network.DevnetStaging;
const provider = new AnchorProvider(
    new Connection('https://api.devnet.solana.com', 'confirmed'),
    new NodeWallet(walletKeypair),
    AnchorProvider.defaultOptions()
);
const drip = new Drip(network, provider);

// Devnet Drip USDT
const tokenA = new PublicKey('H9gBUJs5Kc5zyiKRTzZcYom4Hpj9VPHLy4VzExTVPgxa');

async function depositWithoutTokenMetadata(
    tokenA: Address,
    tokenB: Address,
    vault: Address,
    dripVault: DripVault
) {
    console.log('\n\n\nDeposit Without TokenMetadata');

    const res = await dripVault.deposit({
        // units are base units
        amount: new BN(100),
        dripParams: {
            numberOfSwaps: 10
        }
    });
    console.log('position', res.metadata.position.toString());
}

async function depositWithTokenMetadata(
    tokenA: Address,
    tokenB: Address,
    vault: Address,
    dripVault: DripVault
) {
    console.log('\n\n\nDeposit With TokenMetadata');

    const res = await dripVault.depositWithMetadata({
        // units are base units
        amount: new BN(100),
        dripParams: {
            numberOfSwaps: 10
        }
    });
    console.log('position', res.metadata.position.toString());
    console.log('positionMetadataAccount', res.metadata.positionMetadataAccount.toString());
}

async function depositWithoutReferrer(
    tokenA: Address,
    tokenB: Address,
    vault: Address,
    dripVault: DripVault
) {
    console.log('\n\n\nDeposit Without Referrer');

    const vaultAccount = (await drip.querier.fetchVaultAccounts(vault))[0];
    const referrer = undefined;
    const res = await dripVault.deposit({
        // units are base units
        amount: new BN(100),
        dripParams: {
            numberOfSwaps: 10
        }
    });
    console.log('position', res.metadata.position.toString());
    const position = await drip.querier.fetchVaultPositionAccounts(res.metadata.position);
    console.log(
        'referrer input',
        referrer,
        'vault treasury token account',
        vaultAccount.treasuryTokenBAccount.toString(),
        'position referrer',
        position[0].referrer.toString()
    );
}

async function depositWithReferrer(
    tokenA: Address,
    tokenB: Address,
    vault: Address,
    dripVault: DripVault
) {
    console.log('\n\n\nDeposit With Referrer');
    // referrerWallet can be any wallet, if none is provided it is the vault treasury
    const referrerWallet = walletKeypair.publicKey;
    //  Depending on the version of spl-token, creating the token account may look different
    const tokenBMint = new Token(
        provider.connection,
        new PublicKey(tokenB),
        TOKEN_PROGRAM_ID,
        walletKeypair
    );
    const referrer = await tokenBMint.createAccount(referrerWallet);
    const res = await dripVault.deposit({
        // units are base units
        amount: new BN(100),
        dripParams: {
            numberOfSwaps: 10
        },
        referrer: referrer
    });
    // TODO: We should return the user nft token account from deposit
    console.log('position', res.metadata.position.toString());
    const position = await drip.querier.fetchVaultPositionAccounts(res.metadata.position);
    console.log(
        'referrer input',
        referrer.toString(),
        'position referrer',
        position[0].referrer.toString()
    );
}

async function main() {
    // Given a tokenA, get valid tokenBs
    const tokenBs = await drip.querier.getAllTokenBs(tokenA);
    // For the example's sake, lets pick the first token available
    const tokenB = tokenBs[Object.keys(tokenBs)[0]];
    console.log('tokeA', tokenA.toString(), 'tokenB', tokenB.mint.toString());

    const vaultProtoConfigs = await drip.querier.getSupportedVaultProtoConfigsForPair(
        tokenA,
        tokenB.mint
    );
    // For the example's sake, lets pick the first proto config
    const vaultProtoConfig = vaultProtoConfigs[0];
    console.log(
        'vaultProtoConfig',
        vaultProtoConfig.pubkey.toString(),
        'granularity',
        vaultProtoConfig.granularity.toString()
    );

    const vaultPubkey = findVaultPubkey(drip.programId, {
        protoConfig: vaultProtoConfig.pubkey,
        tokenAMint: tokenA,
        tokenBMint: tokenB.mint
    });
    console.log('vault', vaultPubkey.toString());

    // TODO: DripVault should have a readonly refernce to the vault itself
    const dripVault = await drip.getVault(vaultPubkey);

    await depositWithReferrer(tokenA, tokenB.mint, vaultPubkey, dripVault);
    await depositWithoutReferrer(tokenA, tokenB.mint, vaultPubkey, dripVault);
    await depositWithTokenMetadata(tokenA, tokenB.mint, vaultPubkey, dripVault);
}

main();
