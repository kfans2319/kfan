/**
 * Database Vacuum Script - Optimized for Neon Tech PostgreSQL
 * 
 * This script performs VACUUM FULL operations on your Neon PostgreSQL database
 * to reclaim space after large deletions.
 * 
 * IMPORTANT: 
 * - This script requires database superuser/admin privileges
 * - VACUUM FULL takes exclusive locks on tables, which blocks operations
 * - For production databases, run this during low-traffic periods
 * - Neon Tech may have usage limits that affect long-running operations
 */

const { PrismaClient } = require('@prisma/client');
const { Client } = require('pg');
const fs = require('fs').promises;
const path = require('path');
const readline = require('readline');

// Create readline interface for user confirmation
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Initialize Prisma client with query logging
const prisma = new PrismaClient({
  log: ['warn', 'error']
});

// Configuration
const DRY_RUN = false;     // Set to true to only show queries without executing them
const VERBOSE = true;      // Set to true for more detailed logging
const NEON_MODE = true;    // Optimized for Neon Tech PostgreSQL
const FORCE_FULL = true;   // Always try to use VACUUM FULL for maximum space reclamation

/**
 * Main function to vacuum the database
 */
async function vacuumDatabase() {
  console.log('Database Vacuum Tool - Neon Tech PostgreSQL Edition');
  console.log('==================================================');
  console.log('This tool will perform VACUUM FULL operations to reclaim space after deletions.\n');
  
  try {
    // 1. Detect database type and confirm it's PostgreSQL/Neon
    const dbInfo = await detectDatabaseType();
    
    if (dbInfo.type !== 'postgresql') {
      console.error('Error: This script is specifically optimized for Neon Tech PostgreSQL.');
      console.error(`Detected database type: ${dbInfo.type}`);
      console.error('Please use a different script for non-PostgreSQL databases.');
      return;
    }
    
    console.log(`Detected database type: ${dbInfo.type}`);
    if (dbInfo.isNeon) {
      console.log('Confirmed Neon Tech PostgreSQL environment.');
    }
    
    // 2. Confirm operation with user
    const shouldProceed = await confirmOperation(dbInfo);
    if (!shouldProceed) {
      console.log('Operation cancelled by user.');
      return;
    }
    
    // 3. Perform pre-vacuum analysis
    await analyzeBeforeVacuum(dbInfo);
    
    // 4. Execute VACUUM FULL commands
    await executeVacuum(dbInfo);
    
    // 5. Perform post-vacuum analysis
    await analyzeAfterVacuum(dbInfo);
    
    console.log('\nDatabase vacuum completed successfully!');
    
  } catch (error) {
    console.error('Error during database vacuum:', error);
  } finally {
    await prisma.$disconnect();
    rl.close();
  }
}

/**
 * Detect database type from Prisma schema and check if it's Neon Tech
 */
