/**
 * Escrow Routes
 * Public escrow transparency view
 */

import { Router, Request, Response } from 'express';
import { queryOne, queryAll } from '../db/database.js';
import { getStakingStats } from '../services/xecxStaking.js';
import { getAllPrices } from '../services/priceOracle.js';

const router = Router();

interface EscrowWallet {
    id: string;
    address: string;
    wallet_type: string;
    balance_xec: number;
    balance_firma: number;
    balance_xecx: number;
    updated_at: string;
}

interface Transaction {
    id: string;
    user_id: string;
    type: string;
    asset: string;
    amount: number;
    value_usd: number | null;
    tx_hash: string | null;
    status: string;
    created_at: string;
}

interface LoanStats {
    total_loans: number;
    active_loans: number;
    total_collateral_xec: number;
    total_collateral_firma: number;
    total_borrowed_xec: number;
    total_borrowed_firma: number;
}

/**
 * GET /escrow/summary
 * Get overall escrow summary
 */
router.get('/summary', (_req: Request, res: Response) => {
    try {
        // Get loan statistics
        const loanStats = queryOne<LoanStats>(`
            SELECT 
                COUNT(*) as total_loans,
                SUM(CASE WHEN status IN ('active', 'margin_call') THEN 1 ELSE 0 END) as active_loans,
                SUM(CASE WHEN collateral_type = 'XEC' AND status IN ('active', 'margin_call') THEN collateral_amount ELSE 0 END) as total_collateral_xec,
                SUM(CASE WHEN collateral_type = 'FIRMA' AND status IN ('active', 'margin_call') THEN collateral_amount ELSE 0 END) as total_collateral_firma,
                SUM(CASE WHEN borrowed_type = 'XEC' AND status IN ('active', 'margin_call') THEN borrowed_amount ELSE 0 END) as total_borrowed_xec,
                SUM(CASE WHEN borrowed_type = 'FIRMA' AND status IN ('active', 'margin_call') THEN borrowed_amount ELSE 0 END) as total_borrowed_firma
            FROM loans
        `);

        const stakingStats = getStakingStats();
        const prices = getAllPrices();

        // Calculate total values
        const totalCollateralUSD =
            (loanStats?.total_collateral_xec || 0) * prices.XEC +
            (loanStats?.total_collateral_firma || 0) * prices.FIRMA;

        const totalBorrowedUSD =
            (loanStats?.total_borrowed_xec || 0) * prices.XEC +
            (loanStats?.total_borrowed_firma || 0) * prices.FIRMA;

        res.json({
            loans: {
                total: loanStats?.total_loans || 0,
                active: loanStats?.active_loans || 0
            },
            collateral: {
                xec: loanStats?.total_collateral_xec || 0,
                firma: loanStats?.total_collateral_firma || 0,
                totalUsd: totalCollateralUSD
            },
            borrowed: {
                xec: loanStats?.total_borrowed_xec || 0,
                firma: loanStats?.total_borrowed_firma || 0,
                totalUsd: totalBorrowedUSD
            },
            staking: stakingStats,
            prices,
            healthRatio: totalCollateralUSD > 0
                ? ((totalCollateralUSD - totalBorrowedUSD) / totalCollateralUSD * 100).toFixed(2)
                : 100,
            updatedAt: new Date().toISOString()
        });
    } catch (error) {
        console.error('Get escrow summary error:', error);
        res.status(500).json({ error: 'Failed to get escrow summary' });
    }
});

/**
 * GET /escrow/wallets
 * Get all escrow wallet addresses and balances
 */
router.get('/wallets', (_req: Request, res: Response) => {
    try {
        const wallets = queryAll<EscrowWallet>(
            'SELECT * FROM escrow_wallets WHERE is_active = 1 ORDER BY wallet_type'
        );

        // If no wallets exist, return platform address
        if (wallets.length === 0) {
            const platformAddress = process.env.PLATFORM_XEC_ADDRESS || 'ecash:qz...';

            return res.json({
                wallets: [{
                    id: 'platform',
                    address: platformAddress,
                    type: 'collateral',
                    balances: {
                        xec: 0,
                        firma: 0,
                        xecx: 0
                    },
                    explorerUrl: `https://explorer.e.cash/address/${platformAddress.replace('ecash:', '')}`,
                    updatedAt: new Date().toISOString()
                }]
            });
        }

        res.json({
            wallets: wallets.map(w => ({
                id: w.id,
                address: w.address,
                type: w.wallet_type,
                balances: {
                    xec: w.balance_xec,
                    firma: w.balance_firma,
                    xecx: w.balance_xecx
                },
                explorerUrl: `https://explorer.e.cash/address/${w.address.replace('ecash:', '')}`,
                updatedAt: w.updated_at
            }))
        });
    } catch (error) {
        console.error('Get escrow wallets error:', error);
        res.status(500).json({ error: 'Failed to get escrow wallets' });
    }
});

/**
 * GET /escrow/transactions
 * Get recent escrow-related transactions
 */
router.get('/transactions', (req: Request, res: Response) => {
    try {
        const limit = parseInt(req.query.limit as string) || 50;

        // Get recent significant transactions
        const transactions = queryAll<Transaction>(`
            SELECT * FROM transactions 
            WHERE type IN ('deposit_xec', 'deposit_firma', 'borrow', 'repay', 'liquidation', 'add_collateral')
            ORDER BY created_at DESC 
            LIMIT ?
        `, [limit]);

        res.json({
            transactions: transactions.map(tx => ({
                id: tx.id,
                type: tx.type,
                asset: tx.asset,
                amount: tx.amount,
                valueUsd: tx.value_usd,
                txHash: tx.tx_hash,
                status: tx.status,
                timestamp: tx.created_at,
                explorerUrl: tx.tx_hash
                    ? `https://explorer.e.cash/tx/${tx.tx_hash}`
                    : null
            }))
        });
    } catch (error) {
        console.error('Get escrow transactions error:', error);
        res.status(500).json({ error: 'Failed to get transactions' });
    }
});

/**
 * GET /escrow/liquidations
 * Get recent liquidation events
 */
router.get('/liquidations', (req: Request, res: Response) => {
    try {
        const limit = parseInt(req.query.limit as string) || 20;

        const liquidations = queryAll<Transaction>(
            `SELECT * FROM transactions 
             WHERE type = 'liquidation'
             ORDER BY created_at DESC 
             LIMIT ?`,
            [limit]
        );

        res.json({
            liquidations: liquidations.map(tx => ({
                id: tx.id,
                asset: tx.asset,
                amount: tx.amount,
                valueUsd: tx.value_usd,
                timestamp: tx.created_at
            })),
            total: liquidations.length
        });
    } catch (error) {
        console.error('Get liquidations error:', error);
        res.status(500).json({ error: 'Failed to get liquidations' });
    }
});

export default router;
