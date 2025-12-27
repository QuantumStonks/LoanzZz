import { useState } from 'react';
import { useWalletStore, useUIStore } from '../stores';
import { authWithEcash, authWithSolana, wsClient } from '../api/client';

export default function WalletModal() {
    const { setUser, setWalletType, setConnecting, isConnecting } = useWalletStore();
    const { setWalletModalOpen } = useUIStore();
    const [error, setError] = useState<string | null>(null);

    const connectCashtab = async () => {
        setError(null);
        setConnecting(true);

        try {
            // Check if Cashtab extension is available
            const cashtab = (window as any).cashtab;

            if (cashtab) {
                const address = await cashtab.getAddress();
                const result = await authWithEcash(address);

                if (result.success) {
                    setUser(result.user);
                    setWalletType('ecash');
                    wsClient.connect(result.user.id);
                    setWalletModalOpen(false);
                }
            } else {
                // For demo: create mock user
                const mockAddress = 'ecash:qz' + Math.random().toString(36).substring(2, 40);
                const result = await authWithEcash(mockAddress);

                if (result.success) {
                    setUser(result.user);
                    setWalletType('ecash');
                    setWalletModalOpen(false);
                }
            }
        } catch (err: any) {
            setError(err.message || 'Failed to connect Cashtab');
        } finally {
            setConnecting(false);
        }
    };

    const connectPhantom = async () => {
        setError(null);
        setConnecting(true);

        try {
            const phantom = (window as any).phantom?.solana;

            if (phantom?.isPhantom) {
                const response = await phantom.connect();
                const address = response.publicKey.toString();

                const result = await authWithSolana(address);

                if (result.success) {
                    setUser(result.user);
                    setWalletType('solana');
                    wsClient.connect(result.user.id);
                    setWalletModalOpen(false);
                }
            } else {
                // For demo: create mock user
                const mockAddress = 'So' + Math.random().toString(36).substring(2, 42);
                const result = await authWithSolana(mockAddress);

                if (result.success) {
                    setUser(result.user);
                    setWalletType('solana');
                    setWalletModalOpen(false);
                }
            }
        } catch (err: any) {
            setError(err.message || 'Failed to connect Phantom');
        } finally {
            setConnecting(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={() => setWalletModalOpen(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h3 className="modal-title">Connect Wallet</h3>
                    <button className="modal-close" onClick={() => setWalletModalOpen(false)}>
                        ×
                    </button>
                </div>

                <div className="modal-body">
                    <p className="text-muted mb-6" style={{ textAlign: 'center' }}>
                        Connect your wallet to start lending and borrowing
                    </p>

                    {error && (
                        <div className="error-message mb-4">
                            {error}
                        </div>
                    )}

                    <div className="wallet-options">
                        <button
                            className="wallet-btn"
                            onClick={connectCashtab}
                            disabled={isConnecting}
                        >
                            <img
                                src="https://cashtab.com/cashtab_xec.png"
                                alt="Cashtab"
                                onError={(e) => { (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">💰</text></svg>' }}
                            />
                            <div className="wallet-btn-info">
                                <div className="wallet-btn-name">Cashtab</div>
                                <div className="wallet-btn-desc">Deposit XEC or USDT (eCash)</div>
                            </div>
                            <span className="wallet-arrow">→</span>
                        </button>

                        <button
                            className="wallet-btn"
                            onClick={connectPhantom}
                            disabled={isConnecting}
                        >
                            <img
                                src="https://phantom.app/img/phantom-logo.svg"
                                alt="Phantom"
                                onError={(e) => { (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">👻</text></svg>' }}
                            />
                            <div className="wallet-btn-info">
                                <div className="wallet-btn-name">Phantom</div>
                                <div className="wallet-btn-desc">Deposit USDT (Solana → USD)</div>
                            </div>
                            <span className="wallet-arrow">→</span>
                        </button>
                    </div>

                    <div className="wallet-note mt-6">
                        <p className="text-sm text-muted text-center">
                            🔒 Your keys, your crypto. We never have access to your private keys.
                        </p>
                    </div>
                </div>
            </div>

            <style>{`
        .wallet-options {
          display: flex;
          flex-direction: column;
          gap: var(--space-3);
        }

        .wallet-arrow {
          color: var(--color-text-tertiary);
          font-size: var(--font-size-xl);
          transition: transform var(--transition-fast);
        }

        .wallet-btn:hover .wallet-arrow {
          transform: translateX(4px);
          color: var(--color-accent-primary);
        }

        .error-message {
          padding: var(--space-3) var(--space-4);
          background: rgba(255, 107, 107, 0.1);
          border: 1px solid rgba(255, 107, 107, 0.3);
          border-radius: var(--radius-md);
          color: var(--color-danger);
          font-size: var(--font-size-sm);
          text-align: center;
        }

        .wallet-note {
          padding-top: var(--space-4);
          border-top: 1px solid rgba(255, 255, 255, 0.08);
        }
      `}</style>
        </div>
    );
}
