import { useState } from 'react';
import { useWalletStore, useLoanStore } from '../stores';
import { repayLoan } from '../api/client';
import type { Loan } from '../api/client';

interface RepayModalProps {
    loan: Loan;
    onClose: () => void;
}

export default function RepayModal({ loan, onClose }: RepayModalProps) {
    const { user } = useWalletStore();
    const { updateLoan, removeLoan } = useLoanStore();
    const [amount, setAmount] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const totalDebt = loan.borrowed.amount + loan.accruedInterest;
    const userBalance = loan.borrowed.type === 'FIRMA'
        ? user?.balances.firma || 0
        : user?.balances.xec || 0;

    const handleRepay = async () => {
        if (!user || !amount) return;

        const repayAmount = parseFloat(amount);
        if (repayAmount <= 0) {
            setError('Please enter a valid amount');
            return;
        }

        if (repayAmount > userBalance) {
            setError(`Insufficient ${loan.borrowed.type} balance`);
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const result = await repayLoan(loan.id, user.id, repayAmount);

            if (result.success) {
                if (result.isFullyRepaid) {
                    setSuccess('Loan fully repaid! 🎉');
                    removeLoan(loan.id);
                    setTimeout(onClose, 1500);
                } else {
                    setSuccess(`Repaid ${repayAmount} ${loan.borrowed.type}. Remaining: ${result.remainingDebt.toFixed(4)}`);
                    updateLoan(loan.id, {
                        totalDebt: result.remainingDebt,
                        borrowed: { ...loan.borrowed, amount: result.remainingDebt - loan.accruedInterest }
                    });
                }
                setAmount('');
            }
        } catch (err: any) {
            setError(err.message || 'Repayment failed');
        } finally {
            setIsLoading(false);
        }
    };

    const setMaxAmount = () => {
        const max = Math.min(totalDebt, userBalance);
        setAmount(max.toFixed(4));
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '420px' }}>
                <div className="modal-header">
                    <h3 className="modal-title">Repay Loan</h3>
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
                            <span>Total Debt</span>
                            <span className="text-warning">{totalDebt.toFixed(4)} {loan.borrowed.type}</span>
                        </div>
                        <div className="info-row">
                            <span>Your Balance</span>
                            <span>{userBalance.toFixed(4)} {loan.borrowed.type}</span>
                        </div>
                    </div>

                    <div className="form-section">
                        <div className="section-header">
                            <label className="label">Repay Amount</label>
                            <button className="max-btn" onClick={setMaxAmount}>MAX</button>
                        </div>
                        <div className="input-with-suffix">
                            <input
                                type="number"
                                className="input"
                                placeholder="0.00"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                max={Math.min(totalDebt, userBalance)}
                            />
                            <span className="input-suffix">{loan.borrowed.type}</span>
                        </div>
                    </div>
                </div>

                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
                    <button
                        className="btn btn-primary"
                        onClick={handleRepay}
                        disabled={isLoading || !amount || parseFloat(amount) <= 0}
                    >
                        {isLoading ? 'Processing...' : 'Repay'}
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
