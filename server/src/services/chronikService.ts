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
        chronik = new ChronikClient(CHRONIK_URL);
        console.log('📡 Connected to Chronik at', CHRONIK_URL);
    }
    return chronik;
}

/**
 * Get XEC balance for an address
 */
export async function getAddressBalance(address: string): Promise<number> {
    try {
        const client = getChronik();

        // Remove ecash: prefix if present
        const cleanAddress = address.replace('ecash:', '');

        const utxos = await (client as any).address(cleanAddress).utxos();

        // Sum all UTXO values (in satoshis)
        let totalSatoshis = 0;
        for (const utxo of utxos.utxos) {
            totalSatoshis += parseInt(utxo.value);
        }

        // Convert satoshis to XEC (1 XEC = 100 satoshis)
        return totalSatoshis / 100;
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
        const cleanAddress = address.replace('ecash:', '');

        // FIRMA token ID
        const FIRMA_TOKEN_ID = '0387947fd575db4fb19a3e322f635dec37fd192b5941625b66bc4b2c3008cbf0';

        const utxos = await (client as any).address(cleanAddress).utxos();

        let firmaBalance = 0;
        for (const utxo of utxos.utxos) {
            if (utxo.token?.tokenId === FIRMA_TOKEN_ID) {
                firmaBalance += parseInt(utxo.token.amount);
            }
        }

        return firmaBalance;
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
