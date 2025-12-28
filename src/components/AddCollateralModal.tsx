import { useState } from 'react';
import { useWalletStore, useLoanStore, usePriceStore } from '../stores';
import { addCollateral } from '../api/client';
import type { Loan } from '../api/client';

interface AddCollateralModalProps {
    loan: Loan;
    onClose: () => void;
}

export default function AddCollateralModal({ loan, onClose }: AddCollateralModalProps) {
    const { user } = useWalletStore();
    const { updateLoan } = useLoanStore();
    const { prices } = usePriceStore();
    const [amount, setAmount] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const collateralType = loan.collateral.type;
    const userBalance = collateralType === 'XEC'
        ? user?.balances.xec || 0
        : user?.balances.firma || 0;

    const currentCollateralValue = loan.collateral.amount * (prices[collateralType as keyof typeof prices] || 0);
    const totalDebt = loan.borrowed.amount + loan.accruedInterest;

    // Calculate new LTV if user adds the entered amount
    const getNewLTV = () => {
        const addAmount = parseFloat(amount) || 0;
        const newCollateralAmount = loan.collateral.amount + addAmount;
        const newCollateralValue = newCollateralAmount * (prices[collateralType as keyof typeof prices] || 0);
        return newCollateralValue > 0 ? (totalDebt / newCollateralValue) * 100 : 0;
    };

    const handleAddCollateral = async () => {
        if (!user || !amount) return;

        const addAmount = parseFloat(amount);
        if (addAmount <= 0) {
            setError('Please enter a valid amount');
            return;
        }

        if (addAmount > userBalance) {
            setError(`Insufficient ${collateralType} balance`);
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const result = await addCollateral(loan.id, user.id, addAmount);

            if (result.success) {
                setSuccess(`Added ${addAmount} ${collateralType}. New LTV: ${result.newLTV.toFixed(1)}%`);
                updateLoan(loan.id, {
                    collateral: {
                        ...loan.collateral,
                        amount: loan.collateral.amount + addAmount
                    },
                    ltv: result.newLTV
                });
                setAmount('');
                setTimeout(onClose, 1500);
            }
        } catch (err: any) {
            setError(err.message || 'Failed to add collateral');
        } finally {
            setIsLoading(false);
        }
    };

    const setMaxAmount = () => {
        setAmount(userBalance.toString());
    };

    const newLTV = getNewLTV();
    const ltvImprovement = loan.ltv - newLTV;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '420px' }}>
                <div className="modal-header">
                    <h3 className="modal-title">Add Collateral</h3>
                    <button className="modal-close" onClick={onClose}>×</button>
                </div>

                <div className="modal-body">
                    {error && <div className="error-message mb-4">{error}</div>}
                    {success && <div className="success-message mb-4">{success}</div>}

                    <div className="loan-info mb-6">
                        <div className="info-row">
                            <span>Loan ID</span>
                            <span className="mono">#{loan.id.slice(0, 8)}</span>
                        </div>
                        <div className="info-row">
                            <span>Current Collateral</span>
                            <span>{loan.collateral.amount.toLocaleString()} {collateralType}</span>
                        </div>
                        <div className="info-row">
                            <span>Collateral Value</span>
                            <span>${currentCollateralValue.toFixed(2)}</span>
                        </div>
                        <div className="info-row">
                            <span>Current LTV</span>
                            <span className={loan.ltv >= 75 ? 'text-warning' : loan.ltv >= 65 ? 'text-muted' : 'text-success'}>
                                {loan.ltv.toFixed(1)}%
                            </span>
                        </div>
                        <div className="info-row">
                            <span>Your Balance</span>
                            <span>{userBalance.toLocaleString()} {collateralType}</span>
                        </div>
                    </div>

                    <div className="form-section">
                        <div className="section-header">
                            <label className="label">Add Amount</label>
                            <button className="max-btn" onClick={setMaxAmount}>MAX</button>
                        </div>
                        <div className="input-with-suffix">
                            <input
                                type="number"
                                className="input"
                                placeholder="0.00"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                max={userBalance}
                            />
                            <span className="input-suffix">{collateralType}</span>
                        </div>
                    </div>

                    {/* LTV Preview */}
                    {parseFloat(amount) > 0 && (
                        <div className="ltv-preview mt-4">
                            <div className="preview-row">
                                <span>New LTV</span>
                                <span className={newLTV >= 75 ? 'text-warning' : 'text-success'}>
                                    {newLTV.toFixed(1)}%
                                </span>
                            </div>
                            <div className="preview-row improvement">
                                <span>Improvement</span>
                                <span className="text-success">-{ltvImprovement.toFixed(1)}%</span>
                            </div>
                        </div>
                    )}
                </div>

                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
                    <button
                        className="btn btn-primary"
                        onClick={handleAddCollateral}
                        disabled={isLoading || !amount || parseFloat(amount) <= 0}
                    >
                        {isLoading ? 'Processing...' : 'Add Collateral'}
                    </button>
                </div>
            </div>

            <style>{`
        .loan-info {
          padding: var(--space-4);
          background: rgba(255, 255, 255, 0.03);
          border-radius: var(--radius-lg);
        }

        .info-row {
          display: flex;
          justify-content: space-between;
          padding: var(--space-2) 0;
          font-size: var(--font-size-sm);
        }

        .info-row + .info-row {
          border-top: 1px solid rgba(255, 255, 255, 0.05);
        }

        .mono {
          font-family: monospace;
        }

        .form-section {
          position: relative;
        }

        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: var(--space-2);
        }

        .max-btn {
          background: rgba(0, 212, 170, 0.2);
          border: none;
          color: var(--color-accent-primary);
          font-size: var(--font-size-xs);
          padding: var(--space-1) var(--space-2);
          border-radius: var(--radius-sm);
          cursor: pointer;
        }

        .max-btn:hover {
          background: rgba(0, 212, 170, 0.3);
        }

        .input-with-suffix {
          position: relative;
        }

        .input-with-suffix .input {
          padding-right: 70px;
        }

        .input-suffix {
          position: absolute;
          right: var(--space-3);
          top: 50%;
          transform: translateY(-50%);
          color: var(--color-text-muted);
          font-size: var(--font-size-sm);
        }

        .ltv-preview {
          padding: var(--space-3);
          background: rgba(0, 212, 170, 0.05);
          border-radius: var(--radius-md);
          border: 1px solid rgba(0, 212, 170, 0.2);
        }

        .preview-row {
          display: flex;
          justify-content: space-between;
          font-size: var(--font-size-sm);
          padding: var(--space-1) 0;
        }

        .preview-row.improvement {
          border-top: 1px dashed rgba(0, 212, 170, 0.3);
          margin-top: var(--space-1);
          padding-top: var(--space-2);
        }

        .error-message {
          padding: var(--space-3) var(--space-4);
          background: rgba(255, 107, 107, 0.1);
          border: 1px solid rgba(255, 107, 107, 0.3);
          border-radius: var(--radius-md);
          color: var(--color-danger);
          font-size: var(--font-size-sm);
        }

        .success-message {
          padding: var(--space-3) var(--space-4);
          background: rgba(0, 212, 170, 0.1);
          border: 1px solid rgba(0, 212, 170, 0.3);
          border-radius: var(--radius-md);
          color: var(--color-success);
          font-size: var(--font-size-sm);
        }
      `}</style>
        </div>
    );
}
