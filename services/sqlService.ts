
import { logger } from './logger';

/**
 * Neural SQL Service (v9.5.0-PUMP)
 * Handles high-density binary artifacts and administrative relational queries.
 */

const SQL_PROXY_ENDPOINT = '/api/sql/refraction';

export async function executeSqlQuery(sql: string): Promise<{ rows: any[], rowCount: number, duration: number }> {
    const startTime = Date.now();
    logger.info(`Relational Handshake: Executing SQL query...`);
    
    try {
        const response = await fetch(`${SQL_PROXY_ENDPOINT}/query`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sql })
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error || `SQL Engine Error: ${response.status}`);
        }

        const data = await response.json();
        const duration = Date.now() - startTime;
        logger.success(`SQL execution complete (${duration}ms).`);
        return { ...data, duration };
    } catch (e: any) {
        logger.error(`SQL Logic Fault`, e);
        throw e;
    }
}

export async function listSqlTables(): Promise<string[]> {
    const sql = "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name;";
    const data = await executeSqlQuery(sql);
    return data.rows.map((r: any) => r.table_name);
}

export async function getSqlTableStats(tableName: string): Promise<{ size: string, rows: string }> {
    const sql = `
        SELECT 
            reltuples::bigint AS row_count,
            pg_size_pretty(pg_total_relation_size('"' || relname || '"')) AS total_size
        FROM pg_class
        JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
        WHERE relname = '${tableName}' AND nspname = 'public';
    `;
    const data = await executeSqlQuery(sql);
    if (data.rows && data.rows.length > 0) {
        return { size: data.rows[0].total_size, rows: data.rows[0].row_count.toString() };
    }
    return { size: '0 B', rows: '0' };
}

export async function streamToRelationalVault(
    nodeId: string, 
    binaryData: Uint8Array, 
    mimeType: string,
    metadata: Record<string, any>
): Promise<string> {
    logger.info(`Relational Handshake: Streaming ${Math.round(binaryData.length / 1024)}KB binary to PostgreSQL...`);
    
    try {
        const response = await fetch(`${SQL_PROXY_ENDPOINT}/binary`, {
            method: 'POST',
            headers: {
                'X-Neural-Node-ID': nodeId,
                'Content-Type': mimeType,
                'X-Neural-Meta': JSON.stringify(metadata)
            },
            body: binaryData
        });

        if (!response.ok) {
            throw new Error(`SQL Proxy Refused Handshake: ${response.status}`);
        }

        const data = await response.json();
        logger.success(`Relational Refraction Complete: Node ${nodeId} secured in Cloud SQL.`);
        return data.uri; 
    } catch (e: any) {
        logger.warn(`SQL Direct Link Offline: ${e.message}. Falling back to Metadata Ledger.`);
        throw e; 
    }
}

export async function fetchFromRelationalVault(nodeId: string): Promise<Uint8Array | null> {
    try {
        const response = await fetch(`${SQL_PROXY_ENDPOINT}/binary/${nodeId}`);
        if (!response.ok) return null;
        
        const buffer = await response.arrayBuffer();
        return new Uint8Array(buffer);
    } catch (e) {
        console.error("[SQL Service] Retrieval failure", e);
        return null;
    }
}
