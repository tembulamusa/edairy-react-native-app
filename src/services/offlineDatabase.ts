// src/services/offlineDatabase.ts
import SQLite from 'react-native-sqlite-storage';

SQLite.DEBUG(true);
SQLite.enablePromise(true);

const DATABASE_NAME = 'edairy_offline.db';
const DATABASE_VERSION = '1.1';
const DATABASE_DISPLAY_NAME = 'eDairy Offline Database';
const DATABASE_SIZE = 200000;

let database: SQLite.SQLiteDatabase | null = null;

// Initialize database
export const initDatabase = async (): Promise<SQLite.SQLiteDatabase> => {
    try {
        if (database) {
            console.log('[DB] Database already initialized');
            return database;
        }

        console.log('[DB] Opening database...');
        database = await SQLite.openDatabase(
            DATABASE_NAME,
            DATABASE_VERSION,
            DATABASE_DISPLAY_NAME,
            DATABASE_SIZE
        );

        console.log('[DB] Database opened successfully');
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

        // Offline collections table
        await database.executeSql(`
            CREATE TABLE IF NOT EXISTS offline_collections (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                member_number TEXT NOT NULL,
                member_name TEXT,
                shift_id INTEGER,
                shift_name TEXT,
                transporter_id INTEGER,
                transporter_name TEXT,
                route_id INTEGER,
                route_name TEXT,
                center_id INTEGER,
                center_name TEXT,
                measuring_can_id INTEGER,
                measuring_can_name TEXT,
                total_cans INTEGER NOT NULL,
                total_quantity REAL NOT NULL,
                cans_data TEXT NOT NULL,
                created_at TEXT NOT NULL,
                synced INTEGER DEFAULT 0,
                sync_attempts INTEGER DEFAULT 0,
                last_sync_attempt TEXT,
                error_message TEXT
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

        console.log('[DB] Tables created successfully');
    } catch (error) {
        console.error('[DB] Error creating tables:', error);
        throw error;
    }
};

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

// Insert offline collection
export const insertOfflineCollection = async (data: {
    member_number: string;
    member_name?: string;
    shift_id?: number;
    shift_name?: string;
    transporter_id?: number;
    transporter_name?: string;
    route_id?: number;
    route_name?: string;
    center_id?: number;
    center_name?: string;
    measuring_can_id?: number;
    measuring_can_name?: string;
    total_cans: number;
    total_quantity: number;
    cans_data: any[];
}): Promise<number> => {
    try {
        const db = database || await initDatabase();

        const cansJson = JSON.stringify(data.cans_data);
        const now = new Date().toISOString();

        const result = await db.executeSql(
            `INSERT INTO offline_collections (
                member_number, member_name, shift_id, shift_name,
                transporter_id, transporter_name, route_id, route_name,
                center_id, center_name, measuring_can_id, measuring_can_name,
                total_cans, total_quantity, cans_data, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                data.member_number,
                data.member_name || null,
                data.shift_id || null,
                data.shift_name || null,
                data.transporter_id || null,
                data.transporter_name || null,
                data.route_id || null,
                data.route_name || null,
                data.center_id || null,
                data.center_name || null,
                data.measuring_can_id || null,
                data.measuring_can_name || null,
                data.total_cans,
                data.total_quantity,
                cansJson,
                now,
            ]
        );

        const insertId = result[0].insertId;
        console.log('[DB] Collection inserted with ID:', insertId);
        return insertId;
    } catch (error) {
        console.error('[DB] Error inserting collection:', error);
        throw error;
    }
};

// Get all unsynced collections
export const getUnsyncedCollections = async (): Promise<any[]> => {
    try {
        const db = database || await initDatabase();

        const result = await db.executeSql(
            'SELECT * FROM offline_collections WHERE synced = 0 ORDER BY created_at ASC'
        );

        const collections: any[] = [];
        for (let i = 0; i < result[0].rows.length; i++) {
            const row = result[0].rows.item(i);
            collections.push({
                ...row,
                cans_data: JSON.parse(row.cans_data),
            });
        }

        console.log('[DB] Found', collections.length, 'unsynced collections');
        return collections;
    } catch (error) {
        console.error('[DB] Error getting unsynced collections:', error);
        throw error;
    }
};

