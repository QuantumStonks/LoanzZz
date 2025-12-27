/**
 * Price Oracle Service
 * Multi-source price feeds for XEC, FIRMA, and XECX
 */

import { queryOne, execute } from '../db/database.js';

interface PriceCache {
    asset: string;
    price_usd: number;
    source: string;
    updated_at: string;
}

interface CoinGeckoResponse {
    ecash?: { usd: number };
}

const PRICE_CACHE_TTL = 60 * 1000; // 1 minute cache
const priceMemoryCache: Map<string, { price: number; timestamp: number }> = new Map();

/**
 * Get current USD price for an asset
 */
export async function getPrice(asset: string): Promise<number> {
    // FIRMA is always $1 USD (pegged stablecoin)
    if (asset === 'FIRMA') {
        return 1.0;
    }

    // Check memory cache first
    const cached = priceMemoryCache.get(asset);
    if (cached && Date.now() - cached.timestamp < PRICE_CACHE_TTL) {
        return cached.price;
    }

    try {
        // Fetch from CoinGecko for XEC
        if (asset === 'XEC' || asset === 'XECX') {
            const price = await fetchXECPrice();

            // Cache in memory and database
            priceMemoryCache.set(asset, { price, timestamp: Date.now() });
            updatePriceCache(asset, price, 'coingecko');

            return price;
        }
    } catch (error) {
        console.error(`Failed to fetch price for ${asset}:`, error);
    }

    // Fallback to database cache
    const dbCache = queryOne<PriceCache>(
        'SELECT * FROM price_cache WHERE asset = ?',
        [asset]
    );

    if (dbCache) {
        priceMemoryCache.set(asset, { price: dbCache.price_usd, timestamp: Date.now() });
        return dbCache.price_usd;
    }

    // Last resort defaults
    const defaults: Record<string, number> = {
        'XEC': 0.00003,
        'XECX': 0.00003,
        'FIRMA': 1.0
    };

    return defaults[asset] || 0;
}

/**
 * Fetch XEC price from CoinGecko
 */
async function fetchXECPrice(): Promise<number> {
    const apiUrl = process.env.COINGECKO_API_URL || 'https://api.coingecko.com/api/v3';

    const response = await fetch(
        `${apiUrl}/simple/price?ids=ecash&vs_currencies=usd`,
        {
            headers: {
                'Accept': 'application/json'
            }
        }
    );

    if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.status}`);
    }

    const data = await response.json() as CoinGeckoResponse;

    if (!data.ecash?.usd) {
        throw new Error('Invalid CoinGecko response');
    }

    return data.ecash.usd;
}

/**
 * Update price in database cache
 */
function updatePriceCache(asset: string, priceUsd: number, source: string): void {
    execute(
        `INSERT OR REPLACE INTO price_cache (asset, price_usd, source, updated_at) 
         VALUES (?, ?, ?, datetime('now'))`,
        [asset, priceUsd, source]
    );
}

/**
 * Get all cached prices
 */
export function getAllPrices(): Record<string, number> {
    return {
        XEC: priceMemoryCache.get('XEC')?.price || 0.00003,
        XECX: priceMemoryCache.get('XECX')?.price || 0.00003,
        FIRMA: 1.0
    };
}

/**
 * Convert asset amount to USD value
 */
export async function toUSD(asset: string, amount: number): Promise<number> {
    const price = await getPrice(asset);
    return amount * price;
}

/**
 * Convert USD value to asset amount
 */
export async function fromUSD(asset: string, usdValue: number): Promise<number> {
    const price = await getPrice(asset);
    if (price === 0) return 0;
    return usdValue / price;
}
