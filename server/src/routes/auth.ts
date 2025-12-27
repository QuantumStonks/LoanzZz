/**
 * Authentication Routes
 * Wallet-based auth (sign message to prove ownership)
 */

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { queryOne, execute } from '../db/database.js';
import { registerSolanaAddress } from '../services/solanaService.js';

const router = Router();

interface User {
    id: string;
    ecash_address: string | null;
    solana_address: string | null;
    balance_xec: number;
    balance_firma: number;
    balance_xecx: number;
    staking_rewards_earned: number;
    created_at: string;
}

/**
 * POST /auth/ecash
 * Authenticate with eCash address
 */
router.post('/ecash', (req: Request, res: Response) => {
    try {
        const { address, signature, message } = req.body;

        if (!address) {
            return res.status(400).json({ error: 'Address is required' });
        }

        // In production: verify signature against message
        // For now, we trust the address

        // Find or create user
        let user = queryOne<User>(
            'SELECT * FROM users WHERE ecash_address = ?',
            [address]
        );

        if (!user) {
            const userId = uuidv4();
            execute(
                `INSERT INTO users (id, ecash_address) VALUES (?, ?)`,
                [userId, address]
            );
            user = queryOne<User>('SELECT * FROM users WHERE id = ?', [userId]);
        }

        res.json({
            success: true,
            user: {
                id: user!.id,
                ecashAddress: user!.ecash_address,
                solanaAddress: user!.solana_address,
                balances: {
                    xec: user!.balance_xec,
                    firma: user!.balance_firma,
                    xecx: user!.balance_xecx
                },
                stakingRewardsEarned: user!.staking_rewards_earned
            }
        });
    } catch (error) {
        console.error('Auth error:', error);
        res.status(500).json({ error: 'Authentication failed' });
    }
});

/**
 * POST /auth/solana
 * Authenticate with Solana address (Phantom wallet)
 */
router.post('/solana', (req: Request, res: Response) => {
    try {
        const { address, signature, message } = req.body;

        if (!address) {
            return res.status(400).json({ error: 'Address is required' });
        }

        // In production: verify signature against message

        // Find or create user
        let user = queryOne<User>(
            'SELECT * FROM users WHERE solana_address = ?',
            [address]
        );

        if (!user) {
            const userId = uuidv4();
            execute(
                `INSERT INTO users (id, solana_address) VALUES (?, ?)`,
                [userId, address]
            );
            user = queryOne<User>('SELECT * FROM users WHERE id = ?', [userId]);

            // Register for deposit watching
            registerSolanaAddress(userId, address);
        }

        res.json({
            success: true,
            user: {
                id: user!.id,
                ecashAddress: user!.ecash_address,
                solanaAddress: user!.solana_address,
                balances: {
                    xec: user!.balance_xec,
                    firma: user!.balance_firma,
                    xecx: user!.balance_xecx
                },
                stakingRewardsEarned: user!.staking_rewards_earned
            }
        });
    } catch (error) {
        console.error('Auth error:', error);
        res.status(500).json({ error: 'Authentication failed' });
    }
});

/**
 * POST /auth/link
 * Link additional wallet to existing user
 */
router.post('/link', (req: Request, res: Response) => {
    try {
        const { userId, walletType, address } = req.body;

        if (!userId || !walletType || !address) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const user = queryOne<User>('SELECT * FROM users WHERE id = ?', [userId]);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (walletType === 'ecash') {
            execute(
                'UPDATE users SET ecash_address = ? WHERE id = ?',
                [address, userId]
            );
        } else if (walletType === 'solana') {
            execute(
                'UPDATE users SET solana_address = ? WHERE id = ?',
                [address, userId]
            );
            registerSolanaAddress(userId, address);
        }

        const updatedUser = queryOne<User>('SELECT * FROM users WHERE id = ?', [userId]);

        res.json({
            success: true,
            user: {
                id: updatedUser!.id,
                ecashAddress: updatedUser!.ecash_address,
                solanaAddress: updatedUser!.solana_address
            }
        });
    } catch (error) {
        console.error('Link wallet error:', error);
        res.status(500).json({ error: 'Failed to link wallet' });
    }
});

/**
 * GET /auth/user/:id
 * Get user profile and balances
 */
router.get('/user/:id', (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const user = queryOne<User>('SELECT * FROM users WHERE id = ?', [id]);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({
            id: user.id,
            ecashAddress: user.ecash_address,
            solanaAddress: user.solana_address,
            balances: {
                xec: user.balance_xec,
                firma: user.balance_firma,
                xecx: user.balance_xecx
            },
            stakingRewardsEarned: user.staking_rewards_earned,
            createdAt: user.created_at
        });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Failed to get user' });
    }
});

export default router;
