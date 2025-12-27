/**
 * Global Store - Zustand state management
 */

import { create } from 'zustand';
import type { User, Loan, Prices } from '../api/client';

interface WalletState {
    user: User | null;
    isConnecting: boolean;
    walletType: 'ecash' | 'solana' | null;
    setUser: (user: User | null) => void;
    setConnecting: (connecting: boolean) => void;
    setWalletType: (type: 'ecash' | 'solana' | null) => void;
    updateBalances: (balances: { xec: number; firma: number; xecx: number }) => void;
    disconnect: () => void;
}

interface LoanState {
    loans: Loan[];
    isLoading: boolean;
    setLoans: (loans: Loan[]) => void;
    updateLoan: (loanId: string, updates: Partial<Loan>) => void;
    addLoan: (loan: Loan) => void;
    removeLoan: (loanId: string) => void;
    setLoading: (loading: boolean) => void;
}

interface PriceState {
    prices: Prices;
    lastUpdated: Date | null;
    setPrices: (prices: Prices) => void;
}

interface UIState {
    isWalletModalOpen: boolean;
    isCreateLoanModalOpen: boolean;
    isDepositModalOpen: boolean;
    setWalletModalOpen: (open: boolean) => void;
    setCreateLoanModalOpen: (open: boolean) => void;
    setDepositModalOpen: (open: boolean) => void;
}

// Wallet Store
export const useWalletStore = create<WalletState>((set) => ({
    user: null,
    isConnecting: false,
    walletType: null,
    setUser: (user) => set({ user }),
    setConnecting: (isConnecting) => set({ isConnecting }),
    setWalletType: (walletType) => set({ walletType }),
    updateBalances: (balances) => set((state) => ({
        user: state.user ? { ...state.user, balances } : null
    })),
    disconnect: () => set({ user: null, walletType: null })
}));

// Loan Store
export const useLoanStore = create<LoanState>((set) => ({
    loans: [],
    isLoading: false,
    setLoans: (loans) => set({ loans }),
    updateLoan: (loanId, updates) => set((state) => ({
        loans: state.loans.map(loan =>
            loan.id === loanId ? { ...loan, ...updates } : loan
        )
    })),
    addLoan: (loan) => set((state) => ({
        loans: [loan, ...state.loans]
    })),
    removeLoan: (loanId) => set((state) => ({
        loans: state.loans.filter(loan => loan.id !== loanId)
    })),
    setLoading: (isLoading) => set({ isLoading })
}));

// Price Store
export const usePriceStore = create<PriceState>((set) => ({
    prices: { XEC: 0.00003, XECX: 0.00003, FIRMA: 1.0 },
    lastUpdated: null,
    setPrices: (prices) => set({ prices, lastUpdated: new Date() })
}));

// UI Store
export const useUIStore = create<UIState>((set) => ({
    isWalletModalOpen: false,
    isCreateLoanModalOpen: false,
    isDepositModalOpen: false,
    setWalletModalOpen: (open) => set({ isWalletModalOpen: open }),
    setCreateLoanModalOpen: (open) => set({ isCreateLoanModalOpen: open }),
    setDepositModalOpen: (open) => set({ isDepositModalOpen: open })
}));
