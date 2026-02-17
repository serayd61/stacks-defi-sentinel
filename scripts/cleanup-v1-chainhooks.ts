#!/usr/bin/env npx ts-node
/**
 * Cleanup V1 Chainhooks Script
 * 
 * Run this AFTER verifying V2 chainhooks are working correctly.
 * This will delete all V1 chainhooks from your account.
 * 
 * Usage:
 *   npx ts-node scripts/cleanup-v1-chainhooks.ts
 *   
 * Environment variables:
 *   HIRO_API_KEY - Your Hiro Platform API key
 *   CONFIRM_DELETE - Set to 'yes' to actually delete
 */

import { fetchV1Chainhooks, deleteV1Chainhook } from '../src/chainhooks/client-v2';

const HIRO_API_KEY = process.env.HIRO_API_KEY || '';
const CONFIRM_DELETE = process.env.CONFIRM_DELETE === 'yes';

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

async function main() {
  log('\n========================================', 'cyan');
  log('  V1 Chainhooks Cleanup Tool', 'cyan');
  log('========================================\n', 'cyan');

  if (!HIRO_API_KEY) {
    log('ERROR: HIRO_API_KEY environment variable is required', 'red');
    process.exit(1);
  }

  if (!CONFIRM_DELETE) {
    log('⚠️  PREVIEW MODE - No deletions will occur', 'yellow');
    log('   Set CONFIRM_DELETE=yes to actually delete\n', 'yellow');
  }

  try {
    // Fetch V1 chainhooks
    log('📥 Fetching V1 chainhooks...', 'blue');
    const v1Hooks = await fetchV1Chainhooks(HIRO_API_KEY);
    
    if (v1Hooks.length === 0) {
      log('   No V1 chainhooks found. Nothing to clean up.', 'green');
      return;
    }

    log(`   Found ${v1Hooks.length} V1 chainhook(s):\n`, 'reset');

    for (const hook of v1Hooks) {
      log(`   ├─ ${hook.name}`, 'cyan');
      log(`   │  UUID: ${hook.uuid}`, 'reset');
      
      if (CONFIRM_DELETE) {
        try {
          await deleteV1Chainhook(HIRO_API_KEY, hook.uuid);
          log(`   │  ✓ Deleted`, 'green');
        } catch (error: any) {
          log(`   │  ✗ Failed: ${error.message}`, 'red');
        }
      } else {
        log(`   │  [Would delete]`, 'yellow');
      }
      log('   │', 'reset');
    }

    if (CONFIRM_DELETE) {
      log('\n✅ Cleanup complete!', 'green');
    } else {
      log('\n⚠️  To delete these hooks, run:', 'yellow');
      log('   CONFIRM_DELETE=yes npx ts-node scripts/cleanup-v1-chainhooks.ts\n', 'cyan');
    }

  } catch (error: any) {
    log(`\n❌ Cleanup failed: ${error.message}`, 'red');
    process.exit(1);
  }
}

main().catch(console.error);
