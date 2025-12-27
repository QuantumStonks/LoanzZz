/**
 * Loan Engine Service
 * Core lending logic: LTV calculation, interest accrual, margin detection
 */

import { v4 as uuidv4 } from 'uuid';
import { queryOne, queryAll, execute, transaction } from '../db/database.js';
import { getPrice, toUSD } from './priceOracle.js';
import { broadcastToUser, broadcastLTVUpdate, broadcastMarginCall } from '../websocket/events.js';

// LTV Thresholds (from environment or defaults)
const INITIAL_LTV = parseFloat(process.env.INITIAL_LTV || '65');
const MARGIN_CALL_LTV = parseFloat(process.env.MARGIN_CALL_LTV || '75');
const LIQUIDATION_LTV = parseFloat(process.env.LIQUIDATION_LTV || '83');
const HOURLY_INTEREST_RATE = parseFloat(process.env.HOURLY_INTEREST_RATE || '0.0001');

export interface Loan {
    id: string;
    user_id: string;
    status: 'active' | 'repaid' | 'liquidated' | 'margin_call';
    collateral_type: string;
    collateral_amount: number;
    collateral_value_usd: number;
    borrowed_type: string;
    borrowed_amount: number;
    borrowed_value_usd: number;
    interest_rate: number;
    accrued_interest: number;
    initial_ltv: number;
    current_ltv: number;
    staking_yield_earned: number;
    escrow_wallet_id: string | null;
    created_at: string;
    updated_at: string;
}

export interface CreateLoanParams {
    userId: string;
    collateralType: string;
    collateralAmount: number;
    borrowedType: string;
    borrowedAmount: number;
}

/**
 * Calculate LTV ratio
 * LTV = (Loan Value + Accrued Interest) / Collateral Value * 100
 */
export async function calculateLTV(
    borrowedType: string,
    borrowedAmount: number,
    accruedInterest: number,
    collateralType: string,
    collateralAmount: number
): Promise<number> {
    const borrowedValue = await toUSD(borrowedType, borrowedAmount + accruedInterest);
    const collateralValue = await toUSD(collateralType, collateralAmount);

    if (collateralValue === 0) return 100;
    return (borrowedValue / collateralValue) * 100;
}

/**
 * Calculate maximum borrow amount based on collateral
 */
export async function calculateMaxBorrow(
    collateralType: string,
    collateralAmount: number,
    borrowType: string
): Promise<number> {
    const collateralValueUSD = await toUSD(collateralType, collateralAmount);
    const maxBorrowUSD = collateralValueUSD * (INITIAL_LTV / 100);

    const borrowPrice = await getPrice(borrowType);
    if (borrowPrice === 0) return 0;

    return maxBorrowUSD / borrowPrice;
}

/**
 * Create a new loan
 */
