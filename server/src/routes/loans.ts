/**
 * Loan Routes
 * Create, manage, and repay loans
 */

import { Router, Request, Response } from 'express';
import {
    createLoan,
    getLoan,
    getUserLoans,
    repayLoan,
    addCollateral,
    calculateMaxBorrow,
    calculateLTV,
    INITIAL_LTV,
    MARGIN_CALL_LTV,
    LIQUIDATION_LTV,
    HOURLY_INTEREST_RATE
} from '../services/loanEngine.js';
import { getPrice, toUSD } from '../services/priceOracle.js';
import { addToStakingPool, calculateUserStakingShare, getStakingStats } from '../services/xecxStaking.js';
import { queryOne, queryAll } from '../db/database.js';

const router = Router();

/**
 * GET /loans/config
 * Get loan configuration (LTV thresholds, interest rates)
 */
router.get('/config', (_req: Request, res: Response) => {
    res.json({
        initialLTV: INITIAL_LTV,
        marginCallLTV: MARGIN_CALL_LTV,
        liquidationLTV: LIQUIDATION_LTV,
        hourlyInterestRate: HOURLY_INTEREST_RATE,
        supportedCollateral: ['XEC', 'FIRMA'],
        supportedBorrow: ['XEC', 'FIRMA'],
        stakingStats: getStakingStats()
    });
});

/**
 * POST /loans/calculate
 * Calculate loan terms before creating
 */
router.post('/calculate', async (req: Request, res: Response) => {
    try {
        const { collateralType, collateralAmount, borrowType } = req.body;

        if (!collateralType || !collateralAmount || !borrowType) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const maxBorrow = await calculateMaxBorrow(collateralType, collateralAmount, borrowType);
        const collateralValueUSD = await toUSD(collateralType, collateralAmount);
        const borrowPrice = await getPrice(borrowType);

        res.json({
            collateral: {
                type: collateralType,
                amount: collateralAmount,
                valueUsd: collateralValueUSD
            },
            maxBorrow: {
                type: borrowType,
                amount: maxBorrow,
                valueUsd: collateralValueUSD * (INITIAL_LTV / 100)
            },
            maxLTV: INITIAL_LTV,
            hourlyInterestRate: HOURLY_INTEREST_RATE,
            dailyInterestRate: HOURLY_INTEREST_RATE * 24,
            prices: {
                [collateralType]: await getPrice(collateralType),
                [borrowType]: borrowPrice
            }
        });
    } catch (error) {
        console.error('Calculate loan error:', error);
        res.status(500).json({ error: 'Calculation failed' });
    }
});

/**
 * POST /loans
 * Create a new loan
 */
router.post('/', async (req: Request, res: Response) => {
    try {
        const { userId, collateralType, collateralAmount, borrowedType, borrowedAmount } = req.body;

        if (!userId || !collateralType || !collateralAmount || !borrowedType || !borrowedAmount) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Verify user has sufficient balance
        const user = queryOne<{ balance_xec: number; balance_firma: number }>(
            'SELECT * FROM users WHERE id = ?',
            [userId]
        );

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const balanceColumn = collateralType === 'XEC' ? 'balance_xec' : 'balance_firma';
        const userBalance = collateralType === 'XEC' ? user.balance_xec : user.balance_firma;

        if (userBalance < collateralAmount) {
            return res.status(400).json({
                error: `Insufficient ${collateralType} balance. Have: ${userBalance}, Need: ${collateralAmount}`
            });
        }

        // Create the loan
        const loan = await createLoan({
            userId,
            collateralType,
            collateralAmount,
            borrowedType,
            borrowedAmount
        });

        // Add XEC collateral to staking pool
        if (collateralType === 'XEC') {
            addToStakingPool(userId, collateralAmount);
        }

        res.status(201).json({
            success: true,
            loan: {
                id: loan.id,
                status: loan.status,
                collateral: {
                    type: loan.collateral_type,
                    amount: loan.collateral_amount,
                    valueUsd: loan.collateral_value_usd
                },
                borrowed: {
                    type: loan.borrowed_type,
                    amount: loan.borrowed_amount,
                    valueUsd: loan.borrowed_value_usd
                },
                ltv: loan.current_ltv,
                interestRate: loan.interest_rate,
                createdAt: loan.created_at
            }
        });
    } catch (error: any) {
        console.error('Create loan error:', error);
        res.status(400).json({ error: error.message || 'Failed to create loan' });
    }
});

/**
 * GET /loans/user/:userId
 * Get all loans for a user
 */