// Get all collections (synced and unsynced)
export const getAllCollections = async (): Promise<any[]> => {
    try {
        const db = database || await initDatabase();

        const result = await db.executeSql(
            'SELECT * FROM offline_collections ORDER BY created_at DESC'
        );

        const collections: any[] = [];
        for (let i = 0; i < result[0].rows.length; i++) {
            const row = result[0].rows.item(i);
            collections.push({
                ...row,
                cans_data: JSON.parse(row.cans_data),
            });
        }

        return collections;
    } catch (error) {
        console.error('[DB] Error getting all collections:', error);
        throw error;
    }
};

// Mark collection as synced
export const markCollectionSynced = async (id: number): Promise<void> => {
    try {
        const db = database || await initDatabase();

        await db.executeSql(
            'UPDATE offline_collections SET synced = 1, last_sync_attempt = ? WHERE id = ?',
            [new Date().toISOString(), id]
        );

        console.log('[DB] Collection', id, 'marked as synced');
    } catch (error) {
        console.error('[DB] Error marking collection as synced:', error);
        throw error;
    }
};

// Update sync attempt
export const updateSyncAttempt = async (id: number, errorMessage?: string): Promise<void> => {
    try {
        const db = database || await initDatabase();

        await db.executeSql(
            `UPDATE offline_collections 
             SET sync_attempts = sync_attempts + 1, 
                 last_sync_attempt = ?,
                 error_message = ?
             WHERE id = ?`,
            [new Date().toISOString(), errorMessage || null, id]
        );

        console.log('[DB] Updated sync attempt for collection', id);
    } catch (error) {
        console.error('[DB] Error updating sync attempt:', error);
        throw error;
    }
};

// Delete synced collection
export const deleteSyncedCollection = async (id: number): Promise<void> => {
    try {
        const db = database || await initDatabase();

        await db.executeSql(
            'DELETE FROM offline_collections WHERE id = ? AND synced = 1',
            [id]
        );

        console.log('[DB] Deleted synced collection', id);
    } catch (error) {
        console.error('[DB] Error deleting collection:', error);
        throw error;
    }
};

// Delete any offline collection (regardless of sync status)
export const deleteOfflineCollection = async (id: number): Promise<void> => {
    try {
        const db = database || await initDatabase();

        await db.executeSql(
            'DELETE FROM offline_collections WHERE id = ?',
            [id]
        );

        console.log('[DB] Deleted offline collection', id);
    } catch (error) {
        console.error('[DB] Error deleting offline collection:', error);
        throw error;
    }
};

// Get count of unsynced collections
export const getUnsyncedCount = async (): Promise<number> => {
    try {
        const db = database || await initDatabase();

        const result = await db.executeSql(
            'SELECT COUNT(*) as count FROM offline_collections WHERE synced = 0'
        );

        const count = result[0].rows.item(0).count;
        return count;
    } catch (error) {
        console.error('[DB] Error getting unsynced count:', error);
        return 0;
    }
};

