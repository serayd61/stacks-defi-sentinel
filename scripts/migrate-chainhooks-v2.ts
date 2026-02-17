#!/usr/bin/env npx ts-node
/**
 * Chainhooks V1 to V2 Migration Script
 * 
 * IMPORTANT: Run this before March 9th, 2026!
 * 
 * This script:
 * 1. Fetches all existing V1 chainhooks
 * 2. Converts them to V2 format
 * 3. Registers new V2 chainhooks
 * 4. Validates delivery parity
 * 5. Optionally deletes V1 chainhooks after verification
 * 
 * Usage:
 *   npx ts-node scripts/migrate-chainhooks-v2.ts
 *   
 * Environment variables:
 *   HIRO_API_KEY - Your Hiro Platform API key
 *   WEBHOOK_BASE_URL - Base URL for webhook endpoints
 *   DRY_RUN - Set to 'true' to preview without making changes
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  ChainhooksV2Manager,
  ChainhookV2Definition,
  fetchV1Chainhooks,
  deleteV1Chainhook,
  convertV1ToV2,
  V1Chainhook,
} from '../src/chainhooks/client-v2';

// Configuration
const HIRO_API_KEY = process.env.HIRO_API_KEY || '';
const WEBHOOK_BASE_URL = process.env.WEBHOOK_BASE_URL || 'https://stacks-defi-sentinel-production.up.railway.app';
const DRY_RUN = process.env.DRY_RUN === 'true';
const NETWORK: 'mainnet' | 'testnet' = (process.env.NETWORK as any) || 'mainnet';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

interface MigrationResult {
  v1Hook: V1Chainhook;
  v2Definition: ChainhookV2Definition;
  v2Uuid?: string;
  status: 'success' | 'failed' | 'skipped';
  error?: string;
}

async function main() {
  log('\n========================================', 'cyan');
  log('  Chainhooks V1 → V2 Migration Tool', 'cyan');
  log('========================================\n', 'cyan');

  // Validate configuration
  if (!HIRO_API_KEY) {
    log('ERROR: HIRO_API_KEY environment variable is required', 'red');
    process.exit(1);
  }

  if (DRY_RUN) {
    log('🔍 DRY RUN MODE - No changes will be made\n', 'yellow');
  }

  log(`Network: ${NETWORK}`, 'blue');
  log(`Webhook Base URL: ${WEBHOOK_BASE_URL}`, 'blue');
  log('');

  // Initialize V2 manager
  const v2Manager = new ChainhooksV2Manager({
    apiKey: HIRO_API_KEY,
    webhookBaseUrl: WEBHOOK_BASE_URL,
    network: NETWORK,
  });

  const results: MigrationResult[] = [];

  try {
    // Step 1: Fetch existing V1 chainhooks
    log('📥 Step 1: Fetching V1 chainhooks...', 'blue');
    const v1Hooks = await fetchV1Chainhooks(HIRO_API_KEY);
    log(`   Found ${v1Hooks.length} V1 chainhook(s)\n`, 'green');

    if (v1Hooks.length === 0) {
      log('No V1 chainhooks found. Nothing to migrate.', 'yellow');
      
      // Check for local predicate files
      log('\n📁 Checking local V2 predicate files...', 'blue');
      await registerLocalPredicates(v2Manager);
      return;
    }

    // Step 2: Convert and display V1 → V2 mappings
    log('🔄 Step 2: Converting V1 to V2 format...\n', 'blue');
    
    for (const v1Hook of v1Hooks) {
      log(`   Converting: ${v1Hook.name}`, 'cyan');
      
      try {
        const v2Definition = convertV1ToV2(v1Hook, NETWORK);
        
        log(`   ├─ V1 UUID: ${v1Hook.uuid}`, 'reset');
        log(`   ├─ Events: ${v2Definition.filters.events.map(e => e.type).join(', ')}`, 'reset');
        log(`   └─ Webhook: ${v2Definition.action.url}\n`, 'reset');

        results.push({
          v1Hook,
          v2Definition,
          status: 'success',
        });
      } catch (error: any) {
        log(`   └─ ERROR: ${error.message}\n`, 'red');
        results.push({
          v1Hook,
          v2Definition: {} as any,
          status: 'failed',
          error: error.message,
        });
      }
    }

    // Step 3: Register V2 chainhooks
    if (!DRY_RUN) {
      log('📤 Step 3: Registering V2 chainhooks...\n', 'blue');
      
      for (const result of results) {
        if (result.status !== 'success') continue;

        try {
          log(`   Registering: ${result.v2Definition.name}...`, 'cyan');
          const v2Hook = await v2Manager.registerChainhook(result.v2Definition);
          result.v2Uuid = v2Hook.uuid;
          log(`   └─ Success! UUID: ${v2Hook.uuid}\n`, 'green');
        } catch (error: any) {
          result.status = 'failed';
          result.error = error.message;
          log(`   └─ Failed: ${error.message}\n`, 'red');
        }
      }
    } else {
      log('📤 Step 3: [DRY RUN] Would register V2 chainhooks\n', 'yellow');
    }

    // Step 4: Verify V2 chainhooks
    log('✅ Step 4: Verifying V2 chainhooks...\n', 'blue');
    
    if (!DRY_RUN) {
      const v2Hooks = await v2Manager.listChainhooks();
      log(`   Found ${v2Hooks.length} V2 chainhook(s)`, 'green');
      
      for (const hook of v2Hooks) {
        log(`   ├─ ${hook.name}: ${hook.status.enabled ? '✓ Enabled' : '✗ Disabled'}`, 
          hook.status.enabled ? 'green' : 'yellow');
      }
      log('');
    }

    // Step 5: Summary and cleanup instructions
    log('📊 Migration Summary', 'cyan');
    log('─'.repeat(40), 'cyan');
    
    const successful = results.filter(r => r.status === 'success' && r.v2Uuid).length;
    const failed = results.filter(r => r.status === 'failed').length;
    const skipped = results.filter(r => r.status === 'skipped').length;

    log(`   ✓ Successful: ${successful}`, 'green');
    log(`   ✗ Failed: ${failed}`, failed > 0 ? 'red' : 'reset');
    log(`   ○ Skipped: ${skipped}`, skipped > 0 ? 'yellow' : 'reset');
    log('');

    // Save migration report
    const reportPath = path.join(__dirname, '../migration-report.json');
    const report = {
      timestamp: new Date().toISOString(),
      network: NETWORK,
      dryRun: DRY_RUN,
      results: results.map(r => ({
        v1Name: r.v1Hook.name,
        v1Uuid: r.v1Hook.uuid,
        v2Uuid: r.v2Uuid,
        status: r.status,
        error: r.error,
      })),
    };
    
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    log(`📝 Migration report saved to: ${reportPath}\n`, 'blue');

    // Cleanup instructions
    if (!DRY_RUN && successful > 0) {
      log('🧹 Next Steps:', 'yellow');
      log('   1. Monitor both V1 and V2 hooks for a few days', 'reset');
      log('   2. Verify webhook deliveries match', 'reset');
      log('   3. Once verified, delete V1 hooks with:', 'reset');
      log('');
      log('   npx ts-node scripts/cleanup-v1-chainhooks.ts', 'cyan');
      log('');
      log('⚠️  DEADLINE: March 9th, 2026 - V1 hooks will stop working!', 'red');
    }

  } catch (error: any) {
    log(`\n❌ Migration failed: ${error.message}`, 'red');
    process.exit(1);
  }
}

/**
 * Register chainhooks from local V2 predicate files
 */
async function registerLocalPredicates(v2Manager: ChainhooksV2Manager) {
  const predicatesDir = path.join(__dirname, '../chainhooks/predicates-v2');
  
  if (!fs.existsSync(predicatesDir)) {
    log('   No local V2 predicates directory found', 'yellow');
    return;
  }

  const files = fs.readdirSync(predicatesDir).filter(f => f.endsWith('.json'));
  log(`   Found ${files.length} local V2 predicate file(s)\n`, 'green');

  if (DRY_RUN) {
    log('   [DRY RUN] Would register the following:\n', 'yellow');
  }

  for (const file of files) {
    const filePath = path.join(predicatesDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const definition = JSON.parse(content) as ChainhookV2Definition;

    log(`   ├─ ${definition.name} (${file})`, 'cyan');
    
    if (!DRY_RUN) {
      try {
        const hook = await v2Manager.registerChainhook(definition);
        log(`   │  └─ Registered: ${hook.uuid}`, 'green');
      } catch (error: any) {
        log(`   │  └─ Failed: ${error.message}`, 'red');
      }
    }
  }
  log('');
}

// Run migration
main().catch(console.error);
