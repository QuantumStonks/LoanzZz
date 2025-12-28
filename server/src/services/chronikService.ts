/**
 * Chronik Service
 * eCash blockchain interaction via Chronik indexer
 */

import { ChronikClient } from 'chronik-client';
import { v4 as uuidv4 } from 'uuid';
import { execute, queryOne, queryAll } from '../db/database.js';
import { broadcastBalanceUpdate, broadcastEscrowTransaction } from '../websocket/events.js';

const CHRONIK_URL = process.env.CHRONIK_URL || 'https://chronik.e.cash';

let chronik: ChronikClient | null = null;

interface User {
    id: string;
    ecash_address: string;
    balance_xec: number;
    balance_firma: number;
    balance_xecx: number;
}

interface EscrowWallet {
    id: string;
    address: string;
    wallet_type: string;
    balance_xec: number;
    balance_firma: number;
}

/**
 * Get Chronik client instance
 */
export function getChronik(): ChronikClient {
    if (!chronik) {
        // ChronikClient expects an array of URLs for failover support
        chronik = new ChronikClient([CHRONIK_URL]);
        console.log('📡 Connected to Chronik at', CHRONIK_URL);
    }
    return chronik;
}

/**
 * Get XEC balance for an address using Chronik's address() method
 */
export async function getAddressBalance(address: string): Promise<number> {
    try {
        const client = getChronik();

        // Use the address() method which handles cash address format directly
        const scriptUtxos = await client.address(address).utxos();

        // Sum all UTXO values (in satoshis)
        // scriptUtxos is a single ScriptUtxos object with { outputScript, utxos[] }
        let totalSatoshis = BigInt(0);
        for (const utxo of scriptUtxos.utxos) {
            totalSatoshis += utxo.sats;
        }

        // Convert satoshis to XEC (1 XEC = 100 satoshis)
        const xecBalance = Number(totalSatoshis) / 100;
        console.log(`💰 Balance for ${address.slice(0, 20)}...: ${xecBalance.toLocaleString()} XEC (${scriptUtxos.utxos.length} UTXOs)`);
        return xecBalance;
    } catch (error) {
        console.error(`Failed to get balance for ${address}:`, error);
        return 0;
    }
}

/**
 * Get FIRMA token balance for an address
 */
export async function getFIRMABalance(address: string): Promise<number> {
    try {
        const client = getChronik();

        // FIRMA token ID
        const FIRMA_TOKEN_ID = '0387947fd575db4fb19a3e322f635dec37fd192b5941625b66bc4b2c3008cbf0';

        // Use the address() method which handles cash address format directly
        const scriptUtxos = await client.address(address).utxos();

        // Sum FIRMA token amounts
        let firmaBalance = BigInt(0);
        for (const utxo of scriptUtxos.utxos) {
            if (utxo.token?.tokenId === FIRMA_TOKEN_ID) {
                firmaBalance += utxo.token.atoms;
            }
        }

        return Number(firmaBalance);
    } catch (error) {
        console.error(`Failed to get FIRMA balance for ${address}:`, error);
        return 0;
    }
}

/**
 * Monitor an escrow wallet for new deposits
 */
export async function watchEscrowWallet(walletId: string): Promise<void> {
    const wallet = queryOne<EscrowWallet>(
        'SELECT * FROM escrow_wallets WHERE id = ?',
        [walletId]
    );

    if (!wallet) return;

    try {
        const xecBalance = await getAddressBalance(wallet.address);
        const firmaBalance = await getFIRMABalance(wallet.address);

        // Check if balance changed
        if (xecBalance !== wallet.balance_xec || firmaBalance !== wallet.balance_firma) {
            execute(
                `UPDATE escrow_wallets SET 
                    balance_xec = ?, 
                    balance_firma = ?,
                    updated_at = datetime('now')
                 WHERE id = ?`,
                [xecBalance, firmaBalance, walletId]
            );

            // Broadcast escrow update
            broadcastEscrowTransaction({
                id: uuidv4(),
                type: 'balance_update',
                asset: 'XEC',
                amount: xecBalance
            });

            console.log(`💰 Escrow ${walletId} balance updated: ${xecBalance} XEC, ${firmaBalance} FIRMA`);
        }
    } catch (error) {
        console.error(`Failed to watch escrow wallet ${walletId}:`, error);
    }
}