// Clear all synced collections
export const clearSyncedCollections = async (): Promise<number> => {
    try {
        const db = database || await initDatabase();

        const result = await db.executeSql(
            'DELETE FROM offline_collections WHERE synced = 1'
        );

        const rowsAffected = result[0].rowsAffected;
        console.log('[DB] Cleared', rowsAffected, 'synced collections');
        return rowsAffected;
    } catch (error) {
        console.error('[DB] Error clearing synced collections:', error);
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

// Save shifts to SQLite
export const saveShifts = async (shifts: any[]): Promise<void> => {
    try {
        const db = database || await initDatabase();
        const now = new Date().toISOString();

        // Clear existing shifts
        await db.executeSql('DELETE FROM shifts');

        // Insert new shifts
        for (const shift of shifts) {
            await db.executeSql(
                'INSERT INTO shifts (id, name, time, created_at) VALUES (?, ?, ?, ?)',
                [shift.id, shift.name, shift.time || '', now]
            );
        }

        console.log('[DB] Saved', shifts.length, 'shifts to database');
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

// Save measuring cans to SQLite
export const saveMeasuringCans = async (measuringCans: any[]): Promise<void> => {
    try {
        const db = database || await initDatabase();
        const now = new Date().toISOString();

        // Clear existing measuring cans
        await db.executeSql('DELETE FROM measuring_cans');

        // Insert new measuring cans
        for (const can of measuringCans) {
            await db.executeSql(
                'INSERT INTO measuring_cans (id, can_id, tare_weight, transporter_id, created_at) VALUES (?, ?, ?, ?, ?)',
                [can.id, can.can_id || `Can ${can.id}`, can.tare_weight || 0, can.transporter_id || null, now]
            );
        }

        console.log('[DB] Saved', measuringCans.length, 'measuring cans to database');
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

// Offline Credentials Management
export interface OfflineCredentials {
    phone_number: string;
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
        console.log('[DB] Database ready, saving offline credentials for:', data.phone_number);

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
                    offline_password,
                    offline_token,
                    offline_user_data,
                    offline_credentials_updated_at,
                    updated_at
                ) VALUES (?, ?, ?, ?, ?, ?)
            `, [
                data.phone_number,
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
                    offline_password = ?,
                    offline_token = ?,
                    offline_user_data = ?,
                    offline_credentials_updated_at = ?,
                    updated_at = ?
                WHERE id = (SELECT MIN(id) FROM settings)
            `, [
                data.phone_number,
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
            SELECT offline_phone_number, offline_credentials_updated_at
            FROM settings
            WHERE offline_phone_number IS NOT NULL
            ORDER BY offline_credentials_updated_at DESC
            LIMIT 1
        `);
        console.log('[DB] Verification query result:', verifyResult[0].rows.length, 'rows found');
        if (verifyResult[0].rows.length > 0) {
            console.log('[DB] Verification: phone =', verifyResult[0].rows.item(0).offline_phone_number);
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
            SELECT offline_phone_number, offline_password, offline_token, offline_user_data, offline_credentials_updated_at
            FROM settings
            WHERE offline_phone_number IS NOT NULL
            ORDER BY offline_credentials_updated_at DESC
            LIMIT 1
        `);

        console.log('[DB] Query result:', result[0].rows.length, 'rows found');

        if (result[0].rows.length > 0) {
            const row = result[0].rows.item(0);
            console.log('[DB] Found credentials for:', row.offline_phone_number);
            console.log('[DB] Token exists:', !!row.offline_token);
            return {
                phone_number: row.offline_phone_number,
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
export const validateOfflineCredentials = async (phoneNumber: string, password: string): Promise<{ valid: boolean; userData?: any; token?: string }> => {
    try {
        const credentials = await getOfflineCredentials();

        if (!credentials) {
            return { valid: false };
        }

        // Check if credentials are not too old (30 days)
        const storedAt = new Date(credentials.stored_at);
        const now = new Date();
        const hoursDiff = (now.getTime() - storedAt.getTime()) / (1000 * 60 * 60);

        if (hoursDiff > (30 * 24)) {
            console.log('[DB] Offline credentials are too old');
            return { valid: false };
        }

        // Validate phone number and password
        const isValid = credentials.phone_number === phoneNumber && credentials.password === password;

        if (isValid) {
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

        await db.executeSql('UPDATE settings SET offline_phone_number = NULL, offline_password = NULL, offline_token = NULL, offline_user_data = NULL, offline_credentials_updated_at = NULL');

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

