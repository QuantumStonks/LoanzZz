import { useState, useEffect } from 'react';
import { useWalletStore, usePriceStore, useLoanStore, useUIStore } from '../stores';
import { calculateLoan, createLoan } from '../api/client';

export default function CreateLoanModal() {
    const { user } = useWalletStore();
    const { prices } = usePriceStore();
    const { addLoan } = useLoanStore();
    const { setCreateLoanModalOpen } = useUIStore();

    const [collateralType, setCollateralType] = useState<'XEC' | 'FIRMA'>('XEC');
    const [collateralAmount, setCollateralAmount] = useState('');
    const [borrowType, setBorrowType] = useState<'FIRMA' | 'XEC'>('FIRMA');
    const [borrowAmount, setBorrowAmount] = useState('');
    const [maxBorrow, setMaxBorrow] = useState(0);
    const [ltv, setLtv] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const userBalance = collateralType === 'XEC'
        ? user?.balances.xec || 0
        : user?.balances.firma || 0;

    // Calculate max borrow when collateral changes
    useEffect(() => {
        const calculate = async () => {
            const amount = parseFloat(collateralAmount) || 0;
            if (amount <= 0) {
                setMaxBorrow(0);
                setLtv(0);
                return;
            }

            try {
                const result = await calculateLoan(collateralType, amount, borrowType);
                setMaxBorrow(result.maxBorrow.amount);
            } catch {
                const collateralValue = amount * (prices[collateralType] || 0);
                const maxBorrowValue = collateralValue * 0.65;
                const borrowPrice = prices[borrowType] || 1;
                setMaxBorrow(maxBorrowValue / borrowPrice);
            }
        };

        calculate();
    }, [collateralAmount, collateralType, borrowType, prices]);

    // Calculate LTV when borrow amount changes
    useEffect(() => {
        const colAmount = parseFloat(collateralAmount) || 0;
        const borAmount = parseFloat(borrowAmount) || 0;

        if (colAmount <= 0) {
            setLtv(0);
            return;
        }

        const collateralValue = colAmount * (prices[collateralType] || 0);
        const borrowValue = borAmount * (prices[borrowType] || 1);

        setLtv(collateralValue > 0 ? (borrowValue / collateralValue) * 100 : 0);
    }, [collateralAmount, borrowAmount, collateralType, borrowType, prices]);

    const handleSubmit = async () => {
        if (!user) return;

        const colAmount = parseFloat(collateralAmount);
        const borAmount = parseFloat(borrowAmount);

        if (colAmount <= 0 || borAmount <= 0) {
            setError('Please enter valid amounts');
            return;
        }

        if (colAmount > userBalance) {
            setError(`Insufficient ${collateralType} balance`);
            return;
        }

        if (ltv > 65) {
            setError('LTV exceeds maximum 65%');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const result = await createLoan(
                user.id,
                collateralType,
                colAmount,
                borrowType,
                borAmount
            );

            if (result.success) {
                addLoan(result.loan);
                setCreateLoanModalOpen(false);
            }
        } catch (err: any) {
            setError(err.message || 'Failed to create loan');
        } finally {
            setIsLoading(false);
        }
    };

    const getLTVColor = () => {
        if (ltv >= 65) return 'var(--color-danger)';
        if (ltv >= 50) return 'var(--color-warning)';
        return 'var(--color-success)';
    };

    return (
        <div className="modal-overlay" onClick={() => setCreateLoanModalOpen(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
                <div className="modal-header">
                    <h3 className="modal-title">Create Loan</h3>
                    <button className="modal-close" onClick={() => setCreateLoanModalOpen(false)}>×</button>
                </div>

                <div className="modal-body">
                    {error && <div className="error-message mb-4">{error}</div>}

                    {/* Collateral Section */}
                    <div className="form-section">
                        <div className="section-header">
                            <label className="label">Collateral</label>
                            <span className="balance-hint">
                                Balance: {userBalance.toLocaleString()} {collateralType}
                            </span>
                        </div>

                        <div className="input-group">
                            <input
                                type="number"
                                className="input"
                                placeholder="Amount"
                                value={collateralAmount}
                                onChange={(e) => setCollateralAmount(e.target.value)}
                            />
                            <select
                                className="input asset-select"
                                value={collateralType}
                                onChange={(e) => setCollateralType(e.target.value as 'XEC' | 'FIRMA')}
                            >
                                <option value="XEC">XEC</option>
                                <option value="FIRMA">FIRMA (USD)</option>
                            </select>
                        </div>

                        <button
                            className="max-btn"
                            onClick={() => setCollateralAmount(userBalance.toString())}
                        >
                            MAX
                        </button>
                    </div>

                    {/* Borrow Section */}
                    <div className="form-section mt-6">
                        <div className="section-header">
                            <label className="label">Borrow</label>
                            <span className="balance-hint">
                                Max: {maxBorrow.toFixed(2)} {borrowType}
                            </span>
                        </div>

                        <div className="input-group">
                            <input
                                type="number"
                                className="input"
                                placeholder="Amount"
                                value={borrowAmount}
                                onChange={(e) => setBorrowAmount(e.target.value)}
                            />
                            <select
                                className="input asset-select"
                                value={borrowType}
                                onChange={(e) => setBorrowType(e.target.value as 'FIRMA' | 'XEC')}
                            >
                                <option value="FIRMA">FIRMA (USD)</option>
                                <option value="XEC">XEC</option>
                            </select>
                        </div>

                        <button
                            className="max-btn"
                            onClick={() => setBorrowAmount(maxBorrow.toFixed(4))}
                        >
                            MAX (65% LTV)
                        </button>
                    </div>

                    {/* LTV Display */}
                    <div className="ltv-display mt-6">
                        <div className="ltv-row">
                            <span>Loan-to-Value (LTV)</span>
                            <span style={{ color: getLTVColor(), fontWeight: 700 }}>
                                {ltv.toFixed(1)}%
                            </span>
                        </div>
                        <div className="ltv-bar">
                            <div
                                className="ltv-fill"
                                style={{
                                    width: `${Math.min(ltv, 100)}%`,
                                    background: getLTVColor()
                                }}
                            />
                            <div className="ltv-threshold" style={{ left: '65%' }} />
                        </div>
                        <div className="ltv-hints">
                            <span>0%</span>
                            <span className="text-success">Max 65%</span>
                            <span>100%</span>
                        </div>
                    </div>

                    {/* Info Box */}
                    <div className="info-box mt-6">
                        <div className="info-row">
                            <span>Interest Rate</span>
                            <span>0.01% / hour</span>
                        </div>
                        <div className="info-row">
                            <span>Margin Call</span>
                            <span>75% LTV</span>
                        </div>
                        <div className="info-row">
                            <span>Liquidation</span>
                            <span>83% LTV</span>
                        </div>
                        {collateralType === 'XEC' && (
                            <div className="info-row highlight">
                                <span>🌟 Staking Yield</span>
                                <span className="text-success">~3.65% APY</span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="modal-footer">
                    <button
                        className="btn btn-secondary"
                        onClick={() => setCreateLoanModalOpen(false)}
                    >
                        Cancel
                    </button>
                    <button
                        className="btn btn-primary"
                        onClick={handleSubmit}
                        disabled={isLoading || ltv > 65 || ltv === 0}
                    >
                        {isLoading ? 'Creating...' : 'Create Loan'}
                    </button>
                </div>
            </div>

            <style>{`
        .form-section {
          position: relative;
        }

        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: var(--space-2);
        }

        .balance-hint {
          font-size: var(--font-size-xs);
          color: var(--color-text-muted);
        }

        .input-group {
          display: flex;
          gap: var(--space-2);
        }

        .input-group .input:first-child {
          flex: 2;
        }

        .asset-select {
          flex: 1;
          cursor: pointer;
        }

        .max-btn {
          position: absolute;
          right: var(--space-2);
          top: 50%;
          background: rgba(0, 212, 170, 0.2);
          border: none;
          color: var(--color-accent-primary);
          font-size: var(--font-size-xs);
          padding: var(--space-1) var(--space-2);
          border-radius: var(--radius-sm);
          cursor: pointer;
          margin-top: var(--space-3);
        }

        .ltv-display {
          padding: var(--space-4);
          background: rgba(255, 255, 255, 0.03);
          border-radius: var(--radius-lg);
        }

        .ltv-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: var(--space-3);
        }

        .ltv-bar {
          position: relative;
          height: 8px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: var(--radius-full);
        }

        .ltv-fill {
          height: 100%;
          border-radius: var(--radius-full);
          transition: width 0.3s ease;
        }

        .ltv-threshold {
          position: absolute;
          top: -4px;
          bottom: -4px;
          width: 2px;
          background: var(--color-success);
        }

        .ltv-hints {
          display: flex;
          justify-content: space-between;
          margin-top: var(--space-2);
          font-size: var(--font-size-xs);
          color: var(--color-text-muted);
        }

        .info-box {
          padding: var(--space-4);
          background: rgba(255, 255, 255, 0.03);
          border-radius: var(--radius-lg);
        }

        .info-row {
          display: flex;
          justify-content: space-between;
          padding: var(--space-2) 0;
          font-size: var(--font-size-sm);
          color: var(--color-text-secondary);
        }

        .info-row.highlight {
          padding-top: var(--space-3);
          margin-top: var(--space-2);
          border-top: 1px solid rgba(255, 255, 255, 0.08);
        }

        .error-message {
          padding: var(--space-3) var(--space-4);
          background: rgba(255, 107, 107, 0.1);
          border: 1px solid rgba(255, 107, 107, 0.3);
          border-radius: var(--radius-md);
          color: var(--color-danger);
          font-size: var(--font-size-sm);
        }
      `}</style>
        </div>
    );
}
