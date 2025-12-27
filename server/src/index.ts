/**
 * LoanzZz Backend Server
 * Ultra-Secure Crypto Lending Platform
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import cron from 'node-cron';

// Database
import { getDatabase } from './db/database.js';

// Routes
import authRoutes from './routes/auth.js';
import depositRoutes from './routes/deposits.js';
import loanRoutes from './routes/loans.js';
import escrowRoutes from './routes/escrow.js';

// Services
import { getPrice, getAllPrices } from './services/priceOracle.js';
import { updateAllLTVs, getActiveLoans, accrueInterest } from './services/loanEngine.js';
import { scanAndLiquidate } from './services/liquidationEngine.js';
import { distributeStakingRewards, getStakingStats } from './services/xecxStaking.js';
import { syncEscrowBalances } from './services/chronikService.js';
import { startWatchingDeposits } from './services/solanaService.js';

// WebSocket
import { initWebSocket, broadcastPriceUpdate } from './websocket/events.js';

const PORT = parseInt(process.env.PORT || '3001');
const app = express();

// Middleware
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true
}));
app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/deposits', depositRoutes);
app.use('/api/loans', loanRoutes);
app.use('/api/escrow', escrowRoutes);

// Prices endpoint
app.get('/api/prices', async (_req, res) => {
    try {
        const xecPrice = await getPrice('XEC');
        res.json({
            XEC: xecPrice,
            XECX: xecPrice, // Same as XEC
            FIRMA: 1.0, // Pegged to USD
            updatedAt: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch prices' });
    }
});

// Platform stats endpoint
app.get('/api/stats', (_req, res) => {
    try {
        const activeLoans = getActiveLoans();
        const stakingStats = getStakingStats();
        const prices = getAllPrices();

        res.json({
            activeLoans: activeLoans.length,
            totalCollateralUsd: activeLoans.reduce((sum, l) =>
                sum + l.collateral_amount * (prices[l.collateral_type] || 0), 0),
            totalBorrowedUsd: activeLoans.reduce((sum, l) =>
                sum + l.borrowed_amount * (prices[l.borrowed_type] || 0), 0),
            stakingPool: stakingStats,
            prices
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

// Create HTTP server
const server = createServer(app);

// WebSocket server
const wss = new WebSocketServer({ server, path: '/ws' });
initWebSocket(wss);

// Initialize database
console.log('🚀 Initializing LoanzZz Backend...');
getDatabase();

// Start Solana deposit watcher
startWatchingDeposits();

// ============================================
// CRON JOBS
// ============================================

// Update prices and LTVs every minute
cron.schedule('* * * * *', async () => {
    try {
        console.log('📊 Updating prices and LTVs...');

        // Fetch latest prices
        const xecPrice = await getPrice('XEC');

        // Broadcast to all clients
        broadcastPriceUpdate({
            XEC: xecPrice,
            XECX: xecPrice,
            FIRMA: 1.0
        });

        // Update all loan LTVs
        await updateAllLTVs();

        // Sync escrow balances
        await syncEscrowBalances();
    } catch (error) {
        console.error('Price/LTV update error:', error);
    }
});

// Accrue interest every hour
cron.schedule('0 * * * *', async () => {
    try {
        console.log('💰 Accruing interest on loans...');
        const activeLoans = getActiveLoans();

        for (const loan of activeLoans) {
            await accrueInterest(loan);
        }

        console.log(`✅ Accrued interest on ${activeLoans.length} loans`);
    } catch (error) {
        console.error('Interest accrual error:', error);
    }
});

// Scan for liquidations every minute
cron.schedule('* * * * *', async () => {
    try {
        const results = await scanAndLiquidate();
        if (results.length > 0) {
            console.log(`⚡ Liquidated ${results.length} loans`);
        }
    } catch (error) {
        console.error('Liquidation scan error:', error);
    }
});

// Distribute staking rewards daily at midnight UTC
cron.schedule('0 0 * * *', async () => {
    try {
        console.log('🎁 Distributing daily staking rewards...');
        const result = await distributeStakingRewards();
        console.log(`✅ Distributed ${result.totalDistributed.toFixed(2)} XEC to ${result.recipientCount} users`);
    } catch (error) {
        console.error('Staking rewards error:', error);
    }
});

// Start server
server.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🏦  LoanzZz Backend Server                              ║
║   Ultra-Secure Crypto Lending Platform                    ║
║                                                           ║
║   📡  API:        http://localhost:${PORT}/api              ║
║   🔌  WebSocket:  ws://localhost:${PORT}/ws                 ║
║   ❤️   Health:    http://localhost:${PORT}/health           ║
║                                                           ║
║   ⚙️   LTV Thresholds:                                     ║
║       • Initial:     ${process.env.INITIAL_LTV || 65}%                                ║
║       • Margin Call: ${process.env.MARGIN_CALL_LTV || 75}%                                ║
║       • Liquidation: ${process.env.LIQUIDATION_LTV || 83}%                                ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
    `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('🛑 Shutting down...');
    server.close(() => {
        process.exit(0);
    });
});
