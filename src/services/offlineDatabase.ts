// src/services/offlineDatabase.ts
import SQLite from 'react-native-sqlite-storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { normalizeEmail } from '../utils/loginCredentials';
import { notifyHeaderRefresh } from '../utils/headerRefresh';

SQLite.DEBUG(true);
SQLite.enablePromise(true);

const DATABASE_NAME = 'edairy_offline.db';
const DATABASE_VERSION = '1.6';
const DATABASE_DISPLAY_NAME = 'eDairy Offline Database';
const DATABASE_SIZE = 200000;

let database: SQLite.SQLiteDatabase | null = null;

// Initialize database
export const initDatabase = async (): Promise<SQLite.SQLiteDatabase> => {
    try {
        if (!database) {
            console.log('[DB] Opening database...');
            database = await SQLite.openDatabase(
                DATABASE_NAME,
                DATABASE_VERSION,
                DATABASE_DISPLAY_NAME,
                DATABASE_SIZE
            );
            console.log('[DB] Database opened successfully');
        } else {
            console.log('[DB] Database already initialized — applying pending migrations');
        }

        await createTables();
        return database;
    } catch (error) {
        console.error('[DB] Error initializing database:', error);
        throw error;
    }
};

// Create tables
const createTables = async () => {
    try {
        if (!database) throw new Error('Database not initialized');

        console.log('[DB] Creating tables...');

        // Unified offline transaction queue (all endpoints share this table)
        await database.executeSql(`
            CREATE TABLE IF NOT EXISTS offline_collections (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                endpoint TEXT NOT NULL,
                method TEXT NOT NULL DEFAULT 'POST',
                data TEXT NOT NULL,
                summary_label TEXT,
                synced INTEGER DEFAULT 0,
                retries INTEGER DEFAULT 0,
                error_message TEXT,
                last_attempt_at TEXT,
                created_at TEXT NOT NULL
            );
        `);

        // Settings table for storing user preferences and offline credentials
        await database.executeSql(`
            CREATE TABLE IF NOT EXISTS settings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                measuring_can_id INTEGER,
                measuring_can_name TEXT,
                measuring_can_tare_weight REAL,
                is_transporter INTEGER DEFAULT 0,
                transporter_id INTEGER,
                offline_phone_number TEXT,
                offline_password TEXT,
                offline_token TEXT,
                offline_user_data TEXT,
                offline_credentials_updated_at TEXT,
                updated_at TEXT NOT NULL
            );
        `);

        console.log('[DB] Settings table created/verified');

        // Verify and add offline credential columns if they don't exist
        const requiredColumns = [
            'offline_phone_number',
            'offline_username',
            'offline_email',
            'offline_password',
            'offline_token',
            'offline_user_data',
            'offline_credentials_updated_at'
        ];

        for (const columnName of requiredColumns) {
            try {
                // Check if column exists
                const checkResult = await database.executeSql(`
                    PRAGMA table_info(settings)
                `);

                const columnExists = checkResult[0].rows.raw().some((col: any) => col.name === columnName);

                if (!columnExists) {
                    console.log(`[DB] Adding missing column: ${columnName}`);
                    await database.executeSql(`ALTER TABLE settings ADD COLUMN ${columnName} TEXT`);
                    console.log(`[DB] Successfully added column ${columnName}`);
                } else {
                    console.log(`[DB] Column ${columnName} already exists`);
                }
            } catch (error: any) {
                console.warn(`[DB] Error checking/adding column ${columnName}:`, error?.message || error);
            }
        }

        // Shifts table for offline use
        await database.executeSql(`
            CREATE TABLE IF NOT EXISTS shifts (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                time TEXT,
                created_at TEXT NOT NULL
            );
        `);

        // Measuring cans table for offline use
        await database.executeSql(`
            CREATE TABLE IF NOT EXISTS measuring_cans (
                id INTEGER PRIMARY KEY,
                can_id TEXT NOT NULL,
                tare_weight REAL NOT NULL,
                transporter_id INTEGER,
                created_at TEXT NOT NULL
            );
        `);

        await database.executeSql(`
            CREATE TABLE IF NOT EXISTS transporters (
                id INTEGER PRIMARY KEY,
                data_json TEXT NOT NULL,
                synced_at TEXT NOT NULL
            );
        `);

        await database.executeSql(`
            CREATE TABLE IF NOT EXISTS members (
                id INTEGER PRIMARY KEY,
                member_no TEXT,
                data_json TEXT NOT NULL,
                synced_at TEXT NOT NULL
            );
        `);

        await database.executeSql(`
            CREATE INDEX IF NOT EXISTS idx_members_member_no ON members(member_no);
        `);

        await database.executeSql(`
            CREATE TABLE IF NOT EXISTS routes (
                id INTEGER PRIMARY KEY,
                data_json TEXT NOT NULL,
                synced_at TEXT NOT NULL
            );
        `);

        await ensureRouteCentersTableSchema(database);

        await database.executeSql(`
            CREATE INDEX IF NOT EXISTS idx_route_centers_route_id ON route_centers(route_id);
        `);

        await database.executeSql(`
            CREATE TABLE IF NOT EXISTS reference_sync (
                key TEXT PRIMARY KEY,
                synced_at TEXT NOT NULL,
                record_counts TEXT
            );
        `);

        await database.executeSql(`
            CREATE TABLE IF NOT EXISTS offline_collection_drafts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_json TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
        `);

        await database.executeSql(`
            CREATE TABLE IF NOT EXISTS customers (
                id INTEGER PRIMARY KEY,
                data_json TEXT NOT NULL,
                synced_at TEXT NOT NULL
            );
        `);

        await database.executeSql(`
            CREATE TABLE IF NOT EXISTS stores (
                id INTEGER PRIMARY KEY,
                data_json TEXT NOT NULL,
                synced_at TEXT NOT NULL
            );
        `);

        await database.executeSql(`
            CREATE TABLE IF NOT EXISTS store_stocks (
                store_id INTEGER NOT NULL,
                stock_id INTEGER NOT NULL,
                data_json TEXT NOT NULL,
                synced_at TEXT NOT NULL,
                PRIMARY KEY (store_id, stock_id)
            );
        `);

        console.log('[DB] Tables created successfully');
        await ensureOfflineCollectionsSchemaColumns(database);
        await ensureOfflineCollectionsUnifiedSchema(database);
    } catch (error) {
        console.error('[DB] Error creating tables:', error);
        throw error;
    }
};

async function tableExists(db: SQLite.SQLiteDatabase, tableName: string): Promise<boolean> {
    const result = await db.executeSql(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
        [tableName]
    );
    return result[0].rows.length > 0;
}

async function columnExists(
    db: SQLite.SQLiteDatabase,
    tableName: string,
    columnName: string
): Promise<boolean> {
    const result = await db.executeSql(`PRAGMA table_info(${tableName})`);
    for (let i = 0; i < result[0].rows.length; i++) {
        if (result[0].rows.item(i).name === columnName) {
            return true;
        }
    }
    return false;
}

const OFFLINE_COLLECTIONS_SCHEMA_MIGRATION_KEY = 'offline_collections_unified_schema_v2';

async function hasOfflineCollectionsSchemaMigrationCompleted(): Promise<boolean> {
    try {
        const db = database || await initDatabase();
        const result = await db.executeSql(
            'SELECT key FROM reference_sync WHERE key = ?',
            [OFFLINE_COLLECTIONS_SCHEMA_MIGRATION_KEY]
        );
        return result[0].rows.length > 0;
    } catch {
        return false;
    }
}

async function markOfflineCollectionsSchemaMigrationCompleted(): Promise<void> {
    const db = database || await initDatabase();
    const now = new Date().toISOString();
    await db.executeSql(
        `INSERT OR REPLACE INTO reference_sync (key, synced_at, record_counts)
         VALUES (?, ?, ?)`,
        [OFFLINE_COLLECTIONS_SCHEMA_MIGRATION_KEY, now, JSON.stringify({ migrated: true })]
    );
}

