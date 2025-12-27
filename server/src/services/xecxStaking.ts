/**
 * XECX Staking Service
 * Platform-funded staking pool for collateral yield
 */

import { v4 as uuidv4 } from 'uuid';
import { queryOne, queryAll, execute, transaction } from '../db/database.js';
import { broadcastToUser } from '../websocket/events.js';

interface StakingPool {
    id: string;
    platform_base_xecx: number;
    user_contributed_xecx: number;
    total_xecx: number;
    last_reward_distribution: string | null;
    total_rewards_distributed: number;
}

interface User {
    id: string;
    balance_xec: number;
    balance_xecx: number;
    staking_rewards_earned: number;
}

interface Loan {
    id: string;
    user_id: string;
    collateral_type: string;
    collateral_amount: number;
    staking_yield_earned: number;
}

// XECX staking APY approximation (varies with XEC price)
const ESTIMATED_DAILY_YIELD_RATE = 0.0001; // ~3.65% APY

/**
 * Get current staking pool state
 */
export function getStakingPool(): StakingPool {
    const pool = queryOne<StakingPool>('SELECT * FROM staking_pool WHERE id = ?', ['main']);
    if (!pool) {
        // Initialize pool if not exists
        execute(
            `INSERT INTO staking_pool (id, platform_base_xecx, total_xecx) VALUES ('main', ?, ?)`,
            [50000, 50000]
        );
        return getStakingPool();
    }
    return pool;
}

/**
 * Add XEC collateral to staking pool (as XECX representation)
 */
export function addToStakingPool(userId: string, xecAmount: number): void {
    const xecxAmount = xecAmount; // 1 XEC = 1 XECX in representation

    execute(
        `UPDATE staking_pool SET 
            user_contributed_xecx = user_contributed_xecx + ?,
            total_xecx = total_xecx + ?,
            updated_at = datetime('now')
         WHERE id = 'main'`,
        [xecxAmount, xecxAmount]
    );

    console.log(`📈 Added ${xecxAmount} XEC to staking pool for user ${userId}`);
}

/**
 * Remove from staking pool (when collateral is withdrawn or liquidated)
 */
export function removeFromStakingPool(xecAmount: number): void {
    const xecxAmount = xecAmount;

    execute(
        `UPDATE staking_pool SET 
            user_contributed_xecx = MAX(0, user_contributed_xecx - ?),
            total_xecx = MAX(platform_base_xecx, total_xecx - ?),
            updated_at = datetime('now')
         WHERE id = 'main'`,
        [xecxAmount, xecxAmount]
    );
}

/**
 * Calculate user's share of staking rewards
 * Based on their XEC collateral proportion in active loans
 */
export function calculateUserStakingShare(userId: string): number {
    const pool = getStakingPool();
    if (pool.total_xecx === 0) return 0;

    // Sum all XEC collateral in user's active loans
    const userLoans = queryAll<Loan>(
        `SELECT * FROM loans 
         WHERE user_id = ? AND status IN ('active', 'margin_call') AND collateral_type = 'XEC'`,
        [userId]
    );

    const userXECCollateral = userLoans.reduce((sum, loan) => sum + loan.collateral_amount, 0);

    return userXECCollateral / pool.total_xecx;
}

/**
 * Distribute daily staking rewards
 * Called by cron job at midnight UTC
 */
export async function distributeStakingRewards(): Promise<{
    totalDistributed: number;
    recipientCount: number;
}> {
    const pool = getStakingPool();

    // Calculate daily reward based on total pool
    const dailyReward = pool.total_xecx * ESTIMATED_DAILY_YIELD_RATE;

    // Get all active loans with XEC collateral
    const xecLoans = queryAll<Loan>(
        `SELECT * FROM loans 
         WHERE status IN ('active', 'margin_call') AND collateral_type = 'XEC'`
    );

    if (xecLoans.length === 0) {
        console.log('📊 No active XEC loans to distribute staking rewards');
        return { totalDistributed: 0, recipientCount: 0 };
    }

    // Calculate total XEC collateral
    const totalUserCollateral = xecLoans.reduce((sum, loan) => sum + loan.collateral_amount, 0);

    let totalDistributed = 0;
    const userRewards: Map<string, number> = new Map();

    transaction(() => {
        for (const loan of xecLoans) {
            // Calculate proportional reward
            const share = loan.collateral_amount / totalUserCollateral;
            const reward = dailyReward * share;

            // Credit reward to loan's staking yield
            execute(
                `UPDATE loans SET staking_yield_earned = staking_yield_earned + ? WHERE id = ?`,
                [reward, loan.id]
            );

            // Track per-user rewards
            const currentReward = userRewards.get(loan.user_id) || 0;
            userRewards.set(loan.user_id, currentReward + reward);

            totalDistributed += reward;
        }

        // Update user staking rewards earned
        for (const [userId, reward] of userRewards) {
            execute(
                `UPDATE users SET staking_rewards_earned = staking_rewards_earned + ? WHERE id = ?`,
                [reward, userId]
            );

            // Record transaction
            execute(
                `INSERT INTO transactions (id, user_id, type, asset, amount, status)
                 VALUES (?, ?, 'staking_reward', 'XEC', ?, 'confirmed')`,
                [uuidv4(), userId, reward]
            );
        }

        // Update pool state
        execute(
            `UPDATE staking_pool SET 
                last_reward_distribution = datetime('now'),
                total_rewards_distributed = total_rewards_distributed + ?
             WHERE id = 'main'`,
            [totalDistributed]
        );
    });

    // Broadcast to users
    for (const [userId, reward] of userRewards) {
        broadcastToUser(userId, 'staking:reward', {
            amount: reward,
            message: `Earned ${reward.toFixed(2)} XEC from staking yield`
        });
    }

    console.log(`💰 Distributed ${totalDistributed.toFixed(2)} XEC staking rewards to ${userRewards.size} users`);

    return {
        totalDistributed,
        recipientCount: userRewards.size
    };
}

/**
 * Calculate effective interest rate after staking yield
 * Staking yield reduces the effective borrowing cost
 */
export function calculateEffectiveInterestRate(
    baseInterestRate: number,
    stakingYieldRate: number
): number {
    return Math.max(0, baseInterestRate - stakingYieldRate);
}

/**
 * Get staking pool statistics
 */
export function getStakingStats(): {
    totalPool: number;
    platformBase: number;
    userContributed: number;
    estimatedAPY: number;
    totalRewardsDistributed: number;
} {
    const pool = getStakingPool();

    return {
        totalPool: pool.total_xecx,
        platformBase: pool.platform_base_xecx,
        userContributed: pool.user_contributed_xecx,
        estimatedAPY: ESTIMATED_DAILY_YIELD_RATE * 365 * 100, // ~3.65%
        totalRewardsDistributed: pool.total_rewards_distributed
    };
}
