-- LoanzZz Database Schema
-- SQLite database for crypto lending platform

-- Users table - wallet addresses and balances
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    ecash_address TEXT UNIQUE,
    solana_address TEXT UNIQUE,
    balance_xec REAL DEFAULT 0,
    balance_firma REAL DEFAULT 0,
    balance_xecx REAL DEFAULT 0,
    staking_rewards_earned REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Loans table - isolated vault positions
CREATE TABLE IF NOT EXISTS loans (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    status TEXT DEFAULT 'active' CHECK(status IN ('active', 'repaid', 'liquidated', 'margin_call')),
    
    -- Collateral
    collateral_type TEXT NOT NULL CHECK(collateral_type IN ('XEC', 'FIRMA', 'XECX')),
    collateral_amount REAL NOT NULL,
    collateral_value_usd REAL NOT NULL,
    
    -- Loan
    borrowed_type TEXT NOT NULL CHECK(borrowed_type IN ('XEC', 'FIRMA')),
    borrowed_amount REAL NOT NULL,
    borrowed_value_usd REAL NOT NULL,
    
    -- Interest
    interest_rate REAL NOT NULL,
    accrued_interest REAL DEFAULT 0,
    last_interest_update DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    -- LTV tracking
    initial_ltv REAL NOT NULL,
    current_ltv REAL NOT NULL,
    
    -- XECX staking yield on collateral
    staking_yield_earned REAL DEFAULT 0,
    
    -- Escrow
    escrow_wallet_id TEXT,
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    closed_at DATETIME,
    
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (escrow_wallet_id) REFERENCES escrow_wallets(id)
);

-- Transactions table - all financial movements
CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    loan_id TEXT,
    
    type TEXT NOT NULL CHECK(type IN (
        'deposit_xec', 'deposit_usdt', 'deposit_firma',
        'withdraw_xec', 'withdraw_firma',
        'borrow', 'repay', 'add_collateral', 'withdraw_collateral',
        'liquidation', 'interest_payment', 'staking_reward',
        'firma_swap'
    )),
    
    asset TEXT NOT NULL,
    amount REAL NOT NULL,
    value_usd REAL,
    
    -- Blockchain reference
    tx_hash TEXT,
    blockchain TEXT CHECK(blockchain IN ('ecash', 'solana')),
    
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'confirmed', 'failed')),
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (loan_id) REFERENCES loans(id)
);

-- Escrow wallets - platform-controlled transparency addresses
CREATE TABLE IF NOT EXISTS escrow_wallets (
    id TEXT PRIMARY KEY,
    address TEXT NOT NULL UNIQUE,
    wallet_type TEXT NOT NULL CHECK(wallet_type IN ('collateral', 'lending_pool', 'staking')),
    balance_xec REAL DEFAULT 0,
    balance_firma REAL DEFAULT 0,
    balance_xecx REAL DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Staking pool - XECX staking state
CREATE TABLE IF NOT EXISTS staking_pool (
    id TEXT PRIMARY KEY DEFAULT 'main',
    platform_base_xecx REAL DEFAULT 0,
    user_contributed_xecx REAL DEFAULT 0,
    total_xecx REAL DEFAULT 0,
    last_reward_distribution DATETIME,
    total_rewards_distributed REAL DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Price cache - for oracle fallback
CREATE TABLE IF NOT EXISTS price_cache (
    asset TEXT PRIMARY KEY,
    price_usd REAL NOT NULL,
    source TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Margin call alerts
CREATE TABLE IF NOT EXISTS margin_calls (
    id TEXT PRIMARY KEY,
    loan_id TEXT NOT NULL,
    ltv_at_alert REAL NOT NULL,
    alert_type TEXT CHECK(alert_type IN ('warning', 'critical')),
    acknowledged INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (loan_id) REFERENCES loans(id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_loans_user ON loans(user_id);
CREATE INDEX IF NOT EXISTS idx_loans_status ON loans(status);
CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_loan ON transactions(loan_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);

-- Initialize staking pool
INSERT OR IGNORE INTO staking_pool (id, platform_base_xecx, total_xecx) 
VALUES ('main', 50000, 50000);

-- Initialize price cache with defaults
INSERT OR IGNORE INTO price_cache (asset, price_usd, source) VALUES 
('XEC', 0.00003, 'default'),
('FIRMA', 1.0, 'pegged'),
('XECX', 0.00003, 'default');