async function insertOfflineCollectionRow(
    db: SQLite.SQLiteDatabase,
    row: {
        user_id?: number | null;
        endpoint: string;
        method: string;
        data: string;
        summary_label?: string | null;
        synced?: number;
        retries?: number;
        error_message?: string | null;
        last_attempt_at?: string | null;
        created_at: string;
    },
    targetTable: 'offline_collections' | 'offline_collections_unified' = 'offline_collections'
): Promise<void> {
    const hasUserIdColumn = await columnExists(db, targetTable, 'user_id');

    if (hasUserIdColumn) {
        await db.executeSql(
            `INSERT INTO ${targetTable} (
                user_id, endpoint, method, data, summary_label, synced, retries,
                error_message, last_attempt_at, created_at
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                row.user_id ?? null,
                row.endpoint,
                row.method,
                row.data,
                row.summary_label ?? null,
                row.synced ?? 0,
                row.retries ?? 0,
                row.error_message ?? null,
                row.last_attempt_at ?? null,
                row.created_at,
            ]
        );
        return;
    }

    await db.executeSql(
        `INSERT INTO ${targetTable} (
            endpoint, method, data, summary_label, synced, retries,
            error_message, last_attempt_at, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            row.endpoint,
            row.method,
            row.data,
            row.summary_label ?? null,
            row.synced ?? 0,
            row.retries ?? 0,
            row.error_message ?? null,
            row.last_attempt_at ?? null,
            row.created_at,
        ]
    );
}

const OFFLINE_COLLECTIONS_MODERN_COLUMNS = [
    'user_id',
    'endpoint',
    'method',
    'data',
    'summary_label',
    'synced',
    'retries',
    'error_message',
    'last_attempt_at',
    'created_at',
] as const;

async function offlineCollectionsHasModernSchema(
    db: SQLite.SQLiteDatabase
): Promise<boolean> {
    if (!(await tableExists(db, 'offline_collections'))) {
        return true;
    }

    if (await offlineCollectionsHasLegacyMemberKilosSchema(db)) {
        return false;
    }

    for (const columnName of OFFLINE_COLLECTIONS_MODERN_COLUMNS) {
        if (!(await columnExists(db, 'offline_collections', columnName))) {
            return false;
        }
    }

    return true;
}

async function offlineCollectionsHasLegacyMemberKilosSchema(
    db: SQLite.SQLiteDatabase
): Promise<boolean> {
    return (
        (await tableExists(db, 'offline_collections')) &&
        (await columnExists(db, 'offline_collections', 'member_number'))
    );
}

async function ensureOfflineCollectionsPendingIndex(
    db: SQLite.SQLiteDatabase
): Promise<void> {
    if (!(await offlineCollectionsHasModernSchema(db))) {
        return;
    }

    try {
        await db.executeSql(`
            CREATE INDEX IF NOT EXISTS idx_offline_collections_pending
            ON offline_collections(user_id, synced, retries, created_at)
        `);
    } catch (error) {
        console.warn('[DB] Could not create offline_collections pending index:', error);
    }
}

async function ensureOfflineCollectionsSchemaColumns(db: SQLite.SQLiteDatabase): Promise<void> {
    if (!(await tableExists(db, 'offline_collections'))) {
        return;
    }

    const columnsToAdd: Array<[string, string]> = [
        ['user_id', 'INTEGER'],
        ['endpoint', 'TEXT'],
        ['method', 'TEXT'],
        ['data', 'TEXT'],
        ['summary_label', 'TEXT'],
        ['synced', 'INTEGER DEFAULT 0'],
        ['retries', 'INTEGER DEFAULT 0'],
        ['error_message', 'TEXT'],
        ['last_attempt_at', 'TEXT'],
        ['created_at', 'TEXT'],
    ];

    for (const [columnName, columnType] of columnsToAdd) {
        if (!(await columnExists(db, 'offline_collections', columnName))) {
            console.log(`[DB] Adding ${columnName} column to offline_collections...`);
            await db.executeSql(
                `ALTER TABLE offline_collections ADD COLUMN ${columnName} ${columnType}`
            );
        }
    }

    if (await columnExists(db, 'offline_collections', 'sync_attempts')) {
        await db.executeSql(
            `UPDATE offline_collections
             SET retries = COALESCE(retries, sync_attempts, 0)
             WHERE retries IS NULL`
        );
    }

    if (await columnExists(db, 'offline_collections', 'last_sync_attempt')) {
        await db.executeSql(
            `UPDATE offline_collections
             SET last_attempt_at = COALESCE(last_attempt_at, last_sync_attempt)
             WHERE last_attempt_at IS NULL`
        );
    }

    if (await columnExists(db, 'offline_collections', 'method')) {
        await db.executeSql(
            `UPDATE offline_collections SET method = 'POST' WHERE method IS NULL OR method = ''`
        );
    }

    if (await columnExists(db, 'offline_collections', 'synced')) {
        await db.executeSql(
            `UPDATE offline_collections SET synced = 0 WHERE synced IS NULL`
        );
    }

    if (await columnExists(db, 'offline_collections', 'created_at')) {
        const now = new Date().toISOString();
        await db.executeSql(
            `UPDATE offline_collections SET created_at = ? WHERE created_at IS NULL OR created_at = ''`,
            [now]
        );
    }

    const backfillUserId = await getCurrentOfflineUserId();
    if (
        backfillUserId != null &&
        (await columnExists(db, 'offline_collections', 'user_id'))
    ) {
        await db.executeSql(
            'UPDATE offline_collections SET user_id = ? WHERE user_id IS NULL',
            [backfillUserId]
        );
    }

    await ensureOfflineCollectionsPendingIndex(db);
}

async function ensureOfflineCollectionsUnifiedSchema(db: SQLite.SQLiteDatabase): Promise<void> {
    await ensureOfflineCollectionsSchemaColumns(db);

    const schemaCurrent = await offlineCollectionsHasModernSchema(db);
    const hasEndpointColumn = await tableExists(db, 'offline_collections')
        ? await columnExists(db, 'offline_collections', 'endpoint')
        : false;

    let syncQueueHasRows = false;
    if (await tableExists(db, 'sync_queue')) {
        const syncQueueResult = await db.executeSql('SELECT COUNT(*) AS count FROM sync_queue');
        syncQueueHasRows = syncQueueResult[0].rows.item(0).count > 0;
    }

    const migrationDone = await hasOfflineCollectionsSchemaMigrationCompleted();

    if (schemaCurrent && migrationDone && !syncQueueHasRows) {
        return;
    }

    console.log('[DB] Ensuring unified offline_collections schema...');

    const hasLegacySchema = await offlineCollectionsHasLegacyMemberKilosSchema(db);

    if (!hasEndpointColumn || hasLegacySchema) {
        const migrationTargetTable = 'offline_collections_unified' as const;

        await db.executeSql(`
            CREATE TABLE IF NOT EXISTS offline_collections_unified (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                endpoint TEXT NOT NULL,
                method TEXT NOT NULL DEFAULT 'POST',
                data TEXT NOT NULL,
                summary_label TEXT,
                synced INTEGER DEFAULT 0,
                retries INTEGER DEFAULT 0,
                error_message TEXT,
                last_attempt_at TEXT,
                created_at TEXT NOT NULL
            )
        `);

        if (await tableExists(db, 'sync_queue')) {
            const syncQueueResult = await db.executeSql(
                'SELECT * FROM sync_queue ORDER BY created_at ASC'
            );
            for (let i = 0; i < syncQueueResult[0].rows.length; i++) {
                const row = syncQueueResult[0].rows.item(i);
                await insertOfflineCollectionRow(db, {
                    user_id: row.user_id ?? null,
                    endpoint: row.endpoint,
                    method: row.method || 'POST',
                    data: row.payload,
                    summary_label: row.summary_label,
                    synced: row.synced ?? 0,
                    retries: row.retries ?? 0,
                    error_message: row.error_message,
                    last_attempt_at: row.last_attempt_at,
                    created_at: row.created_at,
                }, migrationTargetTable);
            }
        }

        if (await tableExists(db, 'offline_store_sales')) {
            const storeSalesResult = await db.executeSql(
                'SELECT * FROM offline_store_sales WHERE synced = 0 ORDER BY created_at ASC'
            );
            for (let i = 0; i < storeSalesResult[0].rows.length; i++) {
                const row = storeSalesResult[0].rows.item(i);
                await insertOfflineCollectionRow(db, {
                    endpoint: OFFLINE_SYNC_ENDPOINTS.STORE_SALE,
                    method: 'POST',
                    data: row.payload_json,
                    summary_label: row.summary_label || 'Store sale',
                    synced: row.synced ?? 0,
                    retries: row.sync_attempts ?? 0,
                    error_message: row.error_message,
                    last_attempt_at: row.last_sync_attempt,
                    created_at: row.created_at,
                }, migrationTargetTable);
            }
        }

        if (await tableExists(db, 'offline_milk_deliveries')) {
            const deliveriesResult = await db.executeSql(
                'SELECT * FROM offline_milk_deliveries WHERE synced = 0 ORDER BY created_at ASC'
            );
            for (let i = 0; i < deliveriesResult[0].rows.length; i++) {
                const row = deliveriesResult[0].rows.item(i);
                await insertOfflineCollectionRow(db, {
                    endpoint: OFFLINE_SYNC_ENDPOINTS.MILK_DELIVERIES,
                    method: 'POST',
                    data: row.payload_json,
                    summary_label: row.summary_label || 'Milk delivery',
                    synced: row.synced ?? 0,
                    retries: row.sync_attempts ?? 0,
                    error_message: row.error_message,
                    last_attempt_at: row.last_sync_attempt,
                    created_at: row.created_at,
                }, migrationTargetTable);
            }
        }

        if (await tableExists(db, 'offline_collections')) {
            const legacyHasMemberNumber = await columnExists(db, 'offline_collections', 'member_number');
            if (legacyHasMemberNumber) {
                const legacyResult = await db.executeSql(
                    'SELECT * FROM offline_collections WHERE synced = 0 ORDER BY created_at ASC'
                );
                const { buildOfflineCollectionJournalPayload } = await import('./offlineSync');
                for (let i = 0; i < legacyResult[0].rows.length; i++) {
                    const collection = legacyResult[0].rows.item(i);
                    if (collection.endpoint && collection.data) {
                        continue;
                    }
                    const payload = await buildOfflineCollectionJournalPayload({
                        ...collection,
                        cans_data: JSON.parse(collection.cans_data || '[]'),
                    });
                    if (!payload) {
                        console.warn(
                            '[DB] Skipping legacy offline_collections row — invalid payload:',
                            collection.id
                        );
                        continue;
                    }
                    await insertOfflineCollectionRow(db, {
                        endpoint: OFFLINE_SYNC_ENDPOINTS.MILK_JOURNALS,
                        method: 'POST',
                        data: JSON.stringify(payload),
                        summary_label:
                            collection.member_name ||
                            collection.member_number ||
                            'Member kilos',
                        synced: collection.synced ?? 0,
                        retries: collection.sync_attempts ?? 0,
                        error_message: collection.error_message,
                        last_attempt_at: collection.last_sync_attempt,
                        created_at: collection.created_at,
                    }, migrationTargetTable);
                }
            }

            if (await columnExists(db, 'offline_collections', 'data')) {
                const unifiedResult = await db.executeSql(
                    `SELECT * FROM offline_collections
                     WHERE data IS NOT NULL AND endpoint IS NOT NULL
                     ORDER BY created_at ASC`
                );
                for (let i = 0; i < unifiedResult[0].rows.length; i++) {
                    const row = unifiedResult[0].rows.item(i);
                    await insertOfflineCollectionRow(db, {
                        user_id: row.user_id ?? null,
                        endpoint: row.endpoint,
                        method: row.method || 'POST',
                        data: row.data,
                        summary_label: row.summary_label,
                        synced: row.synced ?? 0,
                        retries: row.retries ?? row.sync_attempts ?? 0,
                        error_message: row.error_message,
                        last_attempt_at: row.last_attempt_at ?? row.last_sync_attempt,
                        created_at: row.created_at,
                    }, migrationTargetTable);
                }
            }
        }

        await db.executeSql('DROP TABLE IF EXISTS offline_collections');
        await db.executeSql(
            'ALTER TABLE offline_collections_unified RENAME TO offline_collections'
        );
    } else if (syncQueueHasRows && (await tableExists(db, 'sync_queue'))) {
        const syncQueueResult = await db.executeSql(
            'SELECT * FROM sync_queue ORDER BY created_at ASC'
        );
        for (let i = 0; i < syncQueueResult[0].rows.length; i++) {
            const row = syncQueueResult[0].rows.item(i);
            await insertOfflineCollectionRow(db, {
                user_id: row.user_id ?? null,
                endpoint: row.endpoint,
                method: row.method || 'POST',
                data: row.payload,
                summary_label: row.summary_label,
                synced: row.synced ?? 0,
                retries: row.retries ?? 0,
                error_message: row.error_message,
                last_attempt_at: row.last_attempt_at,
                created_at: row.created_at,
            });
        }
    }

    await db.executeSql('DROP TABLE IF EXISTS sync_queue');
    await db.executeSql('DROP TABLE IF EXISTS offline_store_sales');
    await db.executeSql('DROP TABLE IF EXISTS offline_milk_deliveries');

    await ensureOfflineCollectionsSchemaColumns(db);
    await ensureOfflineCollectionsPendingIndex(db);

    await markOfflineCollectionsSchemaMigrationCompleted();
    console.log('[DB] Unified offline_collections schema ready');
}

async function ensureRouteCentersTableSchema(db: SQLite.SQLiteDatabase): Promise<void> {
    try {
        const tableResult = await db.executeSql(
            "SELECT sql FROM sqlite_master WHERE type='table' AND name='route_centers'"
        );

        if (tableResult[0].rows.length === 0) {
            await db.executeSql(`
                CREATE TABLE route_centers (
                    route_id INTEGER NOT NULL,
                    id INTEGER NOT NULL,
                    data_json TEXT NOT NULL,
                    synced_at TEXT NOT NULL,
                    PRIMARY KEY (route_id, id)
                )
            `);
            console.log('[DB] Created route_centers table with composite primary key');
            return;
        }

        const createSql = String(tableResult[0].rows.item(0).sql || "");
        if (
            createSql.includes("PRIMARY KEY (route_id, id)") ||
            createSql.includes("route_id, id)")
        ) {
            return;
        }

        console.log('[DB] Migrating route_centers to composite primary key (route_id, id)...');
        await db.executeSql(`
            CREATE TABLE route_centers_migrated (
                route_id INTEGER NOT NULL,
                id INTEGER NOT NULL,
                data_json TEXT NOT NULL,
                synced_at TEXT NOT NULL,
                PRIMARY KEY (route_id, id)
            )
        `);
        await db.executeSql(`
            INSERT OR IGNORE INTO route_centers_migrated (route_id, id, data_json, synced_at)
            SELECT route_id, id, data_json, synced_at FROM route_centers
        `);
        await db.executeSql('DROP TABLE route_centers');
        await db.executeSql('ALTER TABLE route_centers_migrated RENAME TO route_centers');
        console.log('[DB] route_centers migration complete');
    } catch (error) {
        console.error('[DB] Failed to ensure route_centers schema:', error);
        throw error;
    }
}

// Close database
export const closeDatabase = async () => {
    try {
        if (database) {
            await database.close();
            database = null;
            console.log('[DB] Database closed');
        }
    } catch (error) {
        console.error('[DB] Error closing database:', error);
    }
};

export const MAX_OFFLINE_COLLECTION_RETRIES = 10;
/** @deprecated Use MAX_OFFLINE_COLLECTION_RETRIES */
export const MAX_SYNC_QUEUE_RETRIES = MAX_OFFLINE_COLLECTION_RETRIES;

/** API paths used when pushing offline_collections rows online. */
export const OFFLINE_SYNC_ENDPOINTS = {
    MILK_JOURNALS: 'milk-journals',
    STORE_SALE: 'store-sale',
    MILK_DELIVERIES: 'milk-deliveries',
} as const;

/** Resolve the app user id from a stored login payload. */
export function resolveUserIdFromStoredUser(userData: unknown): number | null {
    if (!userData || typeof userData !== 'object') {
        return null;
    }

    const user = userData as Record<string, unknown>;
    const candidates = [user.member_id, user.user_id, user.id];

    for (const value of candidates) {
        if (typeof value === 'number' && Number.isFinite(value)) {
            return value;
        }
        if (typeof value === 'string' && value.trim() && !Number.isNaN(Number(value))) {
            return Number(value);
        }
    }

    return null;
}

/** Currently logged-in user id from AsyncStorage (used for offline save/sync scoping). */
export async function getCurrentOfflineUserId(): Promise<number | null> {
    try {
        const storedUser = await AsyncStorage.getItem('user');
        if (!storedUser) {
            return null;
        }
        return resolveUserIdFromStoredUser(JSON.parse(storedUser));
    } catch (error) {
        console.error('[DB] Error resolving current offline user id:', error);
        return null;
    }
}

async function requireCurrentOfflineUserId(): Promise<number> {
    const userId = await getCurrentOfflineUserId();
    if (userId == null) {
        throw new Error('No logged-in user id available for offline data');
    }
    return userId;
}

export type InsertOfflineDataInput = {
    endpoint: string;
    data: Record<string, unknown> | unknown[] | object;
    method?: string;
    summary_label?: string;
    user_id?: number;
};

export type OfflineCollectionRecord = {
    id: number;
    user_id: number | null;
    endpoint: string;
    method: string;
    data: string;
    summary_label: string | null;
    synced: number;
    retries: number;
    error_message: string | null;
    last_attempt_at: string | null;
    created_at: string;
};

/** @deprecated Use OfflineCollectionRecord */
export type SyncQueueItem = OfflineCollectionRecord;

const mapOfflineCollectionRow = (row: any): OfflineCollectionRecord => ({
    id: row.id,
    user_id: row.user_id ?? null,
    endpoint: row.endpoint,
    method: row.method,
    data: row.data ?? row.payload ?? '',
    summary_label: row.summary_label ?? null,
    synced: row.synced,
    retries: row.retries ?? row.sync_attempts ?? 0,
    error_message: row.error_message ?? null,
    last_attempt_at: row.last_attempt_at ?? row.last_sync_attempt ?? null,
    created_at: row.created_at,
});

const parseOfflineCollectionData = (data: string): unknown => {
    try {
        return JSON.parse(data);
    } catch {
        return data;
    }
};

/** Structured debug log for offline_collections save / push. */
export const logOfflineCollectionDebug = (
    phase: 'OFFLINE_SAVE' | 'ONLINE_PUSH' | 'ONLINE_PUSH_SUCCESS' | 'ONLINE_PUSH_FAILED',
    record: OfflineCollectionRecord,
    extra?: Record<string, unknown>
): void => {
    const parsedData = parseOfflineCollectionData(record.data);

    console.log(
        `[OFFLINE-COLLECTIONS][${phase}]`,
        JSON.stringify(
            {
                timestamp: new Date().toISOString(),
                endpoint: record.endpoint,
                method: record.method,
                data: parsedData,
                sqlite_record: {
                    id: record.id,
                    user_id: record.user_id,
                    endpoint: record.endpoint,
                    method: record.method,
                    data: parsedData,
                    summary_label: record.summary_label,
                    synced: record.synced,
                    retries: record.retries,
                    error_message: record.error_message,
                    last_attempt_at: record.last_attempt_at,
                    created_at: record.created_at,
                },
                ...extra,
            },
            null,
            2
        )
    );
};

/** @deprecated Use logOfflineCollectionDebug */
export const logSyncQueueDebug = logOfflineCollectionDebug;

export const getOfflineCollectionById = async (
    id: number
): Promise<OfflineCollectionRecord | null> => {
    try {
        const db = database || await initDatabase();
        const result = await db.executeSql('SELECT * FROM offline_collections WHERE id = ?', [id]);

        if (result[0].rows.length === 0) {
            return null;
        }

        return mapOfflineCollectionRow(result[0].rows.item(0));
    } catch (error) {
        console.error('[DB] Error getting offline collection by id:', id, error);
        return null;
    }
};

/** @deprecated Use getOfflineCollectionById */
export const getSyncQueueItemById = getOfflineCollectionById;

/**
 * Save offline transaction data. All modules use this single table:
 * offline_collections (endpoint + data + sync metadata).
 */
export const insertOfflineData = async (input: InsertOfflineDataInput): Promise<number> => {
    const endpoint = input.endpoint.trim();
    const method = (input.method ?? 'POST').toUpperCase();
    const userId = input.user_id ?? (await requireCurrentOfflineUserId());

    console.warn('[OFFLINE-COLLECTIONS] insertOfflineData called', method, endpoint, 'user_id:', userId);

    try {
        const db = database || await initDatabase();
        const now = new Date().toISOString();

        const result = await db.executeSql(
            `INSERT INTO offline_collections (user_id, endpoint, method, data, summary_label, created_at)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
                userId,
                endpoint,
                method,
                JSON.stringify(input.data),
                input.summary_label || null,
                now,
            ]
        );

        let insertId = result[0].insertId;
        if (!insertId) {
            const lastRow = await db.executeSql('SELECT last_insert_rowid() AS id');
            insertId = lastRow[0].rows.item(0)?.id;
        }

        const savedRecord = insertId ? await getOfflineCollectionById(insertId) : null;

        if (savedRecord) {
            logOfflineCollectionDebug('OFFLINE_SAVE', savedRecord, {
                summary_label: input.summary_label ?? null,
            });
        } else {
            console.log(
                '[OFFLINE-COLLECTIONS][OFFLINE_SAVE]',
                JSON.stringify(
                    {
                        timestamp: new Date().toISOString(),
                        endpoint,
                        method,
                        user_id: userId,
                        data: input.data,
                        sqlite_record: null,
                        insert_id: insertId ?? null,
                        warning: 'Could not read back offline_collections row after insert',
                    },
                    null,
                    2
                )
            );
        }

        notifyHeaderRefresh();
        return insertId;
    } catch (error) {
        console.error('[DB] Error inserting offline data into offline_collections:', error);
        throw error;
    }
};

export const getRetryableOfflineCollections = async (): Promise<OfflineCollectionRecord[]> => {
    try {
        const userId = await getCurrentOfflineUserId();
        if (userId == null) {
            return [];
        }

        const db = database || await initDatabase();

        const result = await db.executeSql(
            `SELECT * FROM offline_collections
             WHERE user_id = ? AND synced = 0 AND retries < ?
             ORDER BY created_at ASC`,
            [userId, MAX_OFFLINE_COLLECTION_RETRIES]
        );

        const items: OfflineCollectionRecord[] = [];
        for (let i = 0; i < result[0].rows.length; i++) {
            items.push(mapOfflineCollectionRow(result[0].rows.item(i)));
        }

        return items;
    } catch (error) {
        console.error('[DB] Error getting retryable offline collections:', error);
        return [];
    }
};

/** @deprecated Use getRetryableOfflineCollections */
export const getRetryableSyncQueueItems = getRetryableOfflineCollections;

export const getFailedOfflineCollections = async (): Promise<OfflineCollectionRecord[]> => {
    try {
        const userId = await getCurrentOfflineUserId();
        if (userId == null) {
            return [];
        }

        const db = database || await initDatabase();

        const result = await db.executeSql(
            `SELECT * FROM offline_collections
             WHERE user_id = ? AND synced = 0 AND retries >= ?
             ORDER BY created_at ASC`,
            [userId, MAX_OFFLINE_COLLECTION_RETRIES]
        );

        const items: OfflineCollectionRecord[] = [];
        for (let i = 0; i < result[0].rows.length; i++) {
            items.push(mapOfflineCollectionRow(result[0].rows.item(i)));
        }

        return items;
    } catch (error) {
        console.error('[DB] Error getting failed offline collections:', error);
        return [];
    }
};

/** @deprecated Use getFailedOfflineCollections */
export const getFailedSyncQueueItems = getFailedOfflineCollections;

export const getRetryableOfflineCollectionCount = async (): Promise<number> => {
    try {
        const userId = await getCurrentOfflineUserId();
        if (userId == null) {
            return 0;
        }

        const db = database || await initDatabase();

        const result = await db.executeSql(
            `SELECT COUNT(*) AS count FROM offline_collections
             WHERE user_id = ? AND synced = 0 AND retries < ?`,
            [userId, MAX_OFFLINE_COLLECTION_RETRIES]
        );

        return result[0].rows.item(0).count;
    } catch (error) {
        console.error('[DB] Error getting retryable offline collection count:', error);
        return 0;
    }
};

/** @deprecated Use getRetryableOfflineCollectionCount */
export const getRetryableSyncQueueCount = getRetryableOfflineCollectionCount;

export const getFailedOfflineCollectionCount = async (): Promise<number> => {
    try {
        const userId = await getCurrentOfflineUserId();
        if (userId == null) {
            return 0;
        }

        const db = database || await initDatabase();

        const result = await db.executeSql(
            `SELECT COUNT(*) AS count FROM offline_collections
             WHERE user_id = ? AND synced = 0 AND retries >= ?`,
            [userId, MAX_OFFLINE_COLLECTION_RETRIES]
        );

        return result[0].rows.item(0).count;
    } catch (error) {
        console.error('[DB] Error getting failed offline collection count:', error);
        return 0;
    }
};

/** @deprecated Use getFailedOfflineCollectionCount */
export const getFailedSyncQueueCount = getFailedOfflineCollectionCount;

export const deleteOfflineCollectionById = async (id: number): Promise<void> => {
    try {
        const db = database || await initDatabase();

        await db.executeSql('DELETE FROM offline_collections WHERE id = ?', [id]);
        console.log('[DB] Deleted offline collection record', id);
    } catch (error) {
        console.error('[DB] Error deleting offline collection record:', error);
        throw error;
    }
};

/** @deprecated Use deleteOfflineCollectionById */
export const deleteSyncQueueItem = deleteOfflineCollectionById;

export const incrementOfflineCollectionRetry = async (
    id: number,
    errorMessage?: string
): Promise<number> => {
    try {
        const db = database || await initDatabase();
        const now = new Date().toISOString();

        await db.executeSql(
            `UPDATE offline_collections
             SET retries = retries + 1,
                 last_attempt_at = ?,
                 error_message = ?
             WHERE id = ?`,
            [now, errorMessage || null, id]
        );

        const result = await db.executeSql(
            'SELECT retries FROM offline_collections WHERE id = ?',
            [id]
        );

        return result[0].rows.item(0)?.retries ?? 0;
    } catch (error) {
        console.error('[DB] Error incrementing offline collection retry:', error);
        throw error;
    }
};

/** @deprecated Use incrementOfflineCollectionRetry */
export const incrementSyncQueueRetry = incrementOfflineCollectionRetry;

export const getAllCollections = async (): Promise<OfflineCollectionRecord[]> => {
    try {
        const userId = await getCurrentOfflineUserId();
        if (userId == null) {
            return [];
        }

        const db = database || await initDatabase();

        const result = await db.executeSql(
            'SELECT * FROM offline_collections WHERE user_id = ? ORDER BY created_at DESC',
            [userId]
        );

        const collections: OfflineCollectionRecord[] = [];
        for (let i = 0; i < result[0].rows.length; i++) {
            collections.push(mapOfflineCollectionRow(result[0].rows.item(i)));
        }

        return collections;
    } catch (error) {
        console.error('[DB] Error getting all offline collections:', error);
        throw error;
    }
};

/** @deprecated Use deleteOfflineCollectionById */
export const deleteOfflineCollection = deleteOfflineCollectionById;

/** Total unpushed rows in offline_collections (includes permanently failed). */
export const getUnsyncedCount = async (): Promise<number> => {
    try {
        const userId = await getCurrentOfflineUserId();
        if (userId == null) {
            return 0;
        }

        const db = database || await initDatabase();

        const result = await db.executeSql(
            'SELECT COUNT(*) AS count FROM offline_collections WHERE user_id = ? AND synced = 0',
            [userId]
        );

        return result[0].rows.item(0).count;
    } catch (error) {
        console.error('[DB] Error getting unsynced count:', error);
        return 0;
    }
};

/** Earliest created_at among unpushed offline_collections rows. */
export const getOldestUnpushedRecordAt = async (): Promise<string | null> => {
    try {
        const userId = await getCurrentOfflineUserId();
        if (userId == null) {
            return null;
        }

        const db = database || await initDatabase();

        const result = await db.executeSql(
            `SELECT MIN(created_at) AS oldest
             FROM offline_collections
             WHERE user_id = ? AND synced = 0`,
            [userId]
        );

        const oldest = result[0].rows.item(0)?.oldest;
        return typeof oldest === 'string' && oldest.trim() ? oldest : null;
    } catch (error) {
        console.error('[DB] Error getting oldest unpushed record:', error);
        return null;
    }
};

// Clear all synced collections
export const clearSyncedCollections = async (): Promise<number> => {
    try {
        const userId = await getCurrentOfflineUserId();
        if (userId == null) {
            return 0;
        }

        const db = database || await initDatabase();

        const result = await db.executeSql(
            'DELETE FROM offline_collections WHERE user_id = ? AND synced = 1',
            [userId]
        );

        const rowsAffected = result[0].rowsAffected;
        console.log('[DB] Cleared', rowsAffected, 'synced collections');
        return rowsAffected;
    } catch (error) {
        console.error('[DB] Error clearing synced collections:', error);
        throw error;
    }
};

export type OfflineCollectionDraftSession = {
    transporterValue: number | null;
    shiftValue: number | null;
    routeValue: number | null;
    centerValue: number | null;
    measuringCanValue: number | null;
    memberValue: number | null;
    journalCode: string;
    batchNo: string;
    entries: any[];
    totalCans: number;
    totalQuantity: number;
};

export const saveOfflineCollectionDraft = async (
    session: OfflineCollectionDraftSession
): Promise<void> => {
    try {
        const db = database || await initDatabase();
        const now = new Date().toISOString();
        const sessionJson = JSON.stringify(session);

        await db.executeSql('DELETE FROM offline_collection_drafts');
        await db.executeSql(
            'INSERT INTO offline_collection_drafts (session_json, updated_at) VALUES (?, ?)',
            [sessionJson, now]
        );
    } catch (error) {
        console.error('[DB] Error saving offline collection draft:', error);
        throw error;
    }
};

export const getOfflineCollectionDraft = async (): Promise<OfflineCollectionDraftSession | null> => {
    try {
        const db = database || await initDatabase();
        const result = await db.executeSql(
            'SELECT session_json FROM offline_collection_drafts ORDER BY updated_at DESC LIMIT 1'
        );

        if (result[0].rows.length === 0) {
            return null;
        }

        const parsed = JSON.parse(result[0].rows.item(0).session_json);
        if (!parsed || typeof parsed !== 'object') {
            return null;
        }

        return {
            transporterValue: parsed.transporterValue ?? null,
            shiftValue: parsed.shiftValue ?? null,
            routeValue: parsed.routeValue ?? null,
            centerValue: parsed.centerValue ?? null,
            measuringCanValue: parsed.measuringCanValue ?? null,
            memberValue: parsed.memberValue ?? null,
            journalCode: parsed.journalCode ?? '',
            batchNo: parsed.batchNo ?? '',
            entries: Array.isArray(parsed.entries) ? parsed.entries : [],
            totalCans: Number(parsed.totalCans ?? 0),
            totalQuantity: Number(parsed.totalQuantity ?? 0),
        };
    } catch (error) {
        console.error('[DB] Error loading offline collection draft:', error);
        return null;
    }
};

export const clearOfflineCollectionDraft = async (): Promise<void> => {
    try {
        const db = database || await initDatabase();
        await db.executeSql('DELETE FROM offline_collection_drafts');
    } catch (error) {
        console.error('[DB] Error clearing offline collection draft:', error);
        throw error;
    }
};

// Save measuring can to settings
export const saveMeasuringCan = async (data: {
    user_id?: number;
    measuring_can_id: number;
    measuring_can_name: string;
    measuring_can_tare_weight: number;
}): Promise<void> => {
    try {
        const db = database || await initDatabase();
        const now = new Date().toISOString();

        // Check if settings already exist
        const existingResult = await db.executeSql(
            'SELECT id FROM settings WHERE user_id = ? OR user_id IS NULL LIMIT 1',
            [data.user_id || null]
        );

        if (existingResult[0].rows.length > 0) {
            // Update existing settings
            await db.executeSql(
                `UPDATE settings 
                 SET measuring_can_id = ?, 
                     measuring_can_name = ?, 
                     measuring_can_tare_weight = ?,
                     updated_at = ?
                 WHERE id = ?`,
                [
                    data.measuring_can_id,
                    data.measuring_can_name,
                    data.measuring_can_tare_weight,
                    now,
                    existingResult[0].rows.item(0).id
                ]
            );
            console.log('[DB] Updated measuring can in settings');
        } else {
            // Insert new settings
            await db.executeSql(
                `INSERT INTO settings (
                    user_id, measuring_can_id, measuring_can_name, 
                    measuring_can_tare_weight, updated_at
                ) VALUES (?, ?, ?, ?, ?)`,
                [
                    data.user_id || null,
                    data.measuring_can_id,
                    data.measuring_can_name,
                    data.measuring_can_tare_weight,
                    now
                ]
            );
            console.log('[DB] Inserted measuring can in settings');
        }
    } catch (error) {
        console.error('[DB] Error saving measuring can:', error);
        throw error;
    }
};

// Save transporter status to settings
export const saveTransporterStatus = async (data: {
    user_id?: number;
    is_transporter: boolean;
    transporter_id?: number;
}): Promise<void> => {
    try {
        const db = database || await initDatabase();
        const now = new Date().toISOString();

        // Check if settings already exist
        const existingResult = await db.executeSql(
            'SELECT id FROM settings WHERE user_id = ? OR user_id IS NULL LIMIT 1',
            [data.user_id || null]
        );

        if (existingResult[0].rows.length > 0) {
            // Update existing settings
            await db.executeSql(
                `UPDATE settings 
                 SET is_transporter = ?, 
                     transporter_id = ?,
                     updated_at = ?
                 WHERE id = ?`,
                [
                    data.is_transporter ? 1 : 0,
                    data.transporter_id || null,
                    now,
                    existingResult[0].rows.item(0).id
                ]
            );
            console.log('[DB] Updated transporter status in settings');
        } else {
            // Insert new settings
            await db.executeSql(
                `INSERT INTO settings (
                    user_id, is_transporter, transporter_id, updated_at
                ) VALUES (?, ?, ?, ?)`,
                [
                    data.user_id || null,
                    data.is_transporter ? 1 : 0,
                    data.transporter_id || null,
                    now
                ]
            );
            console.log('[DB] Inserted transporter status in settings');
        }
    } catch (error) {
        console.error('[DB] Error saving transporter status:', error);
        throw error;
    }
};

// Get measuring can from settings
export const getMeasuringCan = async (user_id?: number): Promise<any | null> => {
    try {
        const db = database || await initDatabase();

        const result = await db.executeSql(
            'SELECT * FROM settings WHERE user_id = ? OR user_id IS NULL ORDER BY updated_at DESC LIMIT 1',
            [user_id || null]
        );

        if (result[0].rows.length > 0) {
            const row = result[0].rows.item(0);
            console.log('[DB] Retrieved measuring can from settings:', row.measuring_can_name);
            return {
                id: row.measuring_can_id,
                can_id: row.measuring_can_name,
                tare_weight: row.measuring_can_tare_weight,
            };
        }

        console.log('[DB] No measuring can found in settings');
        return null;
    } catch (error) {
        console.error('[DB] Error getting measuring can:', error);
        return null;
    }
};

// Get transporter status from settings
export const getTransporterStatus = async (user_id?: number): Promise<{ is_transporter: boolean; transporter_id: number | null } | null> => {
    try {
        const db = database || await initDatabase();

        const result = await db.executeSql(
            'SELECT * FROM settings WHERE user_id = ? OR user_id IS NULL ORDER BY updated_at DESC LIMIT 1',
            [user_id || null]
        );

        if (result[0].rows.length > 0) {
            const row = result[0].rows.item(0);
            const isTransporter = row.is_transporter === 1;
            console.log('[DB] Retrieved transporter status from settings:', isTransporter);
            return {
                is_transporter: isTransporter,
                transporter_id: row.transporter_id || null,
            };
        }

        console.log('[DB] No transporter status found in settings');
        return null;
    } catch (error) {
        console.error('[DB] Error getting transporter status:', error);
        return null;
    }
};

// Save shifts to SQLite (upsert — never wipe the table on empty/failed fetch)
export const saveShifts = async (shifts: any[]): Promise<void> => {
    if (!Array.isArray(shifts) || shifts.length === 0) {
        console.log('[DB] Skipping shifts save — no records to write');
        return;
    }

    try {
        const db = database || await initDatabase();
        const now = new Date().toISOString();

        for (const shift of shifts) {
            await db.executeSql(
                'INSERT OR REPLACE INTO shifts (id, name, time, created_at) VALUES (?, ?, ?, ?)',
                [shift.id, shift.name, shift.time || '', now]
            );
        }

        console.log('[DB] Upserted', shifts.length, 'shifts to database');
    } catch (error) {
        console.error('[DB] Error saving shifts:', error);
        throw error;
    }
};

// Get all shifts from SQLite
export const getShifts = async (): Promise<any[]> => {
    try {
        const db = database || await initDatabase();

        const result = await db.executeSql('SELECT * FROM shifts ORDER BY id ASC');

        const shifts: any[] = [];
        for (let i = 0; i < result[0].rows.length; i++) {
            const row = result[0].rows.item(i);
            shifts.push({
                id: row.id,
                name: row.name,
                time: row.time,
            });
        }

        console.log('[DB] Retrieved', shifts.length, 'shifts from database');
        return shifts;
    } catch (error) {
        console.error('[DB] Error getting shifts:', error);
        return [];
    }
};

// Check if shifts exist in database
export const hasShifts = async (): Promise<boolean> => {
    try {
        const db = database || await initDatabase();

        const result = await db.executeSql('SELECT COUNT(*) as count FROM shifts');
        const count = result[0].rows.item(0).count;

        return count > 0;
    } catch (error) {
        console.error('[DB] Error checking shifts:', error);
        return false;
    }
};

// Save measuring cans to SQLite (upsert — never wipe the table on empty/failed fetch)
export const saveMeasuringCans = async (measuringCans: any[]): Promise<void> => {
    if (!Array.isArray(measuringCans) || measuringCans.length === 0) {
        console.log('[DB] Skipping measuring cans save — no records to write');
        return;
    }

    try {
        const db = database || await initDatabase();
        const now = new Date().toISOString();

        for (const can of measuringCans) {
            const tareWeight = Number(can?.tare_weight ?? can?.weight ?? 0);
            await db.executeSql(
                'INSERT OR REPLACE INTO measuring_cans (id, can_id, tare_weight, transporter_id, created_at) VALUES (?, ?, ?, ?, ?)',
                [
                    can.id,
                    can.can_id || can.name || `Can ${can.id}`,
                    Number.isFinite(tareWeight) ? tareWeight : 0,
                    can.transporter_id || null,
                    now,
                ]
            );
        }

        console.log('[DB] Upserted', measuringCans.length, 'measuring cans to database');
    } catch (error) {
        console.error('[DB] Error saving measuring cans:', error);
        throw error;
    }
};

// Get all measuring cans from SQLite
export const getMeasuringCans = async (): Promise<any[]> => {
    try {
        const db = database || await initDatabase();

        const result = await db.executeSql('SELECT * FROM measuring_cans ORDER BY can_id ASC');

        const cans: any[] = [];
        for (let i = 0; i < result[0].rows.length; i++) {
            const row = result[0].rows.item(i);
            cans.push({
                id: row.id,
                can_id: row.can_id,
                tare_weight: row.tare_weight,
                transporter_id: row.transporter_id,
            });
        }

        console.log('[DB] Retrieved', cans.length, 'measuring cans from database');
        return cans;
    } catch (error) {
        console.error('[DB] Error getting measuring cans:', error);
        return [];
    }
};

// Check if measuring cans exist in database
export const hasMeasuringCans = async (): Promise<boolean> => {
    try {
        const db = database || await initDatabase();

        const result = await db.executeSql('SELECT COUNT(*) as count FROM measuring_cans');
        const count = result[0].rows.item(0).count;

        return count > 0;
    } catch (error) {
        console.error('[DB] Error checking measuring cans:', error);
        return false;
    }
};

export const MEMBER_KILOS_SYNC_KEY = 'member_kilos';
export const STORE_SALES_SYNC_KEY = 'store_sales';
export const MILK_DELIVERY_SYNC_KEY = 'milk_delivery';

export const OFFLINE_REFERENCE_SYNC_KEYS = [
    MEMBER_KILOS_SYNC_KEY,
    STORE_SALES_SYNC_KEY,
    MILK_DELIVERY_SYNC_KEY,
] as const;

function getMemberNumberFromRecord(member: any): string {
    return String(
        member?.member_no || member?.membership_no || member?.membershipNo || ''
    ).trim();
}

function parseJsonRows(result: any): any[] {
    const rows: any[] = [];
    for (let i = 0; i < result[0].rows.length; i++) {
        const row = result[0].rows.item(i);
        rows.push(JSON.parse(row.data_json || '{}'));
    }
    return rows;
}

async function upsertJsonReferenceTable(
    tableName: 'transporters' | 'members' | 'routes',
    records: any[],
    options?: { includeMemberNo?: boolean }
): Promise<number> {
    if (!Array.isArray(records) || records.length === 0) {
        console.log(`[DB] Skipping ${tableName} save — no records to write`);
        return 0;
    }

    const db = database || await initDatabase();
    const now = new Date().toISOString();
    let saved = 0;

    for (const record of records) {
        if (record?.id == null) {
            continue;
        }

        if (options?.includeMemberNo) {
            await db.executeSql(
                `INSERT OR REPLACE INTO ${tableName} (id, member_no, data_json, synced_at) VALUES (?, ?, ?, ?)`,
                [
                    record.id,
                    getMemberNumberFromRecord(record) || null,
                    JSON.stringify(record),
                    now,
                ]
            );
            saved += 1;
            continue;
        }

        await db.executeSql(
            `INSERT OR REPLACE INTO ${tableName} (id, data_json, synced_at) VALUES (?, ?, ?)`,
            [record.id, JSON.stringify(record), now]
        );
        saved += 1;
    }

    return saved;
}

export async function saveTransporters(transporters: any[]): Promise<void> {
    const count = await upsertJsonReferenceTable('transporters', transporters || []);
    if (count > 0) {
        console.log('[DB] Upserted', count, 'transporters');
    }
}

export async function getTransporters(): Promise<any[]> {
    try {
        const db = database || await initDatabase();
        const result = await db.executeSql('SELECT data_json FROM transporters ORDER BY id ASC');
        return parseJsonRows(result);
    } catch (error) {
        console.error('[DB] Error getting transporters:', error);
        return [];
    }
}

export async function saveMembers(members: any[]): Promise<void> {
    const count = await upsertJsonReferenceTable('members', members || [], {
        includeMemberNo: true,
    });
    if (count > 0) {
        console.log('[DB] Upserted', count, 'members');
    }
}

export async function getMembers(): Promise<any[]> {
    try {
        const db = database || await initDatabase();
        const result = await db.executeSql('SELECT data_json FROM members ORDER BY id ASC');
        return parseJsonRows(result);
    } catch (error) {
        console.error('[DB] Error getting members:', error);
        return [];
    }
}

export async function findMemberByNumber(memberNo: string): Promise<any | null> {
    try {
        if (!memberNo.trim()) {
            return null;
        }

        const db = database || await initDatabase();
        const normalized = memberNo.trim().toLowerCase();
        const result = await db.executeSql(
            'SELECT data_json FROM members WHERE LOWER(member_no) = ? LIMIT 1',
            [normalized]
        );

        if (result[0].rows.length === 0) {
            const members = await getMembers();
            return (
                members.find((member) => {
                    const candidate = getMemberNumberFromRecord(member).toLowerCase();
                    return candidate === normalized;
                }) ?? null
            );
        }

        return JSON.parse(result[0].rows.item(0).data_json || '{}');
    } catch (error) {
        console.error('[DB] Error finding member by number:', error);
        return null;
    }
}

export async function saveRoutes(routes: any[]): Promise<void> {
    const count = await upsertJsonReferenceTable('routes', routes || []);
    if (count > 0) {
        console.log('[DB] Upserted', count, 'routes');
    }
}

export async function getRoutes(): Promise<any[]> {
    try {
        const db = database || await initDatabase();
        const result = await db.executeSql('SELECT data_json FROM routes ORDER BY id ASC');
        return parseJsonRows(result);
    } catch (error) {
        console.error('[DB] Error getting routes:', error);
        return [];
    }
}

function resolveRouteCenterRouteId(center: any): number | null {
    const routeId = center?.route_id ?? center?.route?.id ?? center?.routeId;
    if (routeId == null) {
        return null;
    }
    return Number(routeId);
}

/** Upsert route centers grouped by route_id (used when syncing the full centers list). */
export async function saveAllRouteCenters(routeCenters: any[]): Promise<void> {
    if (!Array.isArray(routeCenters) || routeCenters.length === 0) {
        console.log('[DB] Skipping route centers bulk save — no records to write');
        return;
    }

    const byRoute = new Map<number, any[]>();
    for (const center of routeCenters) {
        if (center?.id == null) {
            continue;
        }
        const routeId = resolveRouteCenterRouteId(center);
        if (routeId == null) {
            continue;
        }
        if (!byRoute.has(routeId)) {
            byRoute.set(routeId, []);
        }
        byRoute.get(routeId)!.push(center);
    }

    for (const [routeId, centers] of byRoute) {
        await saveRouteCentersForRoute(routeId, centers);
    }
}

export async function saveRouteCentersForRoute(
    routeId: number,
    routeCenters: any[]
): Promise<void> {
    if (!Array.isArray(routeCenters) || routeCenters.length === 0) {
        console.log('[DB] Skipping route centers save — no records to write');
        return;
    }

    try {
        const db = database || await initDatabase();
        await ensureRouteCentersTableSchema(db);
        const now = new Date().toISOString();

        await db.executeSql('DELETE FROM route_centers WHERE route_id = ?', [routeId]);

        for (const center of routeCenters) {
            if (center?.id == null) {
                continue;
            }

            const payload = {
                ...center,
                route_id: center.route_id ?? center.route?.id ?? center.routeId ?? routeId,
            };

            await db.executeSql(
                'INSERT OR REPLACE INTO route_centers (route_id, id, data_json, synced_at) VALUES (?, ?, ?, ?)',
                [routeId, center.id, JSON.stringify(payload), now]
            );
        }

        console.log(
            '[DB] Saved',
            routeCenters.length,
            'route centers for route',
            routeId
        );
    } catch (error) {
        console.error('[DB] Error saving route centers:', error);
        throw error;
    }
}

export async function getRouteCenters(routeId?: number): Promise<any[]> {
    try {
        const db = database || await initDatabase();
        const result =
            routeId != null
                ? await db.executeSql(
                      'SELECT data_json FROM route_centers WHERE route_id = ? ORDER BY id ASC',
                      [routeId]
                  )
                : await db.executeSql('SELECT data_json FROM route_centers ORDER BY route_id ASC, id ASC');

        return parseJsonRows(result);
    } catch (error) {
        console.error('[DB] Error getting route centers:', error);
        return [];
    }
}

async function saveReferenceSyncMeta(
    key: string,
    recordCounts: Record<string, number>
): Promise<void> {
    const db = database || await initDatabase();
    const now = new Date().toISOString();

    await db.executeSql(
        `INSERT OR REPLACE INTO reference_sync (key, synced_at, record_counts) VALUES (?, ?, ?)`,
        [key, now, JSON.stringify(recordCounts)]
    );
}

export async function saveReferenceSyncMetaForKey(
    key: string,
    recordCounts: Record<string, number>
): Promise<void> {
    await saveReferenceSyncMeta(key, recordCounts);
}

export async function saveCustomers(customers: any[]): Promise<number> {
    if (!Array.isArray(customers) || customers.length === 0) {
        return 0;
    }

    const db = database || await initDatabase();
    const now = new Date().toISOString();
    let saved = 0;

    for (const customer of customers) {
        if (customer?.id == null) {
            continue;
        }
        await db.executeSql(
            `INSERT OR REPLACE INTO customers (id, data_json, synced_at) VALUES (?, ?, ?)`,
            [customer.id, JSON.stringify(customer), now]
        );
        saved += 1;
    }

    return saved;
}

export async function getCustomers(): Promise<any[]> {
    try {
        const db = database || await initDatabase();
        const result = await db.executeSql(
            'SELECT data_json FROM customers ORDER BY id ASC'
        );
        return parseJsonRows(result);
    } catch (error) {
        console.error('[DB] Error getting customers:', error);
        return [];
    }
}

export async function saveStores(stores: any[]): Promise<number> {
    if (!Array.isArray(stores) || stores.length === 0) {
        return 0;
    }

    const db = database || await initDatabase();
    const now = new Date().toISOString();
    let saved = 0;

    for (const store of stores) {
        if (store?.id == null) {
            continue;
        }
        await db.executeSql(
            `INSERT OR REPLACE INTO stores (id, data_json, synced_at) VALUES (?, ?, ?)`,
            [store.id, JSON.stringify(store), now]
        );
        saved += 1;
    }

    return saved;
}

export async function getStores(): Promise<any[]> {
    try {
        const db = database || await initDatabase();
        const result = await db.executeSql('SELECT data_json FROM stores ORDER BY id ASC');
        return parseJsonRows(result);
    } catch (error) {
        console.error('[DB] Error getting stores:', error);
        return [];
    }
}

export async function saveStoreStocksForStore(
    storeId: number,
    stocks: any[]
): Promise<number> {
    if (!storeId || !Array.isArray(stocks)) {
        return 0;
    }

    const db = database || await initDatabase();
    const now = new Date().toISOString();
    let saved = 0;

    await db.executeSql('DELETE FROM store_stocks WHERE store_id = ?', [storeId]);

    for (const stock of stocks) {
        const stockId = stock?.id ?? stock?.stock_id;
        if (stockId == null) {
            continue;
        }
        await db.executeSql(
            `INSERT OR REPLACE INTO store_stocks (store_id, stock_id, data_json, synced_at)
             VALUES (?, ?, ?, ?)`,
            [storeId, stockId, JSON.stringify(stock), now]
        );
        saved += 1;
    }

    return saved;
}

export async function getStoreStocks(storeId: number): Promise<any[]> {
    try {
        const db = database || await initDatabase();
        const result = await db.executeSql(
            'SELECT data_json FROM store_stocks WHERE store_id = ? ORDER BY stock_id ASC',
            [storeId]
        );
        return parseJsonRows(result);
    } catch (error) {
        console.error('[DB] Error getting store stocks:', error);
        return [];
    }
}

export async function saveStoreSalesReferenceSyncMeta(
    recordCounts: Record<string, number>
): Promise<void> {
    await saveReferenceSyncMeta(STORE_SALES_SYNC_KEY, recordCounts);
}

export async function saveMilkDeliveryReferenceSyncMeta(
    recordCounts: Record<string, number>
): Promise<void> {
    await saveReferenceSyncMeta(MILK_DELIVERY_SYNC_KEY, recordCounts);
}

export async function getReferenceDataSyncInfo(
    key: string = MEMBER_KILOS_SYNC_KEY
): Promise<{ synced_at: string; record_counts: Record<string, number> } | null> {
    try {
        const db = database || await initDatabase();
        const result = await db.executeSql(
            'SELECT synced_at, record_counts FROM reference_sync WHERE key = ? LIMIT 1',
            [key]
        );

        if (result[0].rows.length === 0) {
            return null;
        }

        const row = result[0].rows.item(0);
        return {
            synced_at: row.synced_at,
            record_counts: JSON.parse(row.record_counts || '{}'),
        };
    } catch (error) {
        console.error('[DB] Error getting reference sync info:', error);
        return null;
    }
}

export async function saveMemberKilosReferenceData(data: {
    transporters?: any[];
    members?: any[];
    routes?: any[];
    shifts?: any[];
    cans?: any[];
}): Promise<void> {
    const transporters = Array.isArray(data.transporters) ? data.transporters : [];
    const members = Array.isArray(data.members) ? data.members : [];
    const routes = Array.isArray(data.routes) ? data.routes : [];
    const shifts = Array.isArray(data.shifts) ? data.shifts : [];
    const cans = Array.isArray(data.cans) ? data.cans : [];

    await initDatabase();

    if (transporters.length > 0) {
        await saveTransporters(transporters);
    }

    if (members.length > 0) {
        await saveMembers(members);
    }

    if (routes.length > 0) {
        await saveRoutes(routes);
    }

    if (shifts.length > 0) {
        await saveShifts(shifts);
    }

    if (cans.length > 0) {
        await saveMeasuringCans(cans);
    }

    const [savedTransporters, savedMembers, savedRoutes, savedShifts, savedCans] =
        await Promise.all([
            getTransporters(),
            getMembers(),
            getRoutes(),
            getShifts(),
            getMeasuringCans(),
        ]);

    await saveMemberKilosReferenceSyncMeta({
        transporters: savedTransporters.length,
        members: savedMembers.length,
        routes: savedRoutes.length,
        shifts: savedShifts.length,
        cans: savedCans.length,
    });

    console.log('[DB] Member Kilos reference data cached for offline use');
}

export async function saveMemberKilosReferenceSyncMeta(
    recordCounts: Record<string, number>
): Promise<void> {
    await saveReferenceSyncMeta(MEMBER_KILOS_SYNC_KEY, recordCounts);
}

// Offline Credentials Management
export interface OfflineCredentials {
    phone_number?: string;
    username?: string;
    email?: string;
    password: string;
    token: string;
    user_data: any;
    stored_at: string;
}

// Store offline credentials in SQLite
export const saveOfflineCredentials = async (data: OfflineCredentials): Promise<void> => {
    try {
        console.log('[DB] Initializing database for credential storage...');
        const db = database || await initDatabase();
        console.log('[DB] Database ready, saving offline credentials for:', data.phone_number || data.username || data.email);

        // Check if we have any existing settings records
        console.log('[DB] Checking existing records...');
        const existingRecords = await db.executeSql('SELECT COUNT(*) as count FROM settings');
        const recordCount = existingRecords[0].rows.item(0).count;
        console.log('[DB] Found', recordCount, 'existing records');

        if (recordCount === 0) {
            // No records exist, insert new one
            console.log('[DB] No existing records, inserting new credentials...');
            await db.executeSql(`
                INSERT INTO settings (
                    offline_phone_number,
                    offline_username,
                    offline_email,
                    offline_password,
                    offline_token,
                    offline_user_data,
                    offline_credentials_updated_at,
                    updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                data.phone_number || null,
                data.username || null,
                data.email || null,
                data.password,
                data.token,
                JSON.stringify(data.user_data),
                data.stored_at,
                new Date().toISOString()
            ]);
            console.log('[DB] Insert completed');
        } else {
            // Records exist, update the first one
            console.log('[DB] Updating existing record with credentials...');
            await db.executeSql(`
                UPDATE settings
                SET offline_phone_number = ?,
                    offline_username = ?,
                    offline_email = ?,
                    offline_password = ?,
                    offline_token = ?,
                    offline_user_data = ?,
                    offline_credentials_updated_at = ?,
                    updated_at = ?
                WHERE id = (SELECT MIN(id) FROM settings)
            `, [
                data.phone_number || null,
                data.username || null,
                data.email || null,
                data.password,
                data.token,
                JSON.stringify(data.user_data),
                data.stored_at,
                new Date().toISOString()
            ]);
            console.log('[DB] Update completed');
        }

        console.log('[DB] Offline credentials saved successfully');

        // Verify the save worked
        const verifyResult = await db.executeSql(`
            SELECT offline_phone_number, offline_username, offline_email, offline_credentials_updated_at
            FROM settings
            WHERE offline_phone_number IS NOT NULL
               OR offline_username IS NOT NULL
               OR offline_email IS NOT NULL
            ORDER BY offline_credentials_updated_at DESC
            LIMIT 1
        `);
        console.log('[DB] Verification query result:', verifyResult[0].rows.length, 'rows found');
        if (verifyResult[0].rows.length > 0) {
            const row = verifyResult[0].rows.item(0);
            console.log('[DB] Verification: phone =', row.offline_phone_number, 'username =', row.offline_username, 'email =', row.offline_email);
        }

    } catch (error) {
        console.error('[DB] Error saving offline credentials:', error);
        throw error;
    }
};

