import { useState } from 'react';

const API_BASE = 'http://localhost:3001/api';

interface Endpoint {
    method: 'GET' | 'POST';
    path: string;
    description: string;
    params?: { name: string; type: string; required: boolean; description: string }[];
    body?: { name: string; type: string; required: boolean; description: string }[];
    response: string;
    example?: { request?: string; response: string };
}

const endpoints: Record<string, Endpoint[]> = {
    'Authentication': [
        {
            method: 'POST',
            path: '/auth/ecash',
            description: 'Authenticate with eCash wallet address',
            body: [
                { name: 'address', type: 'string', required: true, description: 'eCash address (ecash:qz...)' }
            ],
            response: '{ success: boolean, user: User }',
            example: {
                request: '{"address": "ecash:qz..."}',
                response: '{"success": true, "user": {"id": "uuid", "ecashAddress": "ecash:qz...", "balances": {"xec": 0, "firma": 0, "xecx": 0}}}'
            }
        },
        {
            method: 'POST',
            path: '/auth/solana',
            description: 'Authenticate with Solana wallet address',
            body: [
                { name: 'address', type: 'string', required: true, description: 'Solana public key' }
            ],
            response: '{ success: boolean, user: User }',
            example: {
                request: '{"address": "So1ana..."}',
                response: '{"success": true, "user": {"id": "uuid", "solanaAddress": "So1ana...", "balances": {"xec": 0, "firma": 0, "xecx": 0}}}'
            }
        },
        {
            method: 'GET',
            path: '/auth/user/:id',
            description: 'Get user profile and balances',
            params: [
                { name: 'id', type: 'string', required: true, description: 'User ID (UUID)' }
            ],
            response: '{ id, ecashAddress, solanaAddress, balances, stakingRewardsEarned, createdAt }',
            example: {
                response: '{"id": "uuid", "balances": {"xec": 1000000, "firma": 500, "xecx": 0}, "stakingRewardsEarned": 123.45}'
            }
        }
    ],
    'Deposits': [
        {
            method: 'POST',
            path: '/deposits/xec',
            description: 'Record XEC deposit (called by PayButton callback)',
            body: [
                { name: 'userId', type: 'string', required: true, description: 'User ID' },
                { name: 'amount', type: 'number', required: true, description: 'XEC amount' },
                { name: 'txHash', type: 'string', required: false, description: 'Transaction hash' }
            ],
            response: '{ success: boolean, newBalance: number }',
            example: {
                request: '{"userId": "uuid", "amount": 100000, "txHash": "abc123..."}',
                response: '{"success": true, "newBalance": 100000}'
            }
        },
        {
            method: 'POST',
            path: '/deposits/usdt-solana',
            description: 'Deposit USDT (auto-converts to USD/FIRMA at 1:1)',
            body: [
                { name: 'userId', type: 'string', required: true, description: 'User ID' },
                { name: 'amount', type: 'number', required: true, description: 'USDT amount' },
                { name: 'signature', type: 'string', required: false, description: 'Solana transaction signature' }
            ],
            response: '{ success: boolean, usdtAmount: number, firmaAmount: number }',
            example: {
                request: '{"userId": "uuid", "amount": 100}',
                response: '{"success": true, "usdtAmount": 100, "firmaAmount": 100, "message": "Converted 100 USDT to 100 USD"}'
            }
        },
        {
            method: 'GET',
            path: '/deposits/:userId',
            description: 'Get deposit history for a user',
            params: [
                { name: 'userId', type: 'string', required: true, description: 'User ID' },
                { name: 'limit', type: 'number', required: false, description: 'Max results (default 20)' }
            ],
            response: '{ deposits: Transaction[] }',
            example: {
                response: '{"deposits": [{"id": "uuid", "type": "deposit_xec", "asset": "XEC", "amount": 100000}]}'
            }
        }
    ],
    'Loans': [
        {
            method: 'GET',
            path: '/loans/config',
            description: 'Get loan configuration (LTV thresholds, rates)',
            response: '{ initialLTV, marginCallLTV, liquidationLTV, hourlyInterestRate, stakingStats }',
            example: {
                response: '{"initialLTV": 65, "marginCallLTV": 75, "liquidationLTV": 83, "hourlyInterestRate": 0.0001}'
            }
        },
        {
            method: 'POST',
            path: '/loans/calculate',
            description: 'Calculate max borrow for given collateral',
            body: [
                { name: 'collateralType', type: 'string', required: true, description: 'XEC or FIRMA' },
                { name: 'collateralAmount', type: 'number', required: true, description: 'Collateral amount' },
                { name: 'borrowType', type: 'string', required: true, description: 'XEC or FIRMA' }
            ],
            response: '{ collateral, maxBorrow, maxLTV, prices }',
            example: {
                request: '{"collateralType": "XEC", "collateralAmount": 1000000, "borrowType": "FIRMA"}',
                response: '{"maxBorrow": {"amount": 19.5, "valueUsd": 19.5}, "maxLTV": 65}'
            }
        },
        {
            method: 'POST',
            path: '/loans',
            description: 'Create a new loan',
            body: [
                { name: 'userId', type: 'string', required: true, description: 'User ID' },
                { name: 'collateralType', type: 'string', required: true, description: 'XEC or FIRMA' },
                { name: 'collateralAmount', type: 'number', required: true, description: 'Amount to lock' },
                { name: 'borrowedType', type: 'string', required: true, description: 'XEC or FIRMA' },
                { name: 'borrowedAmount', type: 'number', required: true, description: 'Amount to borrow' }
            ],
            response: '{ success: boolean, loan: Loan }',
            example: {
                request: '{"userId": "uuid", "collateralType": "XEC", "collateralAmount": 1000000, "borrowedType": "FIRMA", "borrowedAmount": 15}',
                response: '{"success": true, "loan": {"id": "uuid", "status": "active", "ltv": 50}}'
            }
        },
        {
            method: 'GET',
            path: '/loans/user/:userId',
            description: 'Get all loans for a user',
            params: [{ name: 'userId', type: 'string', required: true, description: 'User ID' }],
            response: '{ loans: Loan[], stakingShare: number, summary }',
            example: {
                response: '{"loans": [...], "summary": {"totalCollateralUsd": 100, "totalBorrowedUsd": 50, "activeLoans": 2}}'
            }
        },
        {
            method: 'GET',
            path: '/loans/:id',
            description: 'Get specific loan details with live LTV',
            params: [{ name: 'id', type: 'string', required: true, description: 'Loan ID' }],
            response: '{ id, status, collateral, borrowed, interest, ltv, stakingYieldEarned }',
            example: {
                response: '{"id": "uuid", "status": "active", "ltv": {"current": 52.3, "marginCall": 75, "liquidation": 83}}'
            }
        },
        {
            method: 'POST',
            path: '/loans/:id/repay',
            description: 'Repay loan (partial or full)',
            params: [{ name: 'id', type: 'string', required: true, description: 'Loan ID' }],
            body: [
                { name: 'userId', type: 'string', required: true, description: 'User ID' },
                { name: 'amount', type: 'number', required: true, description: 'Repayment amount' }
            ],
            response: '{ success, remainingDebt, isFullyRepaid }',
            example: {
                request: '{"userId": "uuid", "amount": 10}',
                response: '{"success": true, "remainingDebt": 5.5, "isFullyRepaid": false}'
            }
        },
        {
            method: 'POST',
            path: '/loans/:id/add-collateral',
            description: 'Add collateral to reduce LTV',
            params: [{ name: 'id', type: 'string', required: true, description: 'Loan ID' }],
            body: [
                { name: 'userId', type: 'string', required: true, description: 'User ID' },
                { name: 'amount', type: 'number', required: true, description: 'Collateral to add' }
            ],
            response: '{ success, newCollateralAmount, newLTV }',
            example: {
                request: '{"userId": "uuid", "amount": 500000}',
                response: '{"success": true, "newLTV": 35.2}'
            }
        }
    ],
    'Prices': [
        {
            method: 'GET',
            path: '/prices',
            description: 'Get current asset prices in USD',
            response: '{ XEC, XECX, FIRMA, updatedAt }',
            example: {
                response: '{"XEC": 0.00003, "XECX": 0.00003, "FIRMA": 1.0, "updatedAt": "2024-..."}'
            }
        }
    ],
    'Escrow (Public)': [
        {
            method: 'GET',
            path: '/escrow/summary',
            description: 'Get platform escrow summary (fully public)',
            response: '{ loans, collateral, borrowed, staking, prices, healthRatio }',
            example: {
                response: '{"loans": {"active": 5}, "collateral": {"totalUsd": 10000}, "healthRatio": "85.00"}'
            }
        },
        {
            method: 'GET',
            path: '/escrow/wallets',
            description: 'Get escrow wallet addresses and balances',
            response: '{ wallets: EscrowWallet[] }',
            example: {
                response: '{"wallets": [{"address": "ecash:qz...", "type": "collateral", "balances": {"xec": 1000000}}]}'
            }
        },
        {
            method: 'GET',
            path: '/escrow/transactions',
            description: 'Get recent platform transactions',
            params: [{ name: 'limit', type: 'number', required: false, description: 'Max results (default 50)' }],
            response: '{ transactions: Transaction[] }',
            example: {
                response: '{"transactions": [{"type": "deposit_xec", "amount": 100000, "timestamp": "..."}]}'
            }
        },
        {
            method: 'GET',
            path: '/escrow/liquidations',
            description: 'Get recent liquidation events',
            params: [{ name: 'limit', type: 'number', required: false, description: 'Max results (default 20)' }],
            response: '{ liquidations: [], total: number }',
            example: {
                response: '{"liquidations": [], "total": 0}'
            }
        }
    ],
    'Platform Stats': [
        {
            method: 'GET',
            path: '/stats',
            description: 'Get overall platform statistics',
            response: '{ activeLoans, totalCollateralUsd, totalBorrowedUsd, stakingPool, prices }',
            example: {
                response: '{"activeLoans": 10, "totalCollateralUsd": 50000, "stakingPool": {"totalPool": 50000, "estimatedAPY": 3.65}}'
            }
        }
    ],
    'Health': [
        {
            method: 'GET',
            path: '/health',
            description: 'Check if API is running (no /api prefix)',
            response: '{ status, timestamp, version }',
            example: {
                response: '{"status": "ok", "timestamp": "2024-...", "version": "1.0.0"}'
            }
        }
    ]
};

