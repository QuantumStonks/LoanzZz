import { useState } from 'react';
import { useWalletStore, useLoanStore, usePriceStore, useUIStore } from '../stores';
import LoanCard from '../components/LoanCard';
import RepayModal from '../components/RepayModal';
import AddCollateralModal from '../components/AddCollateralModal';
import type { Loan } from '../api/client';

export default function DashboardPage() {
    const { user } = useWalletStore();
    const { loans, isLoading } = useLoanStore();
    const { prices } = usePriceStore();
    const { setWalletModalOpen, setCreateLoanModalOpen, setDepositModalOpen } = useUIStore();

    // Modal state for loan actions
    const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
    const [repayModalOpen, setRepayModalOpen] = useState(false);
    const [addCollateralModalOpen, setAddCollateralModalOpen] = useState(false);

    const handleRepay = (loan: Loan) => {
        setSelectedLoan(loan);
        setRepayModalOpen(true);
    };

    const handleAddCollateral = (loan: Loan) => {
        setSelectedLoan(loan);
        setAddCollateralModalOpen(true);
    };

    if (!user) {
        return (
            <div className="page">
                <div className="container">
                    <div className="glass-card" style={{ textAlign: 'center', padding: '4rem' }}>
                        <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🔒</div>
                        <h2>Connect Your Wallet</h2>
                        <p style={{ color: 'var(--color-text-secondary)', marginBottom: '1.5rem' }}>
                            Connect your wallet to view your dashboard
                        </p>
                        <button className="btn btn-primary" onClick={() => setWalletModalOpen(true)}>
                            Connect Wallet
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    const activeLoans = loans.filter(l => l.status === 'active' || l.status === 'margin_call');
    const totalCollateralUSD = activeLoans.reduce((sum, l) =>
        sum + l.collateral.amount * (prices[l.collateral.type as keyof typeof prices] || 0), 0);
    const totalBorrowedUSD = activeLoans.reduce((sum, l) => sum + l.totalDebt, 0);

    return (
        <div className="page">
            <div className="container">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                    <div>
                        <h1>Dashboard</h1>
                        <p className="text-muted">Manage your loans and collateral</p>
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <button className="btn btn-secondary" onClick={() => setDepositModalOpen(true)}>Deposit</button>
                        <button className="btn btn-primary" onClick={() => setCreateLoanModalOpen(true)}>+ Create Loan</button>
                    </div>
                </div>

                <div className="grid grid-4" style={{ marginBottom: '2.5rem' }}>
                    <div className="glass-card stat-card">
                        <div className="stat-label">Total Collateral</div>
                        <div className="stat-value">${totalCollateralUSD.toFixed(2)}</div>
                    </div>
                    <div className="glass-card stat-card">
                        <div className="stat-label">Total Borrowed</div>
                        <div className="stat-value" style={{ color: 'var(--color-warning)' }}>${totalBorrowedUSD.toFixed(2)}</div>
                    </div>
                    <div className="glass-card stat-card">
                        <div className="stat-label">Net Position</div>
                        <div className="stat-value" style={{ color: 'var(--color-success)' }}>${(totalCollateralUSD - totalBorrowedUSD).toFixed(2)}</div>
                    </div>
                    <div className="glass-card stat-card">
                        <div className="stat-label">🌟 Staking Yield</div>
                        <div className="stat-value" style={{ color: 'var(--color-success)' }}>+{user.stakingRewardsEarned.toFixed(4)} XEC</div>
                    </div>
                </div>

                <h2 style={{ marginBottom: '1.5rem' }}>Your Loans</h2>

                {isLoading ? (
                    <div style={{ textAlign: 'center', padding: '3rem' }}>Loading...</div>
                ) : loans.length === 0 ? (
                    <div className="glass-card" style={{ textAlign: 'center', padding: '3rem' }}>
                        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📊</div>
                        <h3>No Loans Yet</h3>
                        <p style={{ color: 'var(--color-text-secondary)', marginBottom: '1.5rem' }}>Create your first loan</p>
                        <button className="btn btn-primary" onClick={() => setCreateLoanModalOpen(true)}>Create Loan</button>
                    </div>
                ) : (
                    <div className="grid grid-2">
                        {loans.map(loan => (
                            <LoanCard
                                key={loan.id}
                                loan={loan}
                                onRepay={() => handleRepay(loan)}
                                onAddCollateral={() => handleAddCollateral(loan)}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Repay Modal */}
            {repayModalOpen && selectedLoan && (
                <RepayModal
                    loan={selectedLoan}
                    onClose={() => {
                        setRepayModalOpen(false);
                        setSelectedLoan(null);
                    }}
                />
            )}

            {/* Add Collateral Modal */}
            {addCollateralModalOpen && selectedLoan && (
                <AddCollateralModal
                    loan={selectedLoan}
                    onClose={() => {
                        setAddCollateralModalOpen(false);
                        setSelectedLoan(null);
                    }}
                />
            )}
        </div>
    );
}