// Get offline credentials from SQLite
export const getOfflineCredentials = async (): Promise<OfflineCredentials | null> => {
    try {
        console.log('[DB] Getting offline credentials...');
        const db = database || await initDatabase();

        // First check if table exists and has the right structure
        console.log('[DB] Checking table structure...');
        const tableCheck = await db.executeSql(`
            SELECT sql FROM sqlite_master
            WHERE type='table' AND name='settings'
        `);
        if (tableCheck[0].rows.length > 0) {
            console.log('[DB] Settings table exists');
        } else {
            console.log('[DB] Settings table does NOT exist');
        }

        const result = await db.executeSql(`
            SELECT offline_phone_number, offline_username, offline_email, offline_password, offline_token, offline_user_data, offline_credentials_updated_at
            FROM settings
            WHERE offline_phone_number IS NOT NULL
               OR offline_username IS NOT NULL
               OR offline_email IS NOT NULL
            ORDER BY offline_credentials_updated_at DESC
            LIMIT 1
        `);

        console.log('[DB] Query result:', result[0].rows.length, 'rows found');

        if (result[0].rows.length > 0) {
            const row = result[0].rows.item(0);
            console.log('[DB] Found credentials for:', row.offline_phone_number || row.offline_username || row.offline_email);
            console.log('[DB] Token exists:', !!row.offline_token);
            return {
                phone_number: row.offline_phone_number || undefined,
                username: row.offline_username || undefined,
                email: row.offline_email || undefined,
                password: row.offline_password,
                token: row.offline_token,
                user_data: JSON.parse(row.offline_user_data || '{}'),
                stored_at: row.offline_credentials_updated_at
            };
        }

        console.log('[DB] No offline credentials found');
        return null;
    } catch (error) {
        console.error('[DB] Error getting offline credentials:', error);
        return null;
    }
};

