/**
 * Solana Service
 * USDT deposit detection on Solana for Phantom wallet users
 */

import { Connection, PublicKey, ParsedTransactionWithMeta } from '@solana/web3.js';
import { convertUSDTtoFIRMA } from './firmaBridge.js';

const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
const PLATFORM_USDT_ADDRESS = process.env.PLATFORM_SOLANA_USDT_ADDRESS || '';

// USDT on Solana (SPL Token)
const USDT_MINT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB';

let connection: Connection | null = null;
let watchInterval: NodeJS.Timeout | null = null;

// Track processed signatures to avoid duplicates
const processedSignatures: Set<string> = new Set();

// Map of Solana addresses to user IDs
const addressToUserId: Map<string, string> = new Map();

/**
 * Get Solana connection
 */
function getConnection(): Connection {
    if (!connection) {
        connection = new Connection(SOLANA_RPC_URL, 'confirmed');
        console.log('🌐 Connected to Solana RPC at', SOLANA_RPC_URL);
    }
    return connection;
}

/**
 * Register a user's Solana address for deposit watching
 */
export function registerSolanaAddress(userId: string, solanaAddress: string): void {
    addressToUserId.set(solanaAddress, userId);
    console.log(`👛 Registered Solana address ${solanaAddress} for user ${userId}`);
}

/**
 * Start watching for USDT deposits to platform address
 */
export function startWatchingDeposits(): void {
    if (!PLATFORM_USDT_ADDRESS) {
        console.warn('⚠️ PLATFORM_SOLANA_USDT_ADDRESS not configured, Solana deposits disabled');
        return;
    }

    console.log('👀 Starting Solana USDT deposit watcher...');

    // Check for new deposits every 10 seconds
    watchInterval = setInterval(async () => {
        try {
            await checkForDeposits();
        } catch (error) {
            console.error('Solana deposit check error:', error);
        }
    }, 10000);
}

/**
 * Stop watching for deposits
 */
export function stopWatchingDeposits(): void {
    if (watchInterval) {
        clearInterval(watchInterval);
        watchInterval = null;
    }
}

/**
 * Check for new USDT deposits
 */
async function checkForDeposits(): Promise<void> {
    if (!PLATFORM_USDT_ADDRESS) return;

    const conn = getConnection();

    try {
        const platformPubkey = new PublicKey(PLATFORM_USDT_ADDRESS);

        // Get recent signatures
        const signatures = await conn.getSignaturesForAddress(platformPubkey, { limit: 10 });

        for (const sig of signatures) {
            // Skip already processed
            if (processedSignatures.has(sig.signature)) continue;

            // Mark as processed
            processedSignatures.add(sig.signature);

            // Limit cache size
            if (processedSignatures.size > 1000) {
                const first = processedSignatures.values().next().value;
                if (first) processedSignatures.delete(first);
            }

            // Get transaction details
            const tx = await conn.getParsedTransaction(sig.signature, {
                maxSupportedTransactionVersion: 0
            });

            if (tx) {
                await processTransaction(tx, sig.signature);
            }
        }
    } catch (error) {
        console.error('Error checking Solana deposits:', error);
    }
}

/**
 * Process a transaction to detect USDT transfers
 */
async function processTransaction(
    tx: ParsedTransactionWithMeta,
    signature: string
): Promise<void> {
    if (!tx.meta || tx.meta.err) return;

    // Look for token transfers
    const preBalances = tx.meta.preTokenBalances || [];
    const postBalances = tx.meta.postTokenBalances || [];

    for (const post of postBalances) {
        // Check if this is USDT to our platform address
        if (post.mint !== USDT_MINT) continue;
        if (post.owner !== PLATFORM_USDT_ADDRESS) continue;

        // Find pre-balance to calculate delta
        const pre = preBalances.find(p =>
            p.accountIndex === post.accountIndex
        );

        const preAmount = parseFloat(pre?.uiTokenAmount?.uiAmountString || '0');
        const postAmount = parseFloat(post.uiTokenAmount?.uiAmountString || '0');
        const depositAmount = postAmount - preAmount;

        if (depositAmount > 0) {
            // Find the sender to determine which user this deposit is from
            const sender = findSender(tx);

            if (sender) {
                const userId = addressToUserId.get(sender);

                if (userId) {
                    console.log(`💵 Detected USDT deposit: ${depositAmount} from ${sender}`);

                    // Convert to FIRMA and credit user
                    await convertUSDTtoFIRMA(userId, depositAmount, signature);
                }
            }
        }
    }
}

/**
 * Find the sender address from a transaction
 */
function findSender(tx: ParsedTransactionWithMeta): string | null {
    // The first signer is typically the sender
    const message = tx.transaction.message;

    if ('accountKeys' in message) {
        const signers = message.accountKeys.filter((key: { signer: boolean }) => key.signer);
        if (signers.length > 0 && 'pubkey' in signers[0]) {
            return (signers[0] as { pubkey: PublicKey }).pubkey.toBase58();
        }
    }

    return null;
}

/**
 * Get USDT balance for a Solana address
 */
export async function getUSDTBalance(address: string): Promise<number> {
    try {
        const conn = getConnection();
        const pubkey = new PublicKey(address);
        const mintPubkey = new PublicKey(USDT_MINT);

        const tokenAccounts = await conn.getTokenAccountsByOwner(pubkey, {
            mint: mintPubkey
        });

        let totalBalance = 0;
        for (const account of tokenAccounts.value) {
            const balance = await conn.getTokenAccountBalance(account.pubkey);
            totalBalance += parseFloat(balance.value.uiAmountString || '0');
        }

        return totalBalance;
    } catch (error) {
        console.error(`Failed to get USDT balance for ${address}:`, error);
        return 0;
    }
}
