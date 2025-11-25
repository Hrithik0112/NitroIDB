#!/usr/bin/env node

import { readFileSync, statSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

/**
 * Get file size in bytes
 */
function getFileSize(filePath) {
  try {
    const stats = statSync(filePath);
    return stats.size;
  } catch {
    return 0;
  }
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Check bundle sizes
 */
function checkBundleSizes() {
  console.log('📦 Checking bundle sizes...\n');

  const bundles = {
    'ESM': 'dist/esm/index.js',
    'CJS': 'dist/cjs/index.js',
    'IIFE': 'dist/iife/index.js',
  };

  const targets = {
    core: 8 * 1024, // 8KB target for core
    full: 25 * 1024, // 25KB target for full library
  };

  let allPassed = true;

  for (const [format, path] of Object.entries(bundles)) {
    const fullPath = join(rootDir, path);
    const size = getFileSize(fullPath);

    if (size === 0) {
      console.log(`❌ ${format}: File not found at ${path}`);
      allPassed = false;
      continue;
    }

    const sizeKB = size / 1024;
    const target = format === 'IIFE' ? targets.full : targets.core;
    const passed = size <= target;

    console.log(`${passed ? '✅' : '⚠️'} ${format}:`);
    console.log(`   Size: ${formatBytes(size)} (${sizeKB.toFixed(2)} KB)`);
    console.log(`   Target: ${formatBytes(target)} (${(target / 1024).toFixed(2)} KB)`);
    console.log(`   Status: ${passed ? 'PASS' : 'OVER TARGET'}\n`);

    if (!passed) {
      allPassed = false;
    }
  }

  if (allPassed) {
    console.log('✅ All bundle sizes are within targets!');
    process.exit(0);
  } else {
    console.log('⚠️  Some bundles exceed size targets. Consider optimization.');
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  checkBundleSizes();
}

export { checkBundleSizes };

