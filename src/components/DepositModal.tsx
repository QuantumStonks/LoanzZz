import { useState } from 'react';
import { useWalletStore, useUIStore } from '../stores';
import { depositXEC, depositUSDT } from '../api/client';

export default function DepositModal() {
    const { user } = useWalletStore();
    const { setDepositModalOpen } = useUIStore();
    const [activeTab, setActiveTab] = useState<'xec' | 'usdt'>('xec');
    const [amount, setAmount] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [success, setSuccess] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleDeposit = async () => {
        if (!user || !amount) return;

        const depositAmount = parseFloat(amount);
        if (depositAmount <= 0) {
            setError('Please enter a valid amount');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            if (activeTab === 'xec') {
                // For demo: simulate deposit
                const result = await depositXEC(user.id, depositAmount);
                if (result.success) {
                    setSuccess(`Deposited ${depositAmount} XEC successfully!`);
                    setAmount('');
                }
            } else {
                // USDT deposit (auto-converts to FIRMA/USD)
                const result = await depositUSDT(user.id, depositAmount);
                if (result.success) {
                    setSuccess(`Converted ${depositAmount} USDT to ${result.firmaAmount} USD!`);
                    setAmount('');
                }
            }
        } catch (err: any) {
            setError(err.message || 'Deposit failed');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={() => setDepositModalOpen(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h3 className="modal-title">Deposit Funds</h3>
                    <button className="modal-close" onClick={() => setDepositModalOpen(false)}>×</button>
                </div>

                <div className="modal-body">
                    {/* Tabs */}
                    <div className="deposit-tabs">
                        <button
                            className={`tab ${activeTab === 'xec' ? 'active' : ''}`}
                            onClick={() => setActiveTab('xec')}
                        >
                            XEC (eCash)
                        </button>
                        <button
                            className={`tab ${activeTab === 'usdt' ? 'active' : ''}`}
                            onClick={() => setActiveTab('usdt')}
                        >
                            USDT (Solana)
                        </button>
                    </div>

                    {error && <div className="error-message mt-4">{error}</div>}
                    {success && <div className="success-message mt-4">{success}</div>}

                    {activeTab === 'xec' ? (
                        <div className="deposit-content mt-6">
                            <p className="text-muted mb-4">
                                Send XEC to the address below or use PayButton to deposit instantly.
                            </p>

                            {/* PayButton placeholder */}
                            <div
                                className="paybutton-container"
                                data-to="ecash:qz..."
                                data-amount={amount || '0'}
                            >
                                <div className="paybutton-placeholder">
                                    <span className="paybutton-icon">💰</span>
                                    <span>PayButton</span>
                                    <span className="text-sm text-muted">Click to deposit XEC</span>
                                </div>
                            </div>

                            <div className="divider">
                                <span>or enter amount manually</span>
                            </div>

                            <div className="form-group">
                                <label className="label">Amount (XEC)</label>
                                <input
                                    type="number"
                                    className="input"
                                    placeholder="Enter amount"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                />
                            </div>

                            <button
                                className="btn btn-primary w-full mt-4"
                                onClick={handleDeposit}
                                disabled={isLoading || !amount}
                            >
                                {isLoading ? 'Processing...' : 'Deposit XEC'}
                            </button>
                        </div>
                    ) : (
                        <div className="deposit-content mt-6">
                            <p className="text-muted mb-4">
                                Send USDT on Solana to the address below. It will be automatically converted to USD (FIRMA) at 1:1 rate.
                            </p>

                            <div className="address-box">
                                <label className="label">Deposit Address (Solana USDT)</label>
                                <div className="address">
                                    <span>So...</span>
                                    <button className="copy-btn">📋</button>
                                </div>
                                <p className="text-xs text-muted mt-2">
                                    Only send USDT on Solana network to this address
                                </p>
                            </div>

                            <div className="conversion-info mt-6">
                                <div className="info-row">
                                    <span>Conversion Rate</span>
                                    <span className="text-success">1 USDT = 1 USD</span>
                                </div>
                                <div className="info-row">
                                    <span>Fee</span>
                                    <span className="text-success">0%</span>
                                </div>
                            </div>

                            <div className="divider">
                                <span>or simulate deposit</span>
                            </div>

                            <div className="form-group">
                                <label className="label">Amount (USDT)</label>
                                <input
                                    type="number"
                                    className="input"
                                    placeholder="Enter amount"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                />
                            </div>

                            <button
                                className="btn btn-primary w-full mt-4"
                                onClick={handleDeposit}
                                disabled={isLoading || !amount}
                            >
                                {isLoading ? 'Processing...' : 'Deposit USDT → USD'}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <style>{`
        .deposit-tabs {
          display: flex;
          gap: var(--space-2);
          padding: var(--space-1);
          background: rgba(255, 255, 255, 0.05);
          border-radius: var(--radius-lg);
        }

        .tab {
          flex: 1;
          padding: var(--space-3);
          background: transparent;
          border: none;
          color: var(--color-text-secondary);
          font-size: var(--font-size-sm);
          font-weight: 500;
          border-radius: var(--radius-md);
          cursor: pointer;
          transition: all var(--transition-fast);
        }

        .tab.active {
          background: var(--color-accent-primary);
          color: #000;
        }

        .paybutton-container {
          padding: var(--space-6);
          background: rgba(0, 212, 170, 0.1);
          border: 2px dashed rgba(0, 212, 170, 0.3);
          border-radius: var(--radius-xl);
          text-align: center;
          cursor: pointer;
          transition: all var(--transition-base);
        }

        .paybutton-container:hover {
          border-color: var(--color-accent-primary);
          background: rgba(0, 212, 170, 0.15);
        }

        .paybutton-placeholder {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--space-2);
        }

        .paybutton-icon {
          font-size: 2rem;
        }

        .divider {
          display: flex;
          align-items: center;
          gap: var(--space-4);
          margin: var(--space-6) 0;
          color: var(--color-text-muted);
          font-size: var(--font-size-sm);
        }

        .divider::before, .divider::after {
          content: '';
          flex: 1;
          height: 1px;
          background: rgba(255, 255, 255, 0.1);
        }

        .address-box {
          padding: var(--space-4);
          background: rgba(255, 255, 255, 0.03);
          border-radius: var(--radius-lg);
        }

        .address {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: var(--space-3);
          background: rgba(0, 0, 0, 0.3);
          border-radius: var(--radius-md);
          font-family: monospace;
          margin-top: var(--space-2);
        }

        .copy-btn {
          background: transparent;
          border: none;
          cursor: pointer;
          font-size: var(--font-size-lg);
        }

        .conversion-info {
          padding: var(--space-4);
          background: rgba(0, 212, 170, 0.05);
          border-radius: var(--radius-lg);
        }

        .info-row {
          display: flex;
          justify-content: space-between;
          padding: var(--space-2) 0;
          font-size: var(--font-size-sm);
        }

        .form-group {
          margin-top: var(--space-4);
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
