import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useEffect } from 'react';
import Header from './components/Header';
import Home from './pages/Home';
import DashboardPage from './pages/DashboardPage';
import EscrowPage from './pages/EscrowPage';
import ApiDocsPage from './pages/ApiDocsPage';
import WalletModal from './components/WalletModal';
import CreateLoanModal from './components/CreateLoanModal';
import DepositModal from './components/DepositModal';
import { useWalletStore, usePriceStore, useLoanStore, useUIStore } from './stores';
import { getPrices, getUserLoans, wsClient } from './api/client';

function App() {
    const { user } = useWalletStore();
    const { setPrices } = usePriceStore();
    const { setLoans } = useLoanStore();
    const { isWalletModalOpen, isCreateLoanModalOpen, isDepositModalOpen } = useUIStore();

    // Fetch prices on mount
    useEffect(() => {
        const fetchPrices = async () => {
            try {
                const prices = await getPrices();
                setPrices(prices);
            } catch (error) {
                console.error('Failed to fetch prices:', error);
            }
        };

        fetchPrices();
        const interval = setInterval(fetchPrices, 60000); // Update every minute
        return () => clearInterval(interval);
    }, [setPrices]);

    // Fetch loans when user connects
    useEffect(() => {
        if (user) {
            const fetchLoans = async () => {
                try {
                    const result = await getUserLoans(user.id);
                    setLoans(result.loans);
                } catch (error) {
                    console.error('Failed to fetch loans:', error);
                }
            };

            fetchLoans();
            wsClient.connect(user.id);

            // Listen for real-time updates
            const unsubBalance = wsClient.on('balance:update', (data: any) => {
                useWalletStore.getState().updateBalances(data);
            });

            const unsubLTV = wsClient.on('loan:ltv:update', (data: any) => {
                useLoanStore.getState().updateLoan(data.loanId, { ltv: data.ltv });
            });

            const unsubPrices = wsClient.on('prices:update', (data: any) => {
                setPrices(data);
            });

            return () => {
                wsClient.disconnect();
                unsubBalance();
                unsubLTV();
                unsubPrices();
            };
        }
    }, [user, setLoans, setPrices]);

    return (
        <BrowserRouter>
            <Header />
            <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/escrow" element={<EscrowPage />} />
                <Route path="/api" element={<ApiDocsPage />} />
            </Routes>

            {/* Modals */}
            {isWalletModalOpen && <WalletModal />}
            {isCreateLoanModalOpen && <CreateLoanModal />}
            {isDepositModalOpen && <DepositModal />}
        </BrowserRouter>
    );
}

export default App;