router.get('/user/:userId', (req: Request, res: Response) => {
    try {
        const { userId } = req.params;
        const loans = getUserLoans(userId);

        const stakingShare = calculateUserStakingShare(userId);

        res.json({
            loans: loans.map(loan => ({
                id: loan.id,
                status: loan.status,
                collateral: {
                    type: loan.collateral_type,
                    amount: loan.collateral_amount,
                    valueUsd: loan.collateral_value_usd
                },
                borrowed: {
                    type: loan.borrowed_type,
                    amount: loan.borrowed_amount,
                    valueUsd: loan.borrowed_value_usd
                },
                accruedInterest: loan.accrued_interest,
                totalDebt: loan.borrowed_amount + loan.accrued_interest,
                ltv: loan.current_ltv,
                stakingYieldEarned: loan.staking_yield_earned,
                createdAt: loan.created_at
            })),
            stakingShare,
            summary: {
                totalCollateralUsd: loans.reduce((sum, l) => sum + l.collateral_value_usd, 0),
                totalBorrowedUsd: loans.reduce((sum, l) => sum + l.borrowed_value_usd, 0),
                activeLoans: loans.filter(l => l.status === 'active' || l.status === 'margin_call').length
            }
        });
    } catch (error) {
        console.error('Get loans error:', error);
        res.status(500).json({ error: 'Failed to get loans' });
    }
});

/**
 * GET /loans/:id
 * Get a specific loan
 */
router.get('/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const loan = getLoan(id);

        if (!loan) {
            return res.status(404).json({ error: 'Loan not found' });
        }

        // Calculate current LTV with latest prices
        const currentLTV = await calculateLTV(
            loan.borrowed_type,
            loan.borrowed_amount,
            loan.accrued_interest,
            loan.collateral_type,
            loan.collateral_amount
        );

        res.json({
            id: loan.id,
            status: loan.status,
            collateral: {
                type: loan.collateral_type,
                amount: loan.collateral_amount,
                valueUsd: loan.collateral_value_usd,
                currentValueUsd: await toUSD(loan.collateral_type, loan.collateral_amount)
            },
            borrowed: {
                type: loan.borrowed_type,
                amount: loan.borrowed_amount,
                valueUsd: loan.borrowed_value_usd
            },
            interest: {
                rate: loan.interest_rate,
                accrued: loan.accrued_interest,
                totalDebt: loan.borrowed_amount + loan.accrued_interest
            },
            ltv: {
                initial: loan.initial_ltv,
                current: currentLTV,
                marginCall: MARGIN_CALL_LTV,
                liquidation: LIQUIDATION_LTV
            },
            stakingYieldEarned: loan.staking_yield_earned,
            createdAt: loan.created_at,
            updatedAt: loan.updated_at
        });
    } catch (error) {
        console.error('Get loan error:', error);
        res.status(500).json({ error: 'Failed to get loan' });
    }
});

/**
 * POST /loans/:id/repay
 * Repay loan (partial or full)
 */
router.post('/:id/repay', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { userId, amount } = req.body;

        if (!userId || !amount) {
            return res.status(400).json({ error: 'userId and amount are required' });
        }

        const result = await repayLoan(id, amount, userId);

        res.json({
            success: true,
            remainingDebt: result.remainingDebt,
            isFullyRepaid: result.isFullyRepaid,
            message: result.isFullyRepaid
                ? 'Loan fully repaid! Collateral returned to your balance.'
                : `Partial repayment successful. Remaining debt: ${result.remainingDebt.toFixed(2)}`
        });
    } catch (error: any) {
        console.error('Repay loan error:', error);
        res.status(400).json({ error: error.message || 'Repayment failed' });
    }
});

/**
 * POST /loans/:id/add-collateral
 * Add more collateral to reduce LTV
 */
router.post('/:id/add-collateral', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { userId, amount } = req.body;

        if (!userId || !amount) {
            return res.status(400).json({ error: 'userId and amount are required' });
        }

        const loan = await addCollateral(id, amount, userId);

        // Add to staking pool if XEC
        if (loan.collateral_type === 'XEC') {
            addToStakingPool(userId, amount);
        }

        res.json({
            success: true,
            newCollateralAmount: loan.collateral_amount,
            newLTV: loan.current_ltv,
            message: `Added ${amount} ${loan.collateral_type}. New LTV: ${loan.current_ltv.toFixed(2)}%`
        });
    } catch (error: any) {
        console.error('Add collateral error:', error);
        res.status(400).json({ error: error.message || 'Failed to add collateral' });
    }
});

export default router;
