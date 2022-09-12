import { Drip, DripVault, findVaultPubkey, Network, VaultAccount } from '@dcaf-labs/drip-sdk';
import { Address, AnchorProvider, BN } from '@project-serum/anchor';
import NodeWallet from '@project-serum/anchor/dist/cjs/nodewallet';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { Token, TOKEN_PROGRAM_ID } from '@solana/spl-token';

async function deposit(dripVault: DripVault): Promise<PublicKey> {
    const res = await dripVault.deposit({
        // units are base units
        amount: new BN(100),
        dripParams: {
            numberOfSwaps: 10
        }
    });
    console.log('position', res.metadata.position.toString());
    return res.metadata.position;
}

async function main() {
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
    // Given a tokenA, get valid tokenBs
    const tokenBs = await drip.querier.getAllTokenBs(tokenA);
    // For the example's sake, lets pick the first token available
    const tokenB = tokenBs[Object.keys(tokenBs)[0]].mint;
    console.log('tokeA', tokenA.toString(), 'tokenB', tokenB.toString());

    const vaultProtoConfigs = await drip.querier.getSupportedVaultProtoConfigsForPair(
        tokenA,
        tokenB
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
        tokenBMint: tokenB
    });
    console.log('vault', vaultPubkey.toString());

    const dripVault = await drip.getVault(vaultPubkey);
    const positionPubkey = await deposit(dripVault);

    const dripPosition = await drip.getPosition(positionPubkey);
    {
        const res = await dripPosition.withdrawB();
        console.log('withdraw txId', res.id);
    }
    {
        const res = await dripPosition.closePosition();
        console.log('close position txId', res.id);
    }
}

main();