async function detectDatabaseType() {
  let dbType = 'unknown';
  let connectionString = '';
  let tables = [];
  let isNeon = false;
  
  try {
    // Try to read the Prisma schema file
    const schemaPath = path.join(process.cwd(), 'prisma', 'schema.prisma');
    const schemaContent = await fs.readFile(schemaPath, 'utf8');
    
    // Extract database provider
    const providerMatch = schemaContent.match(/provider\s*=\s*"([^"]+)"/);
    if (providerMatch) {
      const provider = providerMatch[1];
      if (provider === 'postgresql') dbType = 'postgresql';
    }
    
    // Extract connection string if present
    const urlMatch = schemaContent.match(/url\s*=\s*env\("([^"]+)"\)/);
    if (urlMatch) {
      const envVar = urlMatch[1];
      connectionString = process.env[envVar] || '';
      // Check if it's a Neon connection string
      isNeon = connectionString.includes('neon.tech') || connectionString.includes('neon.io');
    }
    
    // Find model names to use as table names
    const modelMatches = schemaContent.match(/model\s+(\w+)\s+{[^}]+}/g);
    if (modelMatches) {
      tables = modelMatches.map(model => {
        const nameMatch = model.match(/model\s+(\w+)/);
        return nameMatch ? nameMatch[1] : null;
      }).filter(Boolean);
    }
    
  } catch (error) {
    console.warn(`Could not read Prisma schema: ${error.message}`);
    console.log('Will try to detect database type from client...');
  }
  
  // If unable to determine from schema, try to detect from client
  if (dbType === 'unknown' || !isNeon) {
    try {
      // Check version for PostgreSQL and Neon-specific information
      const result = await prisma.$queryRaw`SELECT version();`;
      const versionStr = JSON.stringify(result).toLowerCase();
      
      if (versionStr.includes('postgresql')) {
        dbType = 'postgresql';
        // Check for Neon-specific version information
        isNeon = versionStr.includes('neon') || versionStr.includes('pageserver');
      }
    } catch (error) {
      console.warn(`Could not detect database from query: ${error.message}`);
    }
  }
  
  // Get table names if not found from schema
  if (tables.length === 0 && dbType === 'postgresql') {
    try {
      // Get tables directly from database
      const result = await prisma.$queryRaw`
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public'
        AND tablename NOT LIKE 'pg_%'
        AND tablename NOT LIKE '_prisma_%';
      `;
      tables = result.map(r => r.tablename);
    } catch (error) {
      console.warn(`Could not fetch table names: ${error.message}`);
    }
  }
  
  // Get table sizes to sort by largest first (optimize vacuum order)
  let tableSizes = [];
  if (dbType === 'postgresql' && tables.length > 0) {
    try {
      // Use a different approach to avoid the IN clause with too many values
      const tablesPlaceholder = tables.map((_, idx) => `$${idx + 1}`).join(',');
      
      const sizesQuery = await prisma.$queryRaw`
        SELECT 
          relname as table_name,
          pg_table_size(c.oid) as size
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
        AND c.relkind = 'r'
        AND c.relname IN (${tables.join(',')})
        ORDER BY pg_table_size(c.oid) DESC;
      `;
      
      // Create lookup of table sizes
      const sizeMap = {};
      for (const row of sizesQuery) {
        sizeMap[row.table_name] = row.size;
      }
      
      // Sort tables by size (largest first) for more efficient vacuuming
      tables.sort((a, b) => (sizeMap[b] || 0) - (sizeMap[a] || 0));
      
      // Save the table sizes for reporting
      tableSizes = sizesQuery;
    } catch (error) {
      console.warn(`Could not fetch table sizes: ${error.message}`);
    }
  }
  
  return {
    type: dbType,
    connectionString,
    tables,
    tableSizes,
    isNeon: isNeon || NEON_MODE // Force Neon mode if configured
  };
}

/**
 * Ask user to confirm the operation with Neon-specific warnings
 */
async function confirmOperation(dbInfo) {
  const message = `
WARNING: You are about to vacuum your PostgreSQL database${dbInfo.isNeon ? ' on Neon Tech' : ''}.

IMPORTANT CONSIDERATIONS:
- VACUUM FULL requires an exclusive lock on each table
- All operations on those tables will be blocked during the vacuum
- This can cause timeouts and failed requests in a production environment
- Vacuum operations on Neon may consume compute time from your quota
- For large tables, this process can take a long time to complete

Would you like to proceed with VACUUM FULL? (yes/no): `;

  return new Promise((resolve) => {
    rl.question(message, (answer) => {
      resolve(answer.toLowerCase() === 'yes');
    });
  });
}

/**
 * Analyze database before vacuum to provide a baseline
 */
