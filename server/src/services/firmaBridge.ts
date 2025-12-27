/**
 * FIRMA Bridge Service
 * Automated USDT → FIRMA conversion (1:1)
 */

import { v4 as uuidv4 } from 'uuid';
import { execute, queryOne } from '../db/database.js';
import { broadcastBalanceUpdate } from '../websocket/events.js';

interface BridgeResult {
    success: boolean;
    firmaAmount: number;
    transactionId: string;
    message: string;
}

interface User {
    id: string;
    balance_xec: number;
    balance_firma: number;
    balance_xecx: number;
}

/**
 * Convert USDT to FIRMA (1:1 peg)
 * This is called when we detect a USDT deposit on Solana
 */
export async function convertUSDTtoFIRMA(
    userId: string,
    usdtAmount: number,
    solanaSignature?: string
): Promise<BridgeResult> {
    const transactionId = uuidv4();

    try {
        // FIRMA is 1:1 with USD
        const firmaAmount = usdtAmount;

        // In production, this would:
        // 1. Call firmaprotocol.com/bridge API
        // 2. Wait for confirmation
        // 3. Credit FIRMA on eCash chain

        // For now, we directly credit the user's FIRMA balance
        execute(
            `UPDATE users SET 
                balance_firma = balance_firma + ?,
                updated_at = datetime('now')
             WHERE id = ?`,
            [firmaAmount, userId]
        );

        // Record the swap transaction
        execute(
            `INSERT INTO transactions (
                id, user_id, type, asset, amount, value_usd, 
                tx_hash, blockchain, status
            ) VALUES (?, ?, 'firma_swap', 'FIRMA', ?, ?, ?, 'solana', 'confirmed')`,
            [transactionId, userId, firmaAmount, firmaAmount, solanaSignature || null]
        );

        // Get updated balance and broadcast
        const user = queryOne<User>('SELECT * FROM users WHERE id = ?', [userId]);
        if (user) {
            broadcastBalanceUpdate(userId, {
                xec: user.balance_xec,
                firma: user.balance_firma,
                xecx: user.balance_xecx
            });
        }

        console.log(`💱 Converted ${usdtAmount} USDT → ${firmaAmount} FIRMA for user ${userId}`);

        return {
            success: true,
            firmaAmount,
            transactionId,
            message: `Successfully converted ${usdtAmount} USDT to ${firmaAmount} FIRMA (USD)`
        };
    } catch (error) {
        console.error('FIRMA bridge error:', error);

        // Record failed transaction
        execute(
            `INSERT INTO transactions (
                id, user_id, type, asset, amount, status
            ) VALUES (?, ?, 'firma_swap', 'FIRMA', ?, 'failed')`,
            [transactionId, userId, usdtAmount]
        );

        return {
            success: false,
            firmaAmount: 0,
            transactionId,
            message: `Failed to convert USDT to FIRMA: ${error}`
        };
    }
}

/**
 * Convert FIRMA back to USDT (for withdrawals)
 */
export async function convertFIRMAtoUSDT(
    userId: string,
    firmaAmount: number
): Promise<{ success: boolean; usdtAmount: number; message: string }> {
    const user = queryOne<User>('SELECT * FROM users WHERE id = ?', [userId]);

    if (!user) {
        return { success: false, usdtAmount: 0, message: 'User not found' };
    }

    if (user.balance_firma < firmaAmount) {
        return { success: false, usdtAmount: 0, message: 'Insufficient FIRMA balance' };
    }

    // FIRMA is 1:1 with USD/USDT
    const usdtAmount = firmaAmount;

    // Deduct FIRMA
    execute(
        `UPDATE users SET balance_firma = balance_firma - ? WHERE id = ?`,
        [firmaAmount, userId]
    );

    // Record transaction
    execute(
        `INSERT INTO transactions (id, user_id, type, asset, amount, value_usd, status)
         VALUES (?, ?, 'withdraw_firma', 'FIRMA', ?, ?, 'pending')`,
        [uuidv4(), userId, firmaAmount, usdtAmount]
    );

    // In production: initiate USDT transfer on Solana

    return {
        success: true,
        usdtAmount,
        message: `Initiated withdrawal of ${usdtAmount} USDT`
    };
}

/**
 * Get bridge conversion rate (always 1:1 for FIRMA)
 */
export function getConversionRate(): { rate: number; fee: number } {
    return {
        rate: 1.0,
        fee: 0 // No fee for FIRMA conversion
    };
}
