import { Link, useLocation } from 'react-router-dom';
import { useWalletStore, useUIStore, usePriceStore } from '../stores';

export default function Header() {
  const location = useLocation();
  const { user } = useWalletStore();
  const { prices } = usePriceStore();
  const { setWalletModalOpen, setDepositModalOpen } = useUIStore();

  const formatBalance = (amount: number, decimals = 2) => {
    if (amount >= 1000000) return `${(amount / 1000000).toFixed(2)}M`;
    if (amount >= 1000) return `${(amount / 1000).toFixed(2)}K`;
    return amount.toFixed(decimals);
  };

  const totalUSD = user
    ? user.balances.xec * prices.XEC + user.balances.firma * prices.FIRMA
    : 0;

  return (
    <header className="header">
      <div className="container">
        <div className="header-content">
          {/* Logo */}
          <Link to="/" className="logo">
            <span className="logo-icon">🏦</span>
            <span className="logo-text">LoanzZz</span>
          </Link>

          {/* Navigation */}
          <nav className="nav">
            <Link
              to="/"
              className={`nav-link ${location.pathname === '/' ? 'active' : ''}`}
            >
              Home
            </Link>
            <Link
              to="/dashboard"
              className={`nav-link ${location.pathname === '/dashboard' ? 'active' : ''}`}
            >
              Dashboard
            </Link>
            <Link
              to="/escrow"
              className={`nav-link ${location.pathname === '/escrow' ? 'active' : ''}`}
            >
              Escrow
            </Link>
            <Link
              to="/api"
              className={`nav-link ${location.pathname === '/api' ? 'active' : ''}`}
            >
              API
            </Link>
          </nav>

          {/* Wallet Section */}
          <div className="header-wallet">
            {user ? (
              <>
                {/* Balance Display */}
                <div className="balance-display">
                  <div className="balance-item">
                    <span className="balance-label">XEC</span>
                    <span className="balance-value">{formatBalance(user.balances.xec)}</span>
                  </div>
                  <div className="balance-item">
                    <span className="balance-label">USD</span>
                    <span className="balance-value">${formatBalance(user.balances.firma)}</span>
                  </div>
                  <div className="balance-total">
                    <span className="balance-label">Total</span>
                    <span className="balance-value text-success">${totalUSD.toFixed(2)}</span>
                  </div>
                </div>

                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setDepositModalOpen(true)}
                >
                  Deposit
                </button>

                <div className="wallet-address">
                  {user.ecashAddress
                    ? `${user.ecashAddress.slice(0, 10)}...`
                    : user.solanaAddress?.slice(0, 8) + '...'
                  }
                </div>
              </>
            ) : (
              <button
                className="btn btn-primary"
                onClick={() => setWalletModalOpen(true)}
              >
                Connect Wallet
              </button>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .header {
          position: sticky;
          top: 0;
          z-index: 100;
          background: rgba(10, 10, 15, 0.9);
          backdrop-filter: blur(20px);
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }

        .header-content {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: var(--space-4) 0;
          gap: var(--space-6);
        }

        .logo {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          text-decoration: none;
        }

        .logo-icon {
          font-size: var(--font-size-2xl);
        }

        .logo-text {
          font-size: var(--font-size-xl);
          font-weight: 700;
          background: var(--gradient-primary);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .nav {
          display: flex;
          gap: var(--space-1);
        }

        .nav-link {
          padding: var(--space-2) var(--space-4);
          color: var(--color-text-secondary);
          font-size: var(--font-size-sm);
          font-weight: 500;
          border-radius: var(--radius-lg);
          transition: all var(--transition-fast);
        }

        .nav-link:hover {
          color: var(--color-text-primary);
          background: rgba(255, 255, 255, 0.05);
        }

        .nav-link.active {
          color: var(--color-accent-primary);
          background: rgba(0, 212, 170, 0.1);
        }

        .header-wallet {
          display: flex;
          align-items: center;
          gap: var(--space-4);
        }

        .balance-display {
          display: flex;
          gap: var(--space-4);
          padding: var(--space-2) var(--space-4);
          background: rgba(255, 255, 255, 0.05);
          border-radius: var(--radius-lg);
        }

        .balance-item, .balance-total {
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .balance-label {
          font-size: var(--font-size-xs);
          color: var(--color-text-tertiary);
        }

        .balance-value {
          font-size: var(--font-size-sm);
          font-weight: 600;
        }

        .balance-total {
          padding-left: var(--space-4);
          border-left: 1px solid rgba(255, 255, 255, 0.1);
        }

        .wallet-address {
          padding: var(--space-2) var(--space-3);
          background: rgba(255, 255, 255, 0.05);
          border-radius: var(--radius-md);
          font-size: var(--font-size-xs);
          font-family: monospace;
          color: var(--color-text-secondary);
        }

        @media (max-width: 768px) {
          .nav { display: none; }
          .balance-display { display: none; }
        }
      `}</style>
    </header>
  );
}
