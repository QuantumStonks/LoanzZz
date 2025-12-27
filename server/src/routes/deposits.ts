/**
 * Deposit Routes
 * Handle XEC, USDT, and FIRMA deposits
 */

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { queryOne, queryAll, execute } from '../db/database.js';
import { convertUSDTtoFIRMA } from '../services/firmaBridge.js';
import { broadcastBalanceUpdate } from '../websocket/events.js';

const router = Router();

interface User {
    id: string;
    balance_xec: number;
    balance_firma: number;
    balance_xecx: number;
}

interface Transaction {
    id: string;
    user_id: string;
    type: string;
    asset: string;
    amount: number;
    value_usd: number | null;
    tx_hash: string | null;
    blockchain: string | null;
    status: string;
    created_at: string;
}

/**
 * POST /deposits/xec
 * PayButton callback for XEC deposits
 */
router.post('/xec', (req: Request, res: Response) => {
    try {
        const { userId, amount, txHash } = req.body;

        if (!userId || !amount) {
            return res.status(400).json({ error: 'userId and amount are required' });
        }

        const user = queryOne<User>('SELECT * FROM users WHERE id = ?', [userId]);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Credit XEC to user
        execute(
            `UPDATE users SET balance_xec = balance_xec + ?, updated_at = datetime('now') WHERE id = ?`,
            [amount, userId]
        );

        // Record transaction
        execute(
            `INSERT INTO transactions (id, user_id, type, asset, amount, tx_hash, blockchain, status)
             VALUES (?, ?, 'deposit_xec', 'XEC', ?, ?, 'ecash', 'confirmed')`,
            [uuidv4(), userId, amount, txHash || null]
        );

        // Get updated balance
        const updatedUser = queryOne<User>('SELECT * FROM users WHERE id = ?', [userId]);

        // Broadcast balance update
        broadcastBalanceUpdate(userId, {
            xec: updatedUser!.balance_xec,
            firma: updatedUser!.balance_firma,
            xecx: updatedUser!.balance_xecx
        });

        console.log(`💰 Deposited ${amount} XEC for user ${userId}`);

        res.json({
            success: true,
            newBalance: updatedUser!.balance_xec,
            transactionHash: txHash
        });
    } catch (error) {
        console.error('XEC deposit error:', error);
        res.status(500).json({ error: 'Deposit failed' });
    }
});

/**
 * POST /deposits/usdt-solana
 * Handle USDT deposit from Solana (triggers FIRMA swap)
 */
router.post('/usdt-solana', async (req: Request, res: Response) => {
    try {
        const { userId, amount, signature } = req.body;

        if (!userId || !amount) {
            return res.status(400).json({ error: 'userId and amount are required' });
        }

        const user = queryOne<User>('SELECT * FROM users WHERE id = ?', [userId]);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Convert USDT to FIRMA (1:1)
        const result = await convertUSDTtoFIRMA(userId, amount, signature);

        if (!result.success) {
            return res.status(500).json({ error: result.message });
        }

        res.json({
            success: true,
            usdtAmount: amount,
            firmaAmount: result.firmaAmount,
            transactionId: result.transactionId,
            message: result.message
        });
    } catch (error) {
        console.error('USDT deposit error:', error);
        res.status(500).json({ error: 'Deposit failed' });
    }
});

/**
 * POST /deposits/firma
 * Direct FIRMA deposit
 */
router.post('/firma', (req: Request, res: Response) => {
    try {
        const { userId, amount, txHash } = req.body;

        if (!userId || !amount) {
            return res.status(400).json({ error: 'userId and amount are required' });
        }

        const user = queryOne<User>('SELECT * FROM users WHERE id = ?', [userId]);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Credit FIRMA to user
        execute(
            `UPDATE users SET balance_firma = balance_firma + ?, updated_at = datetime('now') WHERE id = ?`,
            [amount, userId]
        );

        // Record transaction
        execute(
            `INSERT INTO transactions (id, user_id, type, asset, amount, value_usd, tx_hash, blockchain, status)
             VALUES (?, ?, 'deposit_firma', 'FIRMA', ?, ?, ?, 'ecash', 'confirmed')`,
            [uuidv4(), userId, amount, amount, txHash || null]
        );

        // Get updated balance
        const updatedUser = queryOne<User>('SELECT * FROM users WHERE id = ?', [userId]);

        // Broadcast balance update
        broadcastBalanceUpdate(userId, {
            xec: updatedUser!.balance_xec,
            firma: updatedUser!.balance_firma,
            xecx: updatedUser!.balance_xecx
        });

        res.json({
            success: true,
            newBalance: updatedUser!.balance_firma
        });
    } catch (error) {
        console.error('FIRMA deposit error:', error);
        res.status(500).json({ error: 'Deposit failed' });
    }
});

/**
 * GET /deposits/:userId
 * Get deposit history for a user
 */
router.get('/:userId', (req: Request, res: Response) => {
    try {
        const { userId } = req.params;
        const limit = parseInt(req.query.limit as string) || 20;

        const deposits = queryAll<Transaction>(
            `SELECT * FROM transactions 
             WHERE user_id = ? AND type LIKE 'deposit%'
             ORDER BY created_at DESC LIMIT ?`,
            [userId, limit]
        );

        res.json({
            deposits: deposits.map(d => ({
                id: d.id,
                type: d.type,
                asset: d.asset,
                amount: d.amount,
                valueUsd: d.value_usd,
                txHash: d.tx_hash,
                blockchain: d.blockchain,
                status: d.status,
                createdAt: d.created_at
            }))
        });
    } catch (error) {
        console.error('Get deposits error:', error);
        res.status(500).json({ error: 'Failed to get deposits' });
    }
});

/**
 * GET /deposits/address/:userId
 * Get deposit addresses for a user
 */
router.get('/address/:userId', (req: Request, res: Response) => {
    try {
        const { userId } = req.params;

        // In production, these would be unique deposit addresses
        // For now, return platform addresses
        res.json({
            ecash: process.env.PLATFORM_XEC_ADDRESS || 'ecash:qz...',
            solana: process.env.PLATFORM_SOLANA_USDT_ADDRESS || 'So...',
            instructions: {
                xec: 'Send XEC to the eCash address. It will be credited automatically.',
                usdt: 'Send USDT on Solana to the address. It will be automatically converted to USD balance.'
            }
        });
    } catch (error) {
        console.error('Get deposit address error:', error);
        res.status(500).json({ error: 'Failed to get deposit addresses' });
    }
});

export default router;
