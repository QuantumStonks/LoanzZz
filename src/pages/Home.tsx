import { Link } from 'react-router-dom';
import { useUIStore } from '../stores';

export default function Home() {
    const { setWalletModalOpen } = useUIStore();

    return (
        <div className="home-page">
            {/* Hero Section */}
            <section className="hero">
                <div className="container">
                    <div className="hero-content">
                        <div className="hero-badge">🔒 Ultra-Secure • Powered by eCash</div>
                        <h1 className="hero-title">
                            Borrow Against Your
                            <span className="gradient-text"> Crypto</span>
                        </h1>
                        <p className="hero-subtitle">
                            Deposit XEC or USDT, get instant loans, and earn staking rewards on your collateral.
                            Transparent, secure, and powered by the $XEC ecosystem.
                        </p>
                        <div className="hero-actions">
                            <button className="btn btn-primary btn-lg" onClick={() => setWalletModalOpen(true)}>
                                Start Borrowing
                            </button>
                            <Link to="/escrow" className="btn btn-secondary btn-lg">
                                View Escrow
                            </Link>
                        </div>

                        {/* Stats */}
                        <div className="hero-stats">
                            <div className="stat">
                                <div className="stat-value">65%</div>
                                <div className="stat-label">Max LTV</div>
                            </div>
                            <div className="stat">
                                <div className="stat-value">~3.65%</div>
                                <div className="stat-label">Staking APY</div>
                            </div>
                            <div className="stat">
                                <div className="stat-value">0%</div>
                                <div className="stat-label">Conversion Fee</div>
                            </div>
                            <div className="stat">
                                <div className="stat-value">24/7</div>
                                <div className="stat-label">Instant Loans</div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section className="features">
                <div className="container">
                    <h2 className="section-title text-center">Why LoanzZz?</h2>

                    <div className="features-grid">
                        <div className="feature-card glass-card">
                            <div className="feature-icon">💰</div>
                            <h3>Multi-Wallet Support</h3>
                            <p>Connect via Cashtab (XEC) or Phantom (Solana USDT).
                                USDT is automatically converted to USD at 1:1.</p>
                        </div>

                        <div className="feature-card glass-card">
                            <div className="feature-icon">📈</div>
                            <h3>Earn While You Borrow</h3>
                            <p>Your XEC collateral is staked as XECX, earning ~3.65% APY
                                that reduces your effective interest cost.</p>
                        </div>

                        <div className="feature-card glass-card">
                            <div className="feature-icon">🔐</div>
                            <h3>Binance-Grade Security</h3>
                            <p>Industry-standard LTV thresholds (65/75/83%),
                                programmatic margin calls, and transparent liquidation.</p>
                        </div>

                        <div className="feature-card glass-card">
                            <div className="feature-icon">👁️</div>
                            <h3>Fully Transparent</h3>
                            <p>All collateral is held in public escrow wallets.
                                Verify everything on-chain via eCash explorer.</p>
                        </div>

                        <div className="feature-card glass-card">
                            <div className="feature-icon">⚡</div>
                            <h3>Instant Everything</h3>
                            <p>Real-time balance updates, instant loan disbursement,
                                and fast repayments powered by eCash.</p>
                        </div>

                        <div className="feature-card glass-card">
                            <div className="feature-icon">💎</div>
                            <h3>$FIRMA Stablecoin</h3>
                            <p>Backed 1:1 by USD. Over-collateralized by staked XEC.
                                Earn daily yield just by holding.</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* How It Works */}
            <section className="how-it-works">
                <div className="container">
                    <h2 className="section-title text-center">How It Works</h2>

                    <div className="steps">
                        <div className="step">
                            <div className="step-number">1</div>
                            <h4>Connect Wallet</h4>
                            <p>Link Cashtab or Phantom wallet</p>
                        </div>
                        <div className="step-arrow">→</div>
                        <div className="step">
                            <div className="step-number">2</div>
                            <h4>Deposit Collateral</h4>
                            <p>XEC or USDT (auto-converts to USD)</p>
                        </div>
                        <div className="step-arrow">→</div>
                        <div className="step">
                            <div className="step-number">3</div>
                            <h4>Get Instant Loan</h4>
                            <p>Borrow up to 65% LTV</p>
                        </div>
                        <div className="step-arrow">→</div>
                        <div className="step">
                            <div className="step-number">4</div>
                            <h4>Earn Staking</h4>
                            <p>XEC collateral earns daily rewards</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="cta">
                <div className="container">
                    <div className="cta-card glass-card">
                        <h2>Ready to Unlock Your Crypto?</h2>
                        <p>Start borrowing in under a minute. No credit check, fully decentralized.</p>
                        <button className="btn btn-primary btn-lg" onClick={() => setWalletModalOpen(true)}>
                            Connect Wallet
                        </button>
                    </div>
                </div>
            </section>

            <style>{`
        .home-page {
          overflow-x: hidden;
        }

        /* Hero */
        .hero {
          padding: var(--space-16) 0;
          text-align: center;
          position: relative;
        }

        .hero::before {
          content: '';
          position: absolute;
          top: 0;
          left: 50%;
          transform: translateX(-50%);
          width: 120%;
          height: 100%;
          background: radial-gradient(ellipse at center top, rgba(0, 212, 170, 0.1) 0%, transparent 60%);
          pointer-events: none;
        }

        .hero-content {
          position: relative;
          z-index: 1;
        }

        .hero-badge {
          display: inline-block;
          padding: var(--space-2) var(--space-4);
          background: rgba(0, 212, 170, 0.1);
          border: 1px solid rgba(0, 212, 170, 0.3);
          border-radius: var(--radius-full);
          font-size: var(--font-size-sm);
          color: var(--color-accent-primary);
          margin-bottom: var(--space-6);
        }

        .hero-title {
          font-size: var(--font-size-5xl);
          font-weight: 700;
          line-height: 1.1;
          margin-bottom: var(--space-6);
        }

        .gradient-text {
          background: var(--gradient-primary);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .hero-subtitle {
          font-size: var(--font-size-lg);
          color: var(--color-text-secondary);
          max-width: 600px;
          margin: 0 auto var(--space-8);
        }

        .hero-actions {
          display: flex;
          gap: var(--space-4);
          justify-content: center;
          margin-bottom: var(--space-12);
        }

        .hero-stats {
          display: flex;
          justify-content: center;
          gap: var(--space-10);
          flex-wrap: wrap;
        }

        .stat {
          text-align: center;
        }

        .stat-value {
          font-size: var(--font-size-3xl);
          font-weight: 700;
          color: var(--color-accent-primary);
        }

        .stat-label {
          font-size: var(--font-size-sm);
          color: var(--color-text-tertiary);
        }

        /* Features */
        .features {
          padding: var(--space-16) 0;
        }

        .section-title {
          margin-bottom: var(--space-12);
        }

        .features-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: var(--space-6);
        }

        .feature-card {
          text-align: center;
        }

        .feature-icon {
          font-size: 2.5rem;
          margin-bottom: var(--space-4);
        }

        .feature-card h3 {
          font-size: var(--font-size-lg);
          margin-bottom: var(--space-2);
        }

        .feature-card p {
          font-size: var(--font-size-sm);
        }

        /* How It Works */
        .how-it-works {
          padding: var(--space-16) 0;
          background: rgba(0, 212, 170, 0.02);
        }

        .steps {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: var(--space-4);
          flex-wrap: wrap;
        }

        .step {
          text-align: center;
          padding: var(--space-6);
        }

        .step-number {
          width: 48px;
          height: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--gradient-primary);
          color: #000;
          font-weight: 700;
          font-size: var(--font-size-xl);
          border-radius: 50%;
          margin: 0 auto var(--space-4);
        }

        .step h4 {
          margin-bottom: var(--space-1);
        }

        .step p {
          font-size: var(--font-size-sm);
          color: var(--color-text-tertiary);
        }

        .step-arrow {
          font-size: var(--font-size-2xl);
          color: var(--color-text-muted);
        }

        /* CTA */
        .cta {
          padding: var(--space-16) 0;
        }

        .cta-card {
          text-align: center;
          padding: var(--space-12);
        }

        .cta-card h2 {
          margin-bottom: var(--space-4);
        }

        .cta-card p {
          color: var(--color-text-secondary);
          margin-bottom: var(--space-8);
        }

        @media (max-width: 768px) {
          .hero-title { font-size: var(--font-size-3xl); }
          .features-grid { grid-template-columns: 1fr; }
          .step-arrow { display: none; }
          .steps { flex-direction: column; }
        }
      `}</style>
        </div>
    );
}
