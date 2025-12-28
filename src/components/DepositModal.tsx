import { useState, useEffect, useRef } from 'react';
import { useWalletStore, useUIStore } from '../stores';
import { depositXEC, depositUSDT } from '../api/client';

// Platform escrow address from environment
const PLATFORM_XEC_ADDRESS = 'ecash:qr3dscd57mfs99f93xwaxhe5xzdkzlhahg58pzn9kx';
const PLATFORM_SOLANA_ADDRESS = '9Kyjhrm1meis6rj62RquFNd3PUSWUiHD3XwhxuzVmrQj';

export default function DepositModal() {
    const { user } = useWalletStore();
    const { setDepositModalOpen } = useUIStore();
    const [activeTab, setActiveTab] = useState<'xec' | 'usdt'>('xec');
    const [amount, setAmount] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [success, setSuccess] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const payButtonRef = useRef<HTMLDivElement>(null);

    // Load PayButton script and render
    useEffect(() => {
        if (activeTab !== 'xec') return;

        // Load PayButton script if not already loaded
        const existingScript = document.querySelector('script[src*="paybutton"]');
        if (!existingScript) {
            const script = document.createElement('script');
            script.src = 'https://unpkg.com/@paybutton/paybutton/dist/paybutton.js';
            script.async = true;
            document.body.appendChild(script);

            script.onload = () => renderPayButton();
        } else {
            // Script already loaded, render button
            renderPayButton();
        }
    }, [activeTab, user]);

    const renderPayButton = () => {
        if (!payButtonRef.current || !user) return;

        // Clear previous button
        payButtonRef.current.innerHTML = '';

        // Check if PayButton is available
        const PayButton = (window as any).PayButton;
        if (!PayButton) {
            console.log('PayButton not loaded yet, retrying...');
            setTimeout(renderPayButton, 500);
            return;
        }

        try {
            PayButton.render(payButtonRef.current, {
                to: PLATFORM_XEC_ADDRESS,
                amount: 0, // Allow any amount
                currency: 'XEC',
                text: 'Deposit XEC',
                hoverText: 'Click to pay with XEC',
                theme: {
                    palette: {
                        primary: '#00d4aa',
                        secondary: '#1a1a2e',
                        tertiary: '#ffffff'
                    }
                },
                onSuccess: async (txid: string, amount: number) => {
                    console.log('PayButton success:', txid, amount);
                    setSuccess(`Payment detected! TxID: ${txid.slice(0, 16)}...`);

                    // Credit the user's balance on backend
                    try {
                        await depositXEC(user.id, amount, txid);
                        setSuccess(`Deposited ${amount.toLocaleString()} XEC successfully!`);
                    } catch (err: any) {
                        console.error('Failed to credit deposit:', err);
                        setError('Payment received but failed to credit balance. Contact support.');
                    }
                },
                onTransaction: (txid: string) => {
                    console.log('PayButton transaction:', txid);
                    setSuccess(`Transaction detected: ${txid.slice(0, 16)}...`);
                },
                goalAmount: undefined,
                editable: true,
                randomSatoshis: true
            });
            console.log('PayButton rendered successfully');
        } catch (err) {
            console.error('PayButton render error:', err);
        }
    };

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

    const copyToClipboard = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
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
                                Use PayButton to deposit XEC instantly, or send directly to the address below.
                            </p>

                            {/* Real PayButton */}
                            <div
                                ref={payButtonRef}
                                className="paybutton-container"
                                style={{ minHeight: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                                <div className="paybutton-placeholder">
                                    <span className="paybutton-icon">💰</span>
                                    <span>Loading PayButton...</span>
                                </div>
                            </div>

                            <div className="divider">
                                <span>or send directly</span>
                            </div>

                            {/* Deposit Address */}
                            <div className="address-box">
                                <label className="label">Deposit Address (eCash)</label>
                                <div className="address">
                                    <span style={{ fontSize: '0.75rem' }}>{PLATFORM_XEC_ADDRESS}</span>
                                    <button
                                        className="copy-btn"
                                        onClick={() => copyToClipboard(PLATFORM_XEC_ADDRESS)}
                                        title="Copy address"
                                    >
                                        {copied ? '✓' : '📋'}
                                    </button>
                                </div>
                            </div>

                            <div className="divider">
                                <span>or simulate deposit</span>
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
                                {isLoading ? 'Processing...' : 'Simulate Deposit'}
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
                                    <span style={{ fontSize: '0.75rem' }}>{PLATFORM_SOLANA_ADDRESS}</span>
                                    <button
                                        className="copy-btn"
                                        onClick={() => copyToClipboard(PLATFORM_SOLANA_ADDRESS)}
                                        title="Copy address"
                                    >
                                        {copied ? '✓' : '📋'}
                                    </button>
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
                                {isLoading ? 'Processing...' : 'Simulate USDT → USD'}
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
          padding: var(--space-4);
          background: rgba(0, 212, 170, 0.1);
          border: 2px dashed rgba(0, 212, 170, 0.3);
          border-radius: var(--radius-xl);
          text-align: center;
          transition: all var(--transition-base);
        }

        .paybutton-placeholder {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--space-2);
          color: var(--color-text-muted);
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
          gap: var(--space-2);
        }

        .copy-btn {
          background: transparent;
          border: none;
          cursor: pointer;
          font-size: var(--font-size-lg);
          padding: var(--space-1);
          border-radius: var(--radius-sm);
          transition: background var(--transition-fast);
        }

        .copy-btn:hover {
          background: rgba(255, 255, 255, 0.1);
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
