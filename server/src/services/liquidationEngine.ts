/**
 * Liquidation Engine
 * Programmatic margin calls and auto-liquidation
 */

import { v4 as uuidv4 } from 'uuid';
import { queryAll, execute, transaction } from '../db/database.js';
import { getPrice, toUSD } from './priceOracle.js';
import {
    Loan,
    calculateLTV,
    LIQUIDATION_LTV,
    MARGIN_CALL_LTV
} from './loanEngine.js';
import { broadcastLiquidation } from '../websocket/events.js';

const LIQUIDATION_FEE = parseFloat(process.env.LIQUIDATION_FEE || '0.02'); // 2%

interface LiquidationResult {
    loanId: string;
    userId: string;
    collateralSold: number;
    debtCovered: number;
    liquidationFee: number;
    collateralReturned: number;
}

/**
 * Scan all active loans and liquidate those above threshold
 */
export async function scanAndLiquidate(): Promise<LiquidationResult[]> {
    const results: LiquidationResult[] = [];

    const activeLoans = queryAll<Loan>(
        "SELECT * FROM loans WHERE status IN ('active', 'margin_call')"
    );

    for (const loan of activeLoans) {
        const currentLTV = await calculateLTV(
            loan.borrowed_type,
            loan.borrowed_amount,
            loan.accrued_interest,
            loan.collateral_type,
            loan.collateral_amount
        );

        if (currentLTV >= LIQUIDATION_LTV) {
            try {
                const result = await liquidateLoan(loan);
                results.push(result);
            } catch (error) {
                console.error(`Failed to liquidate loan ${loan.id}:`, error);
            }
        }
    }

    if (results.length > 0) {
        console.log(`⚡ Liquidated ${results.length} loans`);
    }

    return results;
}

/**
 * Liquidate a single loan
 */
async function liquidateLoan(loan: Loan): Promise<LiquidationResult> {
    const totalDebt = loan.borrowed_amount + loan.accrued_interest;
    const debtValueUSD = await toUSD(loan.borrowed_type, totalDebt);

    // Calculate how much collateral to sell (debt + fee)
    const liquidationFeeUSD = debtValueUSD * LIQUIDATION_FEE;
    const totalToRecoverUSD = debtValueUSD + liquidationFeeUSD;

    const collateralPrice = await getPrice(loan.collateral_type);
    const collateralToSell = Math.min(
        totalToRecoverUSD / collateralPrice,
        loan.collateral_amount
    );

    const collateralReturned = Math.max(0, loan.collateral_amount - collateralToSell);
    const liquidationFee = collateralToSell * LIQUIDATION_FEE / (1 + LIQUIDATION_FEE);

    transaction(() => {
        // Close the loan
        execute(
            `UPDATE loans SET 
                status = 'liquidated',
                collateral_amount = 0,
                borrowed_amount = 0,
                accrued_interest = 0,
                current_ltv = 0,
                closed_at = datetime('now'),
                updated_at = datetime('now')
             WHERE id = ?`,
            [loan.id]
        );

        // Return remaining collateral to user (if any)
        if (collateralReturned > 0) {
            const balanceColumn = `balance_${loan.collateral_type.toLowerCase()}`;
            execute(
                `UPDATE users SET ${balanceColumn} = ${balanceColumn} + ? WHERE id = ?`,
                [collateralReturned, loan.user_id]
            );
        }

        // Record liquidation transaction
        execute(
            `INSERT INTO transactions (
                id, user_id, loan_id, type, asset, amount, value_usd, status
            ) VALUES (?, ?, ?, 'liquidation', ?, ?, ?, 'confirmed')`,
            [
                uuidv4(),
                loan.user_id,
                loan.id,
                loan.collateral_type,
                collateralToSell,
                totalToRecoverUSD
            ]
        );
    });

    // Broadcast liquidation event
    broadcastLiquidation(loan.user_id, loan.id, {
        collateralSold: collateralToSell,
        debtCovered: totalDebt,
        fee: liquidationFee,
        returned: collateralReturned
    });

    console.log(`🔥 Liquidated loan ${loan.id}: sold ${collateralToSell.toFixed(2)} ${loan.collateral_type}`);

    return {
        loanId: loan.id,
        userId: loan.user_id,
        collateralSold: collateralToSell,
        debtCovered: totalDebt,
        liquidationFee: liquidationFee,
        collateralReturned
    };
}

/**
 * Get loans approaching liquidation
 */
export function getLoansAtRisk(): Loan[] {
    return queryAll<Loan>(
        `SELECT * FROM loans 
         WHERE status IN ('active', 'margin_call') 
         AND current_ltv >= ?
         ORDER BY current_ltv DESC`,
        [MARGIN_CALL_LTV]
    );
}

export { LIQUIDATION_FEE };