/**
 * Sync all escrow wallet balances
 */
export async function syncEscrowBalances(): Promise<void> {
    const wallets = queryAll<EscrowWallet>('SELECT * FROM escrow_wallets WHERE is_active = 1');

    for (const wallet of wallets) {
        await watchEscrowWallet(wallet.id);
    }
}

/**
 * Get transaction history for an address
 */
export async function getAddressHistory(
    address: string,
    limit: number = 10
): Promise<Array<{
    txid: string;
    timestamp: number;
    value: number;
    type: 'incoming' | 'outgoing';
}>> {
    try {
        const client = getChronik();
        const cleanAddress = address.replace('ecash:', '');

        const history = await (client as any).address(cleanAddress).history(0, limit);

        return history.txs.map((tx: any) => ({
            txid: tx.txid,
            timestamp: tx.timeFirstSeen,
            value: 0, // Would need to calculate from inputs/outputs
            type: 'incoming' as const // Would need to determine from address matching
        }));
    } catch (error) {
        console.error(`Failed to get history for ${address}:`, error);
        return [];
    }
}

/**
 * Wait for transaction confirmation
 */
export async function waitForConfirmation(txid: string, timeoutMs: number = 60000): Promise<boolean> {
    const client = getChronik();
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
        try {
            const tx = await client.tx(txid);
            if (tx.block) {
                return true; // Confirmed in a block
            }
        } catch {
            // Transaction not found yet
        }

        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 2000));
    }

    return false;
}

/**
 * Create a deposit address for a user (placeholder)
 * In production, this would generate a unique address for the user
 */
export function generateDepositAddress(userId: string): string {
    // Placeholder - in production use ecash-lib to derive addresses
    return `ecash:qz${userId.substring(0, 38)}`;
}

/**
 * Initialize the platform escrow wallet in DB with live balance from Chronik
 */
export async function initializeEscrowWallet(): Promise<void> {
    const platformAddress = process.env.PLATFORM_XEC_ADDRESS;

    if (!platformAddress) {
        console.warn('⚠️ PLATFORM_XEC_ADDRESS not configured, escrow initialization skipped');
        return;
    }

    try {
        // Check if escrow wallet already exists
        const existing = queryOne<EscrowWallet>(
            'SELECT * FROM escrow_wallets WHERE address = ?',
            [platformAddress]
        );

        if (!existing) {
            // Create new escrow wallet entry
            const walletId = uuidv4();
            execute(
                `INSERT INTO escrow_wallets (id, address, wallet_type, balance_xec, balance_firma, balance_xecx, is_active)
                 VALUES (?, ?, 'collateral', 0, 0, 0, 1)`,
                [walletId, platformAddress]
            );
            console.log(`📦 Created escrow wallet entry for ${platformAddress}`);
        }

        // Fetch live balance from Chronik
        console.log('📡 Fetching live escrow balance from Chronik...');
        const xecBalance = await getAddressBalance(platformAddress);
        const firmaBalance = await getFIRMABalance(platformAddress);

        // Update database with live balance
        execute(
            `UPDATE escrow_wallets SET 
                balance_xec = ?, 
                balance_firma = ?,
                updated_at = datetime('now')
             WHERE address = ?`,
            [xecBalance, firmaBalance, platformAddress]
        );

        console.log(`💰 Escrow wallet initialized: ${xecBalance.toLocaleString()} XEC, ${firmaBalance} FIRMA`);
    } catch (error) {
        console.error('Failed to initialize escrow wallet:', error);
    }
}
