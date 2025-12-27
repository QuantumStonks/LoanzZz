import type { Loan } from '../api/client';
import LTVGauge from './LTVGauge';
import { usePriceStore } from '../stores';

interface LoanCardProps {
    loan: Loan;
    onRepay?: () => void;
    onAddCollateral?: () => void;
}

export default function LoanCard({ loan, onRepay, onAddCollateral }: LoanCardProps) {
    const { prices } = usePriceStore();

    const getStatusBadge = () => {
        switch (loan.status) {
            case 'active':
                return <span className="badge badge-success">Active</span>;
            case 'margin_call':
                return <span className="badge badge-warning animate-pulse">⚠️ Margin Call</span>;
            case 'liquidated':
                return <span className="badge badge-danger">Liquidated</span>;
            case 'repaid':
                return <span className="badge badge-success">Repaid</span>;
            default:
                return null;
        }
    };

    const currentCollateralValue = loan.collateral.amount * (prices[loan.collateral.type as keyof typeof prices] || 0);
    const totalDebt = loan.borrowed.amount + loan.accruedInterest;

    return (
        <div className={`loan-card glass-card ${loan.status === 'margin_call' ? 'margin-call' : ''}`}>
            <div className="loan-header">
                <div className="loan-id">
                    <span className="text-muted">Loan</span>
                    <span className="loan-id-value">#{loan.id.slice(0, 8)}</span>
                </div>
                {getStatusBadge()}
            </div>

            <div className="loan-body">
                {/* LTV Gauge */}
                <div className="loan-ltv">
                    <LTVGauge ltv={loan.ltv} />
                </div>

                {/* Collateral & Borrowed */}
                <div className="loan-details">
                    <div className="loan-detail">
                        <span className="detail-label">Collateral</span>
                        <div className="detail-value">
                            <span className="amount">{loan.collateral.amount.toLocaleString()}</span>
                            <span className="asset">{loan.collateral.type}</span>
                        </div>
                        <span className="usd-value">${currentCollateralValue.toFixed(2)}</span>
                    </div>

                    <div className="loan-detail">
                        <span className="detail-label">Borrowed</span>
                        <div className="detail-value">
                            <span className="amount">{loan.borrowed.amount.toLocaleString()}</span>
                            <span className="asset">{loan.borrowed.type}</span>
                        </div>
                        <span className="usd-value">${loan.borrowed.valueUsd.toFixed(2)}</span>
                    </div>

                    <div className="loan-detail">
                        <span className="detail-label">Interest Accrued</span>
                        <div className="detail-value interest">
                            <span className="amount">+{loan.accruedInterest.toFixed(4)}</span>
                            <span className="asset">{loan.borrowed.type}</span>
                        </div>
                    </div>

                    <div className="loan-detail total-debt">
                        <span className="detail-label">Total Debt</span>
                        <div className="detail-value">
                            <span className="amount">{totalDebt.toFixed(4)}</span>
                            <span className="asset">{loan.borrowed.type}</span>
                        </div>
                    </div>

                    {loan.stakingYieldEarned > 0 && (
                        <div className="loan-detail staking">
                            <span className="detail-label">🌟 Staking Yield</span>
                            <div className="detail-value">
                                <span className="amount text-success">+{loan.stakingYieldEarned.toFixed(4)}</span>
                                <span className="asset">XEC</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {loan.status === 'active' || loan.status === 'margin_call' ? (
                <div className="loan-actions">
                    <button className="btn btn-secondary btn-sm" onClick={onAddCollateral}>
                        Add Collateral
                    </button>
                    <button className="btn btn-primary btn-sm" onClick={onRepay}>
                        Repay
                    </button>
                </div>
            ) : null}

            <style>{`
        .loan-card {
          transition: all var(--transition-base);
        }

        .loan-card.margin-call {
          border-color: rgba(253, 203, 110, 0.5);
          animation: glow 2s ease-in-out infinite;
        }

        .loan-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: var(--space-4);
        }

        .loan-id {
          display: flex;
          flex-direction: column;
        }

        .loan-id-value {
          font-family: monospace;
          font-weight: 600;
        }

        .loan-ltv {
          margin-bottom: var(--space-6);
        }

        .loan-details {
          display: flex;
          flex-direction: column;
          gap: var(--space-3);
        }

        .loan-detail {
          display: flex;
          align-items: center;
          gap: var(--space-2);
        }

        .detail-label {
          flex: 1;
          font-size: var(--font-size-sm);
          color: var(--color-text-tertiary);
        }

        .detail-value {
          display: flex;
          align-items: baseline;
          gap: var(--space-1);
        }

        .detail-value .amount {
          font-weight: 600;
          font-size: var(--font-size-base);
        }

        .detail-value .asset {
          font-size: var(--font-size-sm);
          color: var(--color-text-tertiary);
        }

        .detail-value.interest .amount {
          color: var(--color-warning);
        }

        .usd-value {
          font-size: var(--font-size-sm);
          color: var(--color-text-muted);
          margin-left: var(--space-2);
        }

        .loan-detail.total-debt {
          padding-top: var(--space-3);
          border-top: 1px solid rgba(255, 255, 255, 0.08);
        }

        .loan-detail.total-debt .amount {
          font-size: var(--font-size-lg);
          color: var(--color-text-primary);
        }

        .loan-detail.staking {
          padding-top: var(--space-2);
        }

        .loan-actions {
          display: flex;
          gap: var(--space-3);
          margin-top: var(--space-6);
          padding-top: var(--space-4);
          border-top: 1px solid rgba(255, 255, 255, 0.08);
        }

        .loan-actions .btn {
          flex: 1;
        }
      `}</style>
        </div>
    );
}