async function analyzeBeforeVacuum(dbInfo) {
  console.log('\nAnalyzing database before vacuum...');
  
  try {
    // Get database size information
    const dbSizeResult = await prisma.$queryRaw`SELECT pg_size_pretty(pg_database_size(current_database())) as size;`;
    console.log(`Current database size: ${dbSizeResult[0].size}`);
    
    // Get table sizes
    if (VERBOSE) {
      console.log('\nTable sizes before vacuum (largest first):');
      const tableSizesResult = await prisma.$queryRaw`
        SELECT 
          table_name, 
          pg_size_pretty(pg_total_relation_size(quote_ident(table_name))) as total_size,
          pg_size_pretty(pg_relation_size(quote_ident(table_name))) as table_size,
          pg_size_pretty(pg_total_relation_size(quote_ident(table_name)) - pg_relation_size(quote_ident(table_name))) as index_size,
          pg_total_relation_size(quote_ident(table_name)) as raw_size
        FROM information_schema.tables
        WHERE table_schema = 'public'
        ORDER BY pg_total_relation_size(quote_ident(table_name)) DESC
        LIMIT 20;
      `;
      
      for (const row of tableSizesResult) {
        console.log(`  ${row.table_name.padEnd(30)} Total: ${row.total_size.padEnd(10)} Table: ${row.table_size.padEnd(10)} Indexes: ${row.index_size}`);
      }
    }
    
    // Get dead tuples information - Fixed ROUND function issue with proper casting
    console.log('\nDead tuples information (tables that need vacuum):');
    const deadTuplesResult = await prisma.$queryRaw`
      SELECT 
        relname as table_name,
        n_live_tup as live_tuples,
        n_dead_tup as dead_tuples,
        CASE WHEN n_live_tup > 0 
          THEN ROUND((n_dead_tup::numeric / n_live_tup::numeric) * 100, 2) 
          ELSE 0 
        END as dead_tuple_percentage
      FROM pg_stat_user_tables
      WHERE n_dead_tup > 0
      ORDER BY n_dead_tup DESC
      LIMIT 20;
    `;
    
    if (deadTuplesResult.length === 0) {
      console.log('  No tables with dead tuples found. Vacuum may not reclaim much space.');
    } else {
      for (const row of deadTuplesResult) {
        console.log(`  ${row.table_name.padEnd(30)} Live: ${row.live_tuples.toString().padEnd(10)} Dead: ${row.dead_tuples.toString().padEnd(10)} Dead %: ${row.dead_tuple_percentage}%`);
      }
    }
    
    // Get bloat estimation where possible
    try {
      console.log('\nEstimated table bloat:');
      const bloatQuery = await prisma.$queryRaw`
        WITH constants AS (
          SELECT current_setting('block_size')::numeric AS bs
        ),
        relation_data AS (
          SELECT
            c.relname AS table_name,
            c.reltuples AS row_estimate,
            c.relpages AS pages,
            pg_relation_size(c.oid) AS table_size
          FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public'
          AND c.relkind = 'r'
        ),
        estimates AS (
          SELECT
            table_name,
            row_estimate,
            table_size,
            bs,
            pages,
            CEIL((row_estimate * 6) / (bs - 20::float)) AS estimated_pages
          FROM relation_data, constants
          WHERE pages > 0
        )
        SELECT
          table_name,
          row_estimate::bigint AS "live_rows",
          pg_size_pretty(table_size) AS "table_size",
          pg_size_pretty(pages * bs) AS "current_size",
          pg_size_pretty(estimated_pages * bs) AS "estimated_size",
          CASE WHEN estimated_pages > 0
            THEN ROUND(100 * (pages - estimated_pages) / pages, 2)
            ELSE 0
          END AS "bloat_percentage"
        FROM estimates
        WHERE (pages - estimated_pages) / pages > 0.2
        AND row_estimate > 10
        ORDER BY bloat_percentage DESC
        LIMIT 10;
      `;
      
      if (bloatQuery.length === 0) {
        console.log('  No significant table bloat detected.');
      } else {
        for (const row of bloatQuery) {
          console.log(`  ${row.table_name.padEnd(30)} Bloat: ${row.bloat_percentage.toString()}% | Current: ${row.current_size} | Estimated actual: ${row.estimated_size}`);
        }
      }
    } catch (error) {
      console.warn(`  Could not analyze table bloat: ${error.message}`);
    }
  } catch (error) {
    console.warn(`Error analyzing database before vacuum: ${error.message}`);
  }
}

/**
 * Execute vacuum commands optimized for Neon PostgreSQL
 */
async function executeVacuum(dbInfo) {
  console.log('\nExecuting VACUUM FULL...');
  
  if (DRY_RUN) {
    console.log('DRY RUN: Would execute VACUUM FULL commands but skipping actual execution.');
    return;
  }
  
  // Create a native PostgreSQL client
  const client = new Client({
    connectionString: dbInfo.connectionString,
  });
  
  try {
    // Connect the native client
    await client.connect();
    
    // First analyze to update statistics
    console.log('Step 1: Updating database statistics...');
    await client.query('ANALYZE');
    
    // Vacuum each table separately to provide progress updates
    // Using VACUUM FULL for maximum space reclamation
    console.log('Step 2: Performing VACUUM FULL on tables (largest first)...');
    
    if (dbInfo.tables.length === 0) {
      console.warn('No tables found to vacuum.');
      return;
    }
    
    // Count total vacuumed
    let vacuumedTables = 0;
    let failedTables = 0;
    
    for (let i = 0; i < dbInfo.tables.length; i++) {
      const table = dbInfo.tables[i];
      try {
        console.log(`  Vacuuming table ${i+1}/${dbInfo.tables.length}: ${table}`);
        
        const startTime = Date.now();
        
        // Use the native client to execute VACUUM
        // Properly escape table name to prevent SQL injection
        const sanitizedTableName = table.replace(/"/g, '""');
        await client.query(`VACUUM FULL ANALYZE "${sanitizedTableName}";`);
        
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`  ✓ VACUUM FULL completed for ${table} in ${duration}s`);
        vacuumedTables++;
        
        // Small pause between operations to prevent overwhelming the connection
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`  ✗ Error vacuuming table ${table}: ${error.message}`);
        failedTables++;
        
        // For Neon Tech, connection timeouts might occur on large tables
        // In this case, we might need to reconnect
        if (error.message.includes('timeout') || error.message.includes('terminated')) {
          console.log('  Detected potential timeout. Reconnecting native client...');
          try {
            await client.end();
            await new Promise(resolve => setTimeout(resolve, 2000));
            await client.connect();
            console.log('  Reconnected successfully.');
          } catch (reconnectError) {
            console.error(`  Failed to reconnect: ${reconnectError.message}`);
            console.error('  Aborting further vacuum operations.');
            break;
          }
        }
      }
    }
    
    console.log(`\nVacuum operation summary:`);
    console.log(`  Successfully vacuumed tables: ${vacuumedTables}/${dbInfo.tables.length}`);
    if (failedTables > 0) {
      console.log(`  Failed tables: ${failedTables}`);
    }
  } catch (error) {
    console.error(`Error during vacuum: ${error.message}`);
    throw error;
  } finally {
    // Disconnect the native client
    await client.end();
  }
}

