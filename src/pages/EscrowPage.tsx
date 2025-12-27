import { useState, useEffect } from 'react';
import { getEscrowSummary, getEscrowWallets, getEscrowTransactions, type EscrowSummary } from '../api/client';

export default function EscrowPage() {
    const [summary, setSummary] = useState<EscrowSummary | null>(null);
    const [wallets, setWallets] = useState<any[]>([]);
    const [transactions, setTransactions] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [sum, wal, txs] = await Promise.all([
                    getEscrowSummary(),
                    getEscrowWallets(),
                    getEscrowTransactions(20)
                ]);
                setSummary(sum);
                setWallets(wal.wallets);
                setTransactions(txs.transactions);
            } catch (error) {
                console.error('Failed to fetch escrow data:', error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
        const interval = setInterval(fetchData, 30000);
        return () => clearInterval(interval);
    }, []);

    if (isLoading) {
        return (
            <div className="page">
                <div className="container" style={{ textAlign: 'center', padding: '4rem' }}>
                    <div className="animate-pulse">Loading escrow data...</div>
                </div>
            </div>
        );
    }

    return (
        <div className="page">
            <div className="container">
                <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
                    <h1>👁️ Public Escrow</h1>
                    <p className="text-muted">Full transparency of all collateral and platform funds</p>
                </div>

                {summary && (
                    <div className="grid grid-4" style={{ marginBottom: '3rem' }}>
                        <div className="glass-card stat-card">
                            <div className="stat-label">Total Collateral</div>
                            <div className="stat-value">${summary.collateral.totalUsd.toFixed(2)}</div>
                        </div>
                        <div className="glass-card stat-card">
                            <div className="stat-label">Active Loans</div>
                            <div className="stat-value">{summary.loans.active}</div>
                        </div>
                        <div className="glass-card stat-card">
                            <div className="stat-label">XECX Staking Pool</div>
                            <div className="stat-value">{summary.staking.totalPool.toLocaleString()}</div>
                        </div>
                        <div className="glass-card stat-card">
                            <div className="stat-label">Health Ratio</div>
                            <div className="stat-value text-success">{summary.healthRatio}%</div>
                        </div>
                    </div>
                )}

                <h2 style={{ marginBottom: '1.5rem' }}>Escrow Wallets</h2>
                <div className="grid grid-2" style={{ marginBottom: '3rem' }}>
                    {wallets.map(wallet => (
                        <div key={wallet.id} className="glass-card">
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                                <span className="badge badge-success">{wallet.type}</span>
                                <a href={wallet.explorerUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.875rem' }}>
                                    View on Explorer ↗
                                </a>
                            </div>
                            <div style={{ fontFamily: 'monospace', fontSize: '0.875rem', marginBottom: '1rem', wordBreak: 'break-all' }}>
                                {wallet.address}
                            </div>
                            <div style={{ display: 'flex', gap: '1.5rem' }}>
                                <div><span className="text-muted">XEC:</span> {wallet.balances.xec.toLocaleString()}</div>
                                <div><span className="text-muted">FIRMA:</span> {wallet.balances.firma.toLocaleString()}</div>
                            </div>
                        </div>
                    ))}
                </div>

                <h2 style={{ marginBottom: '1.5rem' }}>Recent Transactions</h2>
                <div className="glass-card">
                    {transactions.length === 0 ? (
                        <p className="text-muted text-center">No recent transactions</p>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                                        <th style={{ padding: '0.75rem', textAlign: 'left' }}>Type</th>
                                        <th style={{ padding: '0.75rem', textAlign: 'left' }}>Asset</th>
                                        <th style={{ padding: '0.75rem', textAlign: 'right' }}>Amount</th>
                                        <th style={{ padding: '0.75rem', textAlign: 'right' }}>Time</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {transactions.map(tx => (
                                        <tr key={tx.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                            <td style={{ padding: '0.75rem' }}>{tx.type.replace(/_/g, ' ')}</td>
                                            <td style={{ padding: '0.75rem' }}>{tx.asset}</td>
                                            <td style={{ padding: '0.75rem', textAlign: 'right' }}>{tx.amount.toLocaleString()}</td>
                                            <td style={{ padding: '0.75rem', textAlign: 'right', color: 'var(--color-text-muted)' }}>
                                                {new Date(tx.timestamp).toLocaleString()}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