const wsEvents = [
    { event: 'auth', direction: 'send', description: 'Authenticate WebSocket connection', payload: '{"type": "auth", "userId": "uuid"}' },
    { event: 'auth:success', direction: 'receive', description: 'Authentication successful', payload: '{"type": "auth:success"}' },
    { event: 'balance:update', direction: 'receive', description: 'User balance changed', payload: '{"type": "balance:update", "data": {"xec": 1000, "firma": 100}}' },
    { event: 'loan:ltv:update', direction: 'receive', description: 'Loan LTV changed', payload: '{"type": "loan:ltv:update", "data": {"loanId": "uuid", "ltv": 68.5}}' },
    { event: 'loan:margin-call', direction: 'receive', description: 'Margin call triggered (LTV ≥ 75%)', payload: '{"type": "loan:margin-call", "data": {"loanId": "uuid", "ltv": 76.2}}' },
    { event: 'loan:liquidation', direction: 'receive', description: 'Loan was liquidated', payload: '{"type": "loan:liquidation", "data": {"loanId": "uuid", "collateralSold": 500000}}' },
    { event: 'prices:update', direction: 'receive', description: 'Asset prices updated', payload: '{"type": "prices:update", "data": {"XEC": 0.00003, "FIRMA": 1.0}}' },
    { event: 'escrow:transaction', direction: 'receive', description: 'New escrow transaction', payload: '{"type": "escrow:transaction", "data": {"type": "deposit", "amount": 100000}}' }
];