export async function createLoan(params: CreateLoanParams): Promise<Loan> {
    const { userId, collateralType, collateralAmount, borrowedType, borrowedAmount } = params;

    // Calculate values
    const collateralValueUSD = await toUSD(collateralType, collateralAmount);
    const borrowedValueUSD = await toUSD(borrowedType, borrowedAmount);

    // Check LTV is within limits
    const ltv = (borrowedValueUSD / collateralValueUSD) * 100;
    if (ltv > INITIAL_LTV) {
        throw new Error(`LTV ${ltv.toFixed(2)}% exceeds maximum ${INITIAL_LTV}%`);
    }

    const loanId = uuidv4();

    transaction(() => {
        // Create loan
        execute(
            `INSERT INTO loans (
                id, user_id, status, 
                collateral_type, collateral_amount, collateral_value_usd,
                borrowed_type, borrowed_amount, borrowed_value_usd,
                interest_rate, accrued_interest,
                initial_ltv, current_ltv
            ) VALUES (?, ?, 'active', ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
            [
                loanId, userId,
                collateralType, collateralAmount, collateralValueUSD,
                borrowedType, borrowedAmount, borrowedValueUSD,
                HOURLY_INTEREST_RATE, ltv, ltv
            ]
        );

        // Deduct collateral from user balance
        const balanceColumn = `balance_${collateralType.toLowerCase()}`;
        execute(
            `UPDATE users SET ${balanceColumn} = ${balanceColumn} - ?, updated_at = datetime('now') 
             WHERE id = ?`,
            [collateralAmount, userId]
        );

        // Credit borrowed amount to user
        const borrowColumn = `balance_${borrowedType.toLowerCase()}`;
        execute(
            `UPDATE users SET ${borrowColumn} = ${borrowColumn} + ?, updated_at = datetime('now') 
             WHERE id = ?`,
            [borrowedAmount, userId]
        );

        // Record transaction
        execute(
            `INSERT INTO transactions (id, user_id, loan_id, type, asset, amount, value_usd, status)
             VALUES (?, ?, ?, 'borrow', ?, ?, ?, 'confirmed')`,
            [uuidv4(), userId, loanId, borrowedType, borrowedAmount, borrowedValueUSD]
        );
    });

    return getLoan(loanId)!;
}

/**
 * Get loan by ID
 */
export function getLoan(loanId: string): Loan | undefined {
    return queryOne<Loan>('SELECT * FROM loans WHERE id = ?', [loanId]);
}

/**
 * Get all active loans for a user
 */
export function getUserLoans(userId: string): Loan[] {
    return queryAll<Loan>(
        'SELECT * FROM loans WHERE user_id = ? ORDER BY created_at DESC',
        [userId]
    );
}

/**
 * Get all active loans (for liquidation scanning)
 */
export function getActiveLoans(): Loan[] {
    return queryAll<Loan>("SELECT * FROM loans WHERE status = 'active'");
}

/**
 * Accrue interest on a loan
 */
export async function accrueInterest(loan: Loan): Promise<void> {
    const hoursElapsed = getHoursElapsed(loan.updated_at);
    if (hoursElapsed < 1) return;

    const interestAmount = loan.borrowed_amount * loan.interest_rate * Math.floor(hoursElapsed);
    const newAccruedInterest = loan.accrued_interest + interestAmount;

    // Recalculate LTV
    const newLTV = await calculateLTV(
        loan.borrowed_type,
        loan.borrowed_amount,
        newAccruedInterest,
        loan.collateral_type,
        loan.collateral_amount
    );

    execute(
        `UPDATE loans SET 
            accrued_interest = ?,
            current_ltv = ?,
            last_interest_update = datetime('now'),
            updated_at = datetime('now')
         WHERE id = ?`,
        [newAccruedInterest, newLTV, loan.id]
    );

    // Broadcast LTV update
    broadcastLTVUpdate(loan.user_id, loan.id, newLTV);

    // Check for margin call
    if (newLTV >= MARGIN_CALL_LTV && newLTV < LIQUIDATION_LTV) {
        await triggerMarginCall(loan, newLTV);
    }
}

/**
 * Update LTV for all active loans (call when prices change)
 */
export async function updateAllLTVs(): Promise<void> {
    const activeLoans = getActiveLoans();

    for (const loan of activeLoans) {
        const newLTV = await calculateLTV(
            loan.borrowed_type,
            loan.borrowed_amount,
            loan.accrued_interest,
            loan.collateral_type,
            loan.collateral_amount
        );

        const oldStatus = loan.status;
        let newStatus = loan.status;

        if (newLTV >= LIQUIDATION_LTV) {
            // Will be handled by liquidation engine
        } else if (newLTV >= MARGIN_CALL_LTV) {
            newStatus = 'margin_call';
        } else if (oldStatus === 'margin_call') {
            newStatus = 'active';
        }

        execute(
            `UPDATE loans SET current_ltv = ?, status = ?, updated_at = datetime('now') WHERE id = ?`,
            [newLTV, newStatus, loan.id]
        );

        broadcastLTVUpdate(loan.user_id, loan.id, newLTV);

        if (newStatus === 'margin_call' && oldStatus !== 'margin_call') {
            await triggerMarginCall(loan, newLTV);
        }
    }
}

/**
 * Trigger margin call alert
 */
async function triggerMarginCall(loan: Loan, ltv: number): Promise<void> {
    execute(
        `INSERT INTO margin_calls (id, loan_id, ltv_at_alert, alert_type)
         VALUES (?, ?, ?, ?)`,
        [uuidv4(), loan.id, ltv, ltv >= 80 ? 'critical' : 'warning']
    );

    execute(
        `UPDATE loans SET status = 'margin_call', updated_at = datetime('now') WHERE id = ?`,
        [loan.id]
    );

    broadcastMarginCall(loan.user_id, loan.id, ltv);
}

/**
 * Repay loan (partial or full)
 */
export async function repayLoan(
    loanId: string,
    repayAmount: number,
    userId: string
): Promise<{ remainingDebt: number; isFullyRepaid: boolean }> {
    const loan = getLoan(loanId);
    if (!loan) throw new Error('Loan not found');
    if (loan.user_id !== userId) throw new Error('Unauthorized');
    if (loan.status === 'liquidated' || loan.status === 'repaid') {
        throw new Error('Loan is already closed');
    }

    const totalDebt = loan.borrowed_amount + loan.accrued_interest;
    const actualRepay = Math.min(repayAmount, totalDebt);
    const remainingDebt = totalDebt - actualRepay;
    const isFullyRepaid = remainingDebt <= 0;

    transaction(() => {
        // Deduct from user balance
        const balanceColumn = `balance_${loan.borrowed_type.toLowerCase()}`;
        execute(
            `UPDATE users SET ${balanceColumn} = ${balanceColumn} - ? WHERE id = ?`,
            [actualRepay, userId]
        );

        if (isFullyRepaid) {
            // Return collateral
            const collateralColumn = `balance_${loan.collateral_type.toLowerCase()}`;
            execute(
                `UPDATE users SET ${collateralColumn} = ${collateralColumn} + ? WHERE id = ?`,
                [loan.collateral_amount, userId]
            );

            // Close loan
            execute(
                `UPDATE loans SET 
                    status = 'repaid', 
                    borrowed_amount = 0, 
                    accrued_interest = 0,
                    current_ltv = 0,
                    closed_at = datetime('now'),
                    updated_at = datetime('now')
                 WHERE id = ?`,
                [loanId]
            );
        } else {
            // Partial repayment - reduce interest first, then principal
            let remaining = actualRepay;
            let newInterest = loan.accrued_interest;
            let newPrincipal = loan.borrowed_amount;

            if (remaining >= loan.accrued_interest) {
                remaining -= loan.accrued_interest;
                newInterest = 0;
                newPrincipal -= remaining;
            } else {
                newInterest -= remaining;
            }

            execute(
                `UPDATE loans SET 
                    borrowed_amount = ?,
                    accrued_interest = ?,
                    updated_at = datetime('now')
                 WHERE id = ?`,
                [newPrincipal, newInterest, loanId]
            );
        }

        // Record transaction
        execute(
            `INSERT INTO transactions (id, user_id, loan_id, type, asset, amount, status)
             VALUES (?, ?, ?, 'repay', ?, ?, 'confirmed')`,
            [uuidv4(), userId, loanId, loan.borrowed_type, actualRepay]
        );
    });

    return { remainingDebt, isFullyRepaid };
}

/**
 * Add collateral to loan
 */
export async function addCollateral(
    loanId: string,
    amount: number,
    userId: string
): Promise<Loan> {
    const loan = getLoan(loanId);
    if (!loan) throw new Error('Loan not found');
    if (loan.user_id !== userId) throw new Error('Unauthorized');
    if (loan.status === 'liquidated' || loan.status === 'repaid') {
        throw new Error('Loan is already closed');
    }

    const newCollateralAmount = loan.collateral_amount + amount;
    const newCollateralValue = await toUSD(loan.collateral_type, newCollateralAmount);
    const newLTV = await calculateLTV(
        loan.borrowed_type,
        loan.borrowed_amount,
        loan.accrued_interest,
        loan.collateral_type,
        newCollateralAmount
    );

    transaction(() => {
        // Deduct from user balance
        const balanceColumn = `balance_${loan.collateral_type.toLowerCase()}`;
        execute(
            `UPDATE users SET ${balanceColumn} = ${balanceColumn} - ? WHERE id = ?`,
            [amount, userId]
        );

        // Update loan
        const newStatus = newLTV < MARGIN_CALL_LTV ? 'active' : loan.status;
        execute(
            `UPDATE loans SET 
                collateral_amount = ?,
                collateral_value_usd = ?,
                current_ltv = ?,
                status = ?,
                updated_at = datetime('now')
             WHERE id = ?`,
            [newCollateralAmount, newCollateralValue, newLTV, newStatus, loanId]
        );

        // Record transaction
        execute(
            `INSERT INTO transactions (id, user_id, loan_id, type, asset, amount, status)
             VALUES (?, ?, ?, 'add_collateral', ?, ?, 'confirmed')`,
            [uuidv4(), userId, loanId, loan.collateral_type, amount]
        );
    });

    broadcastLTVUpdate(userId, loanId, newLTV);

    return getLoan(loanId)!;
}

// Helper function
function getHoursElapsed(dateString: string): number {
    const then = new Date(dateString).getTime();
    const now = Date.now();
    return (now - then) / (1000 * 60 * 60);
}

export { INITIAL_LTV, MARGIN_CALL_LTV, LIQUIDATION_LTV, HOURLY_INTEREST_RATE };