// Check if offline credentials exist
export const hasOfflineCredentials = async (): Promise<boolean> => {
    try {
        const credentials = await getOfflineCredentials();
        return credentials !== null;
    } catch (error) {
        console.error('[DB] Error checking offline credentials:', error);
        return false;
    }
};

// Validate offline login against stored credentials
export const validateOfflineCredentials = async (
    email: string,
    password: string
): Promise<{ valid: boolean; userData?: any; token?: string }> => {
    try {
        const credentials = await getOfflineCredentials();

        if (!credentials) {
            return { valid: false };
        }

        const storedAt = new Date(credentials.stored_at);
        const now = new Date();
        const hoursDiff = (now.getTime() - storedAt.getTime()) / (1000 * 60 * 60);

        if (hoursDiff > (30 * 24)) {
            console.log('[DB] Offline credentials are too old');
            return { valid: false };
        }

        const normalizedEmail = normalizeEmail(email);
        const passwordMatches = credentials.password === password;
        const emailMatches =
            credentials.email === normalizedEmail ||
            credentials.email === email.trim();

        if (passwordMatches && emailMatches) {
            return {
                valid: true,
                userData: credentials.user_data,
                token: credentials.token
            };
        }

        return { valid: false };
    } catch (error) {
        console.error('[DB] Error validating offline credentials:', error);
        return { valid: false };
    }
};