export default function ApiDocsPage() {
    const [activeSection, setActiveSection] = useState('Authentication');
    const [copiedCode, setCopiedCode] = useState<string | null>(null);

    const copyCode = (code: string, id: string) => {
        navigator.clipboard.writeText(code);
        setCopiedCode(id);
        setTimeout(() => setCopiedCode(null), 2000);
    };

    const generateCurl = (endpoint: Endpoint) => {
        const fullUrl = endpoint.path.startsWith('/health')
            ? 'http://localhost:3001/health'
            : `${API_BASE}${endpoint.path}`;

        if (endpoint.method === 'GET') {
            return `curl -X GET "${fullUrl}"`;
        }
        return `curl -X POST "${fullUrl}" \\
  -H "Content-Type: application/json" \\
  -d '${endpoint.example?.request || '{}'}'`;
    };

    const generateJS = (endpoint: Endpoint) => {
        const fullUrl = endpoint.path.startsWith('/health')
            ? 'http://localhost:3001/health'
            : `${API_BASE}${endpoint.path}`;

        if (endpoint.method === 'GET') {
            return `const response = await fetch("${fullUrl}");
const data = await response.json();
console.log(data);`;
        }
        return `const response = await fetch("${fullUrl}", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(${endpoint.example?.request || '{}'})
});
const data = await response.json();`;
    };

    const generatePython = (endpoint: Endpoint) => {
        const fullUrl = endpoint.path.startsWith('/health')
            ? 'http://localhost:3001/health'
            : `${API_BASE}${endpoint.path}`;

        if (endpoint.method === 'GET') {
            return `import requests

response = requests.get("${fullUrl}")
print(response.json())`;
        }
        return `import requests

response = requests.post(
    "${fullUrl}",
    json=${endpoint.example?.request || '{}'}
)
print(response.json())`;
    };

    return (
        <div className="page">
            <div className="container">
                <div className="api-header">
                    <h1>🔌 API Documentation</h1>
                    <p className="text-muted">
                        Programmatic access to LoanzZz lending platform • Perfect for bots, scripts, and AI agents
                    </p>
                    <div className="api-base-url">
                        <span className="label">Base URL:</span>
                        <code>{API_BASE}</code>
                    </div>
                </div>

                <div className="api-layout">
                    {/* Sidebar */}
                    <nav className="api-nav glass-card">
                        <h3>Endpoints</h3>
                        {Object.keys(endpoints).map(section => (
                            <button
                                key={section}
                                className={`nav-item ${activeSection === section ? 'active' : ''}`}
                                onClick={() => setActiveSection(section)}
                            >
                                {section}
                                <span className="count">{endpoints[section].length}</span>
                            </button>
                        ))}
                        <button
                            className={`nav-item ${activeSection === 'WebSocket' ? 'active' : ''}`}
                            onClick={() => setActiveSection('WebSocket')}
                        >
                            WebSocket Events
                            <span className="count">{wsEvents.length}</span>
                        </button>
                    </nav>

                    {/* Content */}
                    <main className="api-content">
                        {activeSection === 'WebSocket' ? (
                            <div className="ws-section">
                                <h2>WebSocket Events</h2>
                                <p className="text-muted mb-6">
                                    Connect to <code>ws://localhost:3001/ws</code> for real-time updates
                                </p>

                                <div className="code-block mb-6">
                                    <div className="code-header">
                                        <span>JavaScript - Connect & Listen</span>
                                        <button onClick={() => copyCode(`const ws = new WebSocket("ws://localhost:3001/ws");

ws.onopen = () => {
  ws.send(JSON.stringify({ type: "auth", userId: "your-user-id" }));
};

ws.onmessage = (event) => {
  const { type, data } = JSON.parse(event.data);
  console.log("Event:", type, data);
};`, 'ws-connect')}>
                                            {copiedCode === 'ws-connect' ? '✓ Copied' : 'Copy'}
                                        </button>
                                    </div>
                                    <pre>{`const ws = new WebSocket("ws://localhost:3001/ws");

ws.onopen = () => {
  ws.send(JSON.stringify({ type: "auth", userId: "your-user-id" }));
};

ws.onmessage = (event) => {
  const { type, data } = JSON.parse(event.data);
  console.log("Event:", type, data);
};`}</pre>
                                </div>

                                {wsEvents.map((evt, i) => (
                                    <div key={i} className="ws-event glass-card">
                                        <div className="ws-event-header">
                                            <span className={`direction ${evt.direction}`}>
                                                {evt.direction === 'send' ? '→ Send' : '← Receive'}
                                            </span>
                                            <code className="event-name">{evt.event}</code>
                                        </div>
                                        <p>{evt.description}</p>
                                        <pre className="payload">{evt.payload}</pre>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            endpoints[activeSection]?.map((endpoint, i) => (
                                <div key={i} className="endpoint glass-card">
                                    <div className="endpoint-header">
                                        <span className={`method ${endpoint.method.toLowerCase()}`}>
                                            {endpoint.method}
                                        </span>
                                        <code className="path">{endpoint.path}</code>
                                    </div>

                                    <p className="description">{endpoint.description}</p>

                                    {endpoint.params && endpoint.params.length > 0 && (
                                        <div className="params-section">
                                            <h4>URL Parameters</h4>
                                            <table>
                                                <thead>
                                                    <tr><th>Name</th><th>Type</th><th>Required</th><th>Description</th></tr>
                                                </thead>
                                                <tbody>
                                                    {endpoint.params.map((p, j) => (
                                                        <tr key={j}>
                                                            <td><code>{p.name}</code></td>
                                                            <td>{p.type}</td>
                                                            <td>{p.required ? '✓' : '-'}</td>
                                                            <td>{p.description}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}

                                    {endpoint.body && endpoint.body.length > 0 && (
                                        <div className="params-section">
                                            <h4>Request Body</h4>
                                            <table>
                                                <thead>
                                                    <tr><th>Field</th><th>Type</th><th>Required</th><th>Description</th></tr>
                                                </thead>
                                                <tbody>
                                                    {endpoint.body.map((p, j) => (
                                                        <tr key={j}>
                                                            <td><code>{p.name}</code></td>
                                                            <td>{p.type}</td>
                                                            <td>{p.required ? '✓' : '-'}</td>
                                                            <td>{p.description}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}

                                    <div className="response-section">
                                        <h4>Response</h4>
                                        <code>{endpoint.response}</code>
                                    </div>

                                    {endpoint.example && (
                                        <div className="examples">
                                            <h4>Code Examples</h4>
                                            <div className="code-tabs">
                                                <div className="code-block">
                                                    <div className="code-header">
                                                        <span>cURL</span>
                                                        <button onClick={() => copyCode(generateCurl(endpoint), `curl-${i}`)}>
                                                            {copiedCode === `curl-${i}` ? '✓ Copied' : 'Copy'}
                                                        </button>
                                                    </div>
                                                    <pre>{generateCurl(endpoint)}</pre>
                                                </div>
                                                <div className="code-block">
                                                    <div className="code-header">
                                                        <span>JavaScript</span>
                                                        <button onClick={() => copyCode(generateJS(endpoint), `js-${i}`)}>
                                                            {copiedCode === `js-${i}` ? '✓ Copied' : 'Copy'}
                                                        </button>
                                                    </div>
                                                    <pre>{generateJS(endpoint)}</pre>
                                                </div>
                                                <div className="code-block">
                                                    <div className="code-header">
                                                        <span>Python</span>
                                                        <button onClick={() => copyCode(generatePython(endpoint), `py-${i}`)}>
                                                            {copiedCode === `py-${i}` ? '✓ Copied' : 'Copy'}
                                                        </button>
                                                    </div>
                                                    <pre>{generatePython(endpoint)}</pre>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </main>
                </div>
            </div>

            <style>{`
        .api-header {
          text-align: center;
          margin-bottom: var(--space-8);
        }

        .api-header h1 {
          margin-bottom: var(--space-2);
        }

        .api-base-url {
          display: inline-flex;
          align-items: center;
          gap: var(--space-2);
          padding: var(--space-2) var(--space-4);
          background: rgba(0, 212, 170, 0.1);
          border-radius: var(--radius-lg);
          margin-top: var(--space-4);
        }

        .api-base-url code {
          color: var(--color-accent-primary);
          font-weight: 600;
        }

        .api-layout {
          display: grid;
          grid-template-columns: 240px 1fr;
          gap: var(--space-6);
        }

        .api-nav {
          position: sticky;
          top: 80px;
          height: fit-content;
        }

        .api-nav h3 {
          font-size: var(--font-size-sm);
          color: var(--color-text-tertiary);
          margin-bottom: var(--space-3);
          text-transform: uppercase;
          letter-spacing: 0.1em;
        }

        .nav-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          width: 100%;
          padding: var(--space-2) var(--space-3);
          background: transparent;
          border: none;
          color: var(--color-text-secondary);
          font-size: var(--font-size-sm);
          text-align: left;
          border-radius: var(--radius-md);
          cursor: pointer;
          transition: all var(--transition-fast);
        }

        .nav-item:hover {
          background: rgba(255, 255, 255, 0.05);
          color: var(--color-text-primary);
        }

        .nav-item.active {
          background: rgba(0, 212, 170, 0.1);
          color: var(--color-accent-primary);
        }

        .nav-item .count {
          font-size: var(--font-size-xs);
          padding: 2px 6px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: var(--radius-full);
        }

        .endpoint {
          margin-bottom: var(--space-4);
        }

        .endpoint-header {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          margin-bottom: var(--space-3);
        }

        .method {
          padding: var(--space-1) var(--space-2);
          border-radius: var(--radius-sm);
          font-size: var(--font-size-xs);
          font-weight: 700;
          text-transform: uppercase;
        }

        .method.get { background: rgba(0, 212, 170, 0.2); color: var(--color-success); }
        .method.post { background: rgba(9, 132, 227, 0.2); color: var(--color-info); }

        .path {
          font-size: var(--font-size-base);
          color: var(--color-text-primary);
        }

        .description {
          color: var(--color-text-secondary);
          margin-bottom: var(--space-4);
        }

        .params-section, .response-section, .examples {
          margin-top: var(--space-4);
        }

        .params-section h4, .response-section h4, .examples h4 {
          font-size: var(--font-size-sm);
          color: var(--color-text-tertiary);
          margin-bottom: var(--space-2);
        }

        table {
          width: 100%;
          font-size: var(--font-size-sm);
          border-collapse: collapse;
        }

        th, td {
          padding: var(--space-2);
          text-align: left;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }

        th {
          color: var(--color-text-tertiary);
          font-weight: 500;
        }

        .code-tabs {
          display: flex;
          flex-direction: column;
          gap: var(--space-3);
        }

        .code-block {
          background: rgba(0, 0, 0, 0.3);
          border-radius: var(--radius-lg);
          overflow: hidden;
        }

        .code-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: var(--space-2) var(--space-3);
          background: rgba(255, 255, 255, 0.05);
          font-size: var(--font-size-xs);
          color: var(--color-text-tertiary);
        }

        .code-header button {
          background: transparent;
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: var(--color-text-secondary);
          padding: var(--space-1) var(--space-2);
          border-radius: var(--radius-sm);
          font-size: var(--font-size-xs);
          cursor: pointer;
        }

        .code-header button:hover {
          border-color: var(--color-accent-primary);
          color: var(--color-accent-primary);
        }

        pre {
          padding: var(--space-4);
          font-size: var(--font-size-sm);
          overflow-x: auto;
          color: var(--color-text-secondary);
          margin: 0;
        }

        .ws-event {
          margin-bottom: var(--space-3);
        }

        .ws-event-header {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          margin-bottom: var(--space-2);
        }

        .direction {
          font-size: var(--font-size-xs);
          padding: var(--space-1) var(--space-2);
          border-radius: var(--radius-sm);
          font-weight: 600;
        }

        .direction.send { background: rgba(9, 132, 227, 0.2); color: var(--color-info); }
        .direction.receive { background: rgba(0, 212, 170, 0.2); color: var(--color-success); }

        .event-name {
          font-size: var(--font-size-base);
        }

        .payload {
          background: rgba(0, 0, 0, 0.3);
          padding: var(--space-3);
          border-radius: var(--radius-md);
          font-size: var(--font-size-xs);
          margin-top: var(--space-2);
        }

        @media (max-width: 768px) {
          .api-layout {
            grid-template-columns: 1fr;
          }
          .api-nav {
            position: static;
          }
        }
      `}</style>
        </div>
    );
}
