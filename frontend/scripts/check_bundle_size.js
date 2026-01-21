#!/usr/bin/env node
/**
 * Phase 7.32: Bundle Size Check Script
 * 
 * Validates that production bundle chunks don't exceed performance budgets.
 * Run after `npm run build` to ensure bundle sizes are within limits.
 * 
 * Usage:
 *   node scripts/check_bundle_size.js
 * 
 * Exit codes:
 *   0 - All chunks within budget
 *   1 - One or more chunks exceed budget
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { gzipSync } from 'zlib';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Performance budgets (in KB)
const BUDGETS = {
  mainChunk: 750,        // Main bundle gzipped
  vendorChunk: 300,      // Vendor libraries gzipped
  anyChunk: 500,         // Any individual chunk gzipped
};

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

function formatSize(bytes) {
  return (bytes / 1024).toFixed(2) + ' KB';
}

function getGzipSize(filePath) {
  const content = fs.readFileSync(filePath);
  const gzipped = gzipSync(content);
  return gzipped.length;
}

function checkBundleSizes() {
  const distPath = path.resolve(__dirname, '../dist/assets');
  
  if (!fs.existsSync(distPath)) {
    console.error(`${colors.red}Error: dist/assets directory not found.${colors.reset}`);
    console.error('Run `npm run build` first.');
    process.exit(1);
  }

  const files = fs.readdirSync(distPath)
    .filter(file => file.endsWith('.js'))
    .map(file => {
      const filePath = path.join(distPath, file);
      const stats = fs.statSync(filePath);
      const gzipSize = getGzipSize(filePath);
      return {
        name: file,
        size: stats.size,
        gzipSize,
        sizeKB: stats.size / 1024,
        gzipSizeKB: gzipSize / 1024,
      };
    })
    .sort((a, b) => b.gzipSize - a.gzipSize);

  console.log(`\n${colors.bold}${colors.cyan}Bundle Size Report${colors.reset}`);
  console.log('='.repeat(80));
  
  let failed = false;
  let totalSize = 0;
  let totalGzipSize = 0;

  files.forEach(file => {
    totalSize += file.size;
    totalGzipSize += file.gzipSize;

    const isVendor = file.name.includes('vendor');
    const isMain = file.name.includes('index') && !isVendor;
    
    let budget = BUDGETS.anyChunk;
    let budgetLabel = 'chunk';
    
    if (isMain) {
      budget = BUDGETS.mainChunk;
      budgetLabel = 'main';
    } else if (isVendor) {
      budget = BUDGETS.vendorChunk;
      budgetLabel = 'vendor';
    }

    const exceedsBudget = file.gzipSizeKB > budget;
    const percentage = (file.gzipSizeKB / budget * 100).toFixed(1);
    
    const statusColor = exceedsBudget ? colors.red : colors.green;
    const statusIcon = exceedsBudget ? '✗' : '✓';
    
    console.log(`${statusColor}${statusIcon}${colors.reset} ${file.name}`);
    console.log(`   Raw: ${formatSize(file.size)} | Gzipped: ${formatSize(file.gzipSize)}`);
    console.log(`   Budget: ${budget} KB (${budgetLabel}) | Used: ${percentage}%`);
    
    if (exceedsBudget) {
      const overBy = file.gzipSizeKB - budget;
      console.log(`   ${colors.red}⚠ EXCEEDS BUDGET by ${formatSize(overBy * 1024)}${colors.reset}`);
      failed = true;
    }
    
    console.log('');
  });

  console.log('='.repeat(80));
  console.log(`${colors.bold}Total:${colors.reset}`);
  console.log(`  Raw: ${formatSize(totalSize)} | Gzipped: ${formatSize(totalGzipSize)}`);
  console.log('');

  if (failed) {
    console.log(`${colors.red}${colors.bold}❌ BUNDLE SIZE CHECK FAILED${colors.reset}`);
    console.log(`${colors.red}One or more chunks exceed performance budget.${colors.reset}`);
    console.log('\nRecommendations:');
    console.log('  1. Use dynamic imports for large features');
    console.log('  2. Review manualChunks configuration in vite.config.js');
    console.log('  3. Remove unused dependencies');
    console.log('  4. Enable tree-shaking for libraries');
    console.log('');
    process.exit(1);
  } else {
    console.log(`${colors.green}${colors.bold}✅ ALL BUNDLES WITHIN BUDGET${colors.reset}`);
    console.log(`${colors.green}Performance budget check passed!${colors.reset}`);
    console.log('');
    process.exit(0);
  }
}

checkBundleSizes();
