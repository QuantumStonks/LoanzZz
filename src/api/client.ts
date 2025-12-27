/**
 * API Client for LoanzZz Backend
 */

const API_BASE = '/api';
const WS_URL = `ws://${window.location.hostname}:3001/ws`;

// Types
export interface User {
    id: string;
    ecashAddress: string | null;
    solanaAddress: string | null;
    balances: {
        xec: number;
        firma: number;
        xecx: number;
    };
    stakingRewardsEarned: number;
}

export interface Loan {
    id: string;
    status: 'active' | 'margin_call' | 'repaid' | 'liquidated';
    collateral: {
        type: string;
        amount: number;
        valueUsd: number;
    };
    borrowed: {
        type: string;
        amount: number;
        valueUsd: number;
    };
    accruedInterest: number;
    totalDebt: number;
    ltv: number;
    stakingYieldEarned: number;
    createdAt: string;
}

export interface Prices {
    XEC: number;
    XECX: number;
    FIRMA: number;
}

export interface EscrowSummary {
    loans: { total: number; active: number };
    collateral: { xec: number; firma: number; totalUsd: number };
    borrowed: { xec: number; firma: number; totalUsd: number };
    staking: {
        totalPool: number;
        estimatedAPY: number;
    };
    prices: Prices;
    healthRatio: string;
}

// API Functions
async function request<T>(path: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...options?.headers
        }
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(error.error || 'Request failed');
    }

    return response.json();
}

// Auth
export async function authWithEcash(address: string): Promise<{ success: boolean; user: User }> {
    return request('/auth/ecash', {
        method: 'POST',
        body: JSON.stringify({ address })
    });
}

export async function authWithSolana(address: string): Promise<{ success: boolean; user: User }> {
    return request('/auth/solana', {
        method: 'POST',
        body: JSON.stringify({ address })
    });
}

export async function getUser(userId: string): Promise<User> {
    return request(`/auth/user/${userId}`);
}

// Prices
export async function getPrices(): Promise<Prices> {
    return request('/prices');
}

// Loans
export async function getLoanConfig(): Promise<{
    initialLTV: number;
    marginCallLTV: number;
    liquidationLTV: number;
    hourlyInterestRate: number;
}> {
    return request('/loans/config');
}

export async function calculateLoan(
    collateralType: string,
    collateralAmount: number,
    borrowType: string
): Promise<{
    collateral: { type: string; amount: number; valueUsd: number };
    maxBorrow: { type: string; amount: number; valueUsd: number };
    maxLTV: number;
}> {
    return request('/loans/calculate', {
        method: 'POST',
        body: JSON.stringify({ collateralType, collateralAmount, borrowType })
    });
}

export async function createLoan(
    userId: string,
    collateralType: string,
    collateralAmount: number,
    borrowedType: string,
    borrowedAmount: number
): Promise<{ success: boolean; loan: Loan }> {
    return request('/loans', {
        method: 'POST',
        body: JSON.stringify({ userId, collateralType, collateralAmount, borrowedType, borrowedAmount })
    });
}

export async function getUserLoans(userId: string): Promise<{
    loans: Loan[];
    stakingShare: number;
    summary: { totalCollateralUsd: number; totalBorrowedUsd: number; activeLoans: number };
}> {
    return request(`/loans/user/${userId}`);
}

export async function repayLoan(
    loanId: string,
    userId: string,
    amount: number
): Promise<{ success: boolean; remainingDebt: number; isFullyRepaid: boolean }> {
    return request(`/loans/${loanId}/repay`, {
        method: 'POST',
        body: JSON.stringify({ userId, amount })
    });
}

export async function addCollateral(
    loanId: string,
    userId: string,
    amount: number
): Promise<{ success: boolean; newLTV: number }> {
    return request(`/loans/${loanId}/add-collateral`, {
        method: 'POST',
        body: JSON.stringify({ userId, amount })
    });
}

// Deposits
export async function depositXEC(
    userId: string,
    amount: number,
    txHash?: string
): Promise<{ success: boolean; newBalance: number }> {
    return request('/deposits/xec', {
        method: 'POST',
        body: JSON.stringify({ userId, amount, txHash })
    });
}

export async function depositUSDT(
    userId: string,
    amount: number,
    signature?: string
): Promise<{ success: boolean; firmaAmount: number }> {
    return request('/deposits/usdt-solana', {
        method: 'POST',
        body: JSON.stringify({ userId, amount, signature })
    });
}

// Escrow
export async function getEscrowSummary(): Promise<EscrowSummary> {
    return request('/escrow/summary');
}

export async function getEscrowWallets(): Promise<{
    wallets: Array<{
        id: string;
        address: string;
        type: string;
        balances: { xec: number; firma: number };
        explorerUrl: string;
    }>;
}> {
    return request('/escrow/wallets');
}

export async function getEscrowTransactions(limit = 20): Promise<{
    transactions: Array<{
        id: string;
        type: string;
        asset: string;
        amount: number;
        timestamp: string;
        explorerUrl: string | null;
    }>;
}> {
    return request(`/escrow/transactions?limit=${limit}`);
}

// WebSocket
export type WSEventHandler = (data: unknown) => void;

class WebSocketClient {
    private ws: WebSocket | null = null;
    private handlers: Map<string, Set<WSEventHandler>> = new Map();
    private userId: string | null = null;
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 5;

    connect(userId: string): void {
        this.userId = userId;
        this.ws = new WebSocket(WS_URL);

        this.ws.onopen = () => {
            console.log('🔌 WebSocket connected');
            this.reconnectAttempts = 0;
            this.ws?.send(JSON.stringify({ type: 'auth', userId }));
        };

        this.ws.onmessage = (event) => {
            try {
                const { type, data } = JSON.parse(event.data);
                const eventHandlers = this.handlers.get(type);
                if (eventHandlers) {
                    eventHandlers.forEach(handler => handler(data));
                }
            } catch (error) {
                console.error('WebSocket message error:', error);
            }
        };

        this.ws.onclose = () => {
            console.log('🔌 WebSocket disconnected');
            if (this.reconnectAttempts < this.maxReconnectAttempts && this.userId) {
                this.reconnectAttempts++;
                setTimeout(() => this.connect(this.userId!), 2000 * this.reconnectAttempts);
            }
        };

        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
        };
    }

    disconnect(): void {
        this.ws?.close();
        this.ws = null;
        this.userId = null;
    }

    on(event: string, handler: WSEventHandler): () => void {
        if (!this.handlers.has(event)) {
            this.handlers.set(event, new Set());
        }
        this.handlers.get(event)!.add(handler);

        return () => {
            this.handlers.get(event)?.delete(handler);
        };
    }
}

export const wsClient = new WebSocketClient();