/**
 * Analyze database after vacuum to show space savings
 */
async function analyzeAfterVacuum(dbInfo) {
  console.log('\nAnalyzing database after vacuum...');
  
  try {
    // Re-establish connection if needed for Neon
    if (dbInfo.isNeon) {
      try {
        await prisma.$disconnect();
        await new Promise(resolve => setTimeout(resolve, 1000));
        await prisma.$connect();
      } catch (error) {
        console.warn(`Could not reconnect after vacuum: ${error.message}`);
        return;
      }
    }
    
    // Get database size after vacuum
    const dbSizeResult = await prisma.$queryRaw`SELECT pg_size_pretty(pg_database_size(current_database())) as size;`;
    console.log(`Database size after vacuum: ${dbSizeResult[0].size}`);
    
    // Get table sizes after vacuum
    if (VERBOSE) {
      console.log('\nTable sizes after vacuum:');
      const tableSizesResult = await prisma.$queryRaw`
        SELECT 
          table_name, 
          pg_size_pretty(pg_total_relation_size(quote_ident(table_name))) as total_size,
          pg_size_pretty(pg_relation_size(quote_ident(table_name))) as table_size,
          pg_size_pretty(pg_total_relation_size(quote_ident(table_name)) - pg_relation_size(quote_ident(table_name))) as index_size
        FROM information_schema.tables
        WHERE table_schema = 'public'
        ORDER BY pg_total_relation_size(quote_ident(table_name)) DESC
        LIMIT 20;
      `;
      
      for (const row of tableSizesResult) {
        console.log(`  ${row.table_name.padEnd(30)} Total: ${row.total_size.padEnd(10)} Table: ${row.table_size.padEnd(10)} Indexes: ${row.index_size}`);
      }
    }
    
    // Check if there are still dead tuples (there shouldn't be many after VACUUM FULL)
    const deadTuplesResult = await prisma.$queryRaw`
      SELECT 
        SUM(n_dead_tup) as total_dead_tuples
      FROM pg_stat_user_tables;
    `;
    
    console.log(`\nDead tuples remaining: ${deadTuplesResult[0].total_dead_tuples || 0}`);
    
    // Provide a summary of index sizes
    console.log('\nIndex sizes after vacuum:');
    const indexSizesResult = await prisma.$queryRaw`
      SELECT
        schemaname || '.' || relname as table,
        indexrelname as index,
        pg_size_pretty(pg_relation_size(i.indexrelid)) as index_size,
        idx_scan as scans
      FROM pg_stat_user_indexes ui
      JOIN pg_index i ON ui.indexrelid = i.indexrelid
      WHERE schemaname = 'public'
      ORDER BY pg_relation_size(i.indexrelid) DESC
      LIMIT 10;
    `;
    
    for (const row of indexSizesResult) {
      console.log(`  ${row.table.padEnd(30)} ${row.index.padEnd(30)} Size: ${row.index_size.padEnd(10)} Scans: ${row.scans}`);
    }
    
    console.log('\nNeon Tech Recommendations:');
    console.log('- Consider rebuilding rarely used indexes to reduce storage costs');
    console.log('- For large tables, consider implementing table partitioning');
    console.log('- Regular VACUUM (non-FULL) should be run more frequently to prevent bloat');
    console.log('- For very large databases, consider using Neon\'s branching feature for maintenance operations');
    
  } catch (error) {
    console.warn(`Error analyzing database after vacuum: ${error.message}`);
  }
}

// Execute the main function
vacuumDatabase()
  .then(() => {
    console.log('\nScript execution completed.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script execution failed:', error);
    process.exit(1);
  }); 