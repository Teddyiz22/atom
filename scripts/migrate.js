/**
 * Run all idempotent DB migrations + seeds for deploy.
 *
 * Usage: npm run migrate
 */
const { spawnSync } = require('child_process');
const path = require('path');

const root = path.join(__dirname, '..');

const steps = [
  { name: 'Manual provider enum', script: 'migrateManualProvider.js' },
  { name: 'Smile coin columns', script: 'migrateSmileCoinColumns.js' },
  { name: 'MCGG PH packages', script: 'seedMcggPhp.js' },
  { name: 'MCGG BR weekly pass fix', script: 'fixMcggBrWeeklyPass.js' },
  { name: 'MCGG Custom (manual)', script: 'seedMcggCustom.js' }
];

function runStep(step) {
  console.log(`\n=== ${step.name} ===`);
  const result = spawnSync(process.execPath, [path.join(__dirname, step.script)], {
    cwd: root,
    stdio: 'inherit',
    env: process.env
  });
  if (result.status !== 0) {
    throw new Error(`${step.script} exited with code ${result.status}`);
  }
}

function main() {
  console.log('Starting migrations...');
  for (const step of steps) {
    runStep(step);
  }
  console.log('\n✅ All migrations completed.');
}

try {
  main();
} catch (err) {
  console.error('\n❌ Migration failed:', err.message);
  process.exit(1);
}