// Clear offline credentials (used during logout)
export const clearOfflineCredentials = async (): Promise<void> => {
    try {
        const db = database || await initDatabase();

        await db.executeSql('UPDATE settings SET offline_phone_number = NULL, offline_username = NULL, offline_email = NULL, offline_password = NULL, offline_token = NULL, offline_user_data = NULL, offline_credentials_updated_at = NULL');

        console.log('[DB] Offline credentials cleared');
    } catch (error) {
        console.error('[DB] Error clearing offline credentials:', error);
        throw error;
    }
};

// Debug function to check database state
export const debugDatabaseState = async (): Promise<void> => {
    try {
        console.log('[DB] === DATABASE DEBUG INFO ===');
        const db = database || await initDatabase();

        // Check if settings table exists
        const tableCheck = await db.executeSql(`
            SELECT name FROM sqlite_master
            WHERE type='table' AND name='settings'
        `);
        console.log('[DB] Settings table exists:', tableCheck[0].rows.length > 0);

        // Check table structure
        const structureCheck = await db.executeSql('PRAGMA table_info(settings)');
        console.log('[DB] Table structure:', structureCheck[0].rows.length, 'columns');

        // List all columns
        structureCheck[0].rows.raw().forEach((col: any) => {
            console.log(`[DB] Column: ${col.name} (${col.type})`);
        });

        // Check for any settings records
        const recordsCheck = await db.executeSql('SELECT COUNT(*) as count FROM settings');
        const recordCount = recordsCheck[0].rows.item(0).count;
        console.log('[DB] Total settings records:', recordCount);

        // Check for offline credentials
        const offlineCheck = await db.executeSql(`
            SELECT COUNT(*) as count
            FROM settings
            WHERE offline_phone_number IS NOT NULL
        `);
        const offlineCount = offlineCheck[0].rows.item(0).count;
        console.log('[DB] Records with offline credentials:', offlineCount);

        if (offlineCount > 0) {
            const offlineData = await db.executeSql(`
                SELECT offline_phone_number, offline_credentials_updated_at
                FROM settings
                WHERE offline_phone_number IS NOT NULL
                ORDER BY offline_credentials_updated_at DESC
                LIMIT 1
            `);
            const row = offlineData[0].rows.item(0);
            console.log('[DB] Latest offline credentials for:', row.offline_phone_number, 'at', row.offline_credentials_updated_at);
        }

        console.log('[DB] === END DATABASE DEBUG ===');
    } catch (error) {
        console.error('[DB] Error in debug function:', error);
    }
};

