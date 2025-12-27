/**
 * Database Module
 * SQLite database using sql.js (pure JS, no native compilation)
 */

// @ts-ignore - sql.js doesn't have types
import initSqlJs from 'sql.js';
import * as fs from 'fs';
import * as path from 'path';

const __dirname = path.resolve('src/db');

let db: any = null;
let dbInitPromise: Promise<any> | null = null;

const DB_PATH = process.env.DATABASE_PATH || './data/loanzzz.db';

/**
 * Initialize and get database instance
 */
export async function getDatabase(): Promise<any> {
    if (db) return db;
    if (dbInitPromise) return dbInitPromise;

    dbInitPromise = (async () => {
        const SQL = await initSqlJs();

        // Ensure data directory exists
        const dbDir = path.dirname(DB_PATH);
        if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true });
        }

        // Load existing database or create new
        if (fs.existsSync(DB_PATH)) {
            const buffer = fs.readFileSync(DB_PATH);
            db = new SQL.Database(buffer);
        } else {
            db = new SQL.Database();
        }

        // Read and execute schema
        const schemaPath = path.join(__dirname, 'schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf-8');
        db.run(schema);

        saveDatabase();
        console.log('📦 Database initialized at', DB_PATH);
        return db;
    })();

    return dbInitPromise;
}

function saveDatabase(): void {
    if (!db) return;
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
}

export function queryAll<T>(sql: string, params: unknown[] = []): T[] {
    if (!db) throw new Error('Database not initialized');
    const stmt = db.prepare(sql);
    stmt.bind(params);
    const results: T[] = [];
    while (stmt.step()) {
        results.push(stmt.getAsObject() as T);
    }
    stmt.free();
    return results;
}

export function queryOne<T>(sql: string, params: unknown[] = []): T | undefined {
    return queryAll<T>(sql, params)[0];
}

export function execute(sql: string, params: unknown[] = []): void {
    if (!db) throw new Error('Database not initialized');
    db.run(sql, params);
    saveDatabase();
}

export function transaction(fn: () => void): void {
    if (!db) throw new Error('Database not initialized');
    db.run('BEGIN TRANSACTION');
    try {
        fn();
        db.run('COMMIT');
        saveDatabase();
    } catch (error) {
        db.run('ROLLBACK');
        throw error;
    }
}
