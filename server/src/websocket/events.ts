/**
 * WebSocket Events
 * Real-time broadcasts for balance updates, LTV changes, margin calls, liquidations
 */

import { WebSocket, WebSocketServer } from 'ws';

// Map of userId -> WebSocket connections
const userConnections: Map<string, Set<WebSocket>> = new Map();
let wss: WebSocketServer | null = null;

/**
 * Initialize WebSocket server
 */
export function initWebSocket(server: WebSocketServer): void {
    wss = server;

    wss.on('connection', (ws: WebSocket) => {
        let userId: string | null = null;

        ws.on('message', (message: Buffer) => {
            try {
                const data = JSON.parse(message.toString());

                // Handle authentication
                if (data.type === 'auth' && data.userId) {
                    userId = data.userId;

                    if (userId && !userConnections.has(userId)) {
                        userConnections.set(userId, new Set());
                    }
                    if (userId) userConnections.get(userId)!.add(ws);

                    ws.send(JSON.stringify({ type: 'auth:success' }));
                    console.log(`🔌 User ${userId} connected via WebSocket`);
                }
            } catch (error) {
                console.error('WebSocket message error:', error);
            }
        });

        ws.on('close', () => {
            if (userId && userConnections.has(userId)) {
                userConnections.get(userId)!.delete(ws);
                if (userConnections.get(userId)!.size === 0) {
                    userConnections.delete(userId);
                }
                console.log(`🔌 User ${userId} disconnected`);
            }
        });

        ws.on('error', (error) => {
            console.error('WebSocket error:', error);
        });
    });
}

/**
 * Send message to specific user
 */
export function broadcastToUser(userId: string, event: string, data: unknown): void {
    const connections = userConnections.get(userId);
    if (!connections) return;

    const message = JSON.stringify({ type: event, data, timestamp: Date.now() });

    connections.forEach((ws) => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(message);
        }
    });
}

/**
 * Broadcast to all connected users
 */
export function broadcastToAll(event: string, data: unknown): void {
    if (!wss) return;

    const message = JSON.stringify({ type: event, data, timestamp: Date.now() });

    wss.clients.forEach((ws) => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(message);
        }
    });
}

/**
 * Balance update event
 */
export function broadcastBalanceUpdate(
    userId: string,
    balances: { xec: number; firma: number; xecx: number }
): void {
    broadcastToUser(userId, 'balance:update', balances);
}

/**
 * LTV update event
 */
export function broadcastLTVUpdate(
    userId: string,
    loanId: string,
    ltv: number
): void {
    broadcastToUser(userId, 'loan:ltv:update', { loanId, ltv });
}

/**
 * Margin call event
 */
export function broadcastMarginCall(
    userId: string,
    loanId: string,
    ltv: number
): void {
    broadcastToUser(userId, 'loan:margin-call', {
        loanId,
        ltv,
        message: `⚠️ Margin call: Your loan LTV is ${ltv.toFixed(1)}%. Add collateral to avoid liquidation.`
    });
}

/**
 * Liquidation event
 */
export function broadcastLiquidation(
    userId: string,
    loanId: string,
    details: {
        collateralSold: number;
        debtCovered: number;
        fee: number;
        returned: number;
    }
): void {
    broadcastToUser(userId, 'loan:liquidation', { loanId, ...details });
}

/**
 * Escrow transaction event (broadcast to all)
 */
export function broadcastEscrowTransaction(transaction: {
    id: string;
    type: string;
    asset: string;
    amount: number;
    txHash?: string;
}): void {
    broadcastToAll('escrow:transaction', transaction);
}

/**
 * Price update event (broadcast to all)
 */
export function broadcastPriceUpdate(prices: Record<string, number>): void {
    broadcastToAll('prices:update', prices);
}
