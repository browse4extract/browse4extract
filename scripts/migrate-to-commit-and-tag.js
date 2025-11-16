#!/usr/bin/env node

/**
 * Migration script from standard-version to commit-and-tag-version
 *
 * This script automates the migration process:
 * 1. Uninstalls standard-version
 * 2. Installs commit-and-tag-version
 * 3. Updates package.json scripts
 *
 * Usage: node scripts/migrate-to-commit-and-tag.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔄 Starting migration from standard-version to commit-and-tag-version...\n');

// Step 1: Read package.json
const packageJsonPath = path.join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

console.log('📦 Current package.json scripts:');
console.log(JSON.stringify(packageJson.scripts, null, 2));
console.log('');

// Step 2: Uninstall standard-version
console.log('🗑️  Uninstalling standard-version...');
try {
  execSync('npm uninstall standard-version', { stdio: 'inherit' });
  console.log('✅ standard-version uninstalled\n');
} catch (error) {
  console.error('❌ Failed to uninstall standard-version:', error.message);
  process.exit(1);
}

// Step 3: Install commit-and-tag-version
console.log('📥 Installing commit-and-tag-version...');
try {
  execSync('npm install --save-dev commit-and-tag-version', { stdio: 'inherit' });
  console.log('✅ commit-and-tag-version installed\n');
} catch (error) {
  console.error('❌ Failed to install commit-and-tag-version:', error.message);
  process.exit(1);
}

// Step 4: Update package.json scripts
console.log('📝 Updating package.json scripts...');

const oldScripts = {
  release: 'standard-version',
  'release:patch': 'standard-version --release-as patch',
  'release:minor': 'standard-version --release-as minor',
  'release:major': 'standard-version --release-as major',
  'release:first': 'standard-version --first-release'
};

const newScripts = {
  release: 'commit-and-tag-version',
  'release:patch': 'commit-and-tag-version --release-as patch',
  'release:minor': 'commit-and-tag-version --release-as minor',
  'release:major': 'commit-and-tag-version --release-as major',
  'release:first': 'commit-and-tag-version --first-release'
};

// Update scripts
Object.keys(newScripts).forEach(key => {
  if (packageJson.scripts[key]) {
    packageJson.scripts[key] = newScripts[key];
    console.log(`  ✓ Updated: ${key}`);
  }
});

// Write updated package.json
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n', 'utf8');
console.log('✅ package.json updated\n');

console.log('📦 New package.json scripts:');
console.log(JSON.stringify(packageJson.scripts, null, 2));
console.log('');

// Step 5: Verify .versionrc.json compatibility
const versionrcPath = path.join(__dirname, '..', '.versionrc.json');
if (fs.existsSync(versionrcPath)) {
  console.log('ℹ️  .versionrc.json found - commit-and-tag-version uses the same configuration format');
  console.log('   No changes needed to .versionrc.json');
} else {
  console.log('ℹ️  No .versionrc.json found - using default configuration');
}
console.log('');

console.log('✅ Migration complete!\n');
console.log('📖 Next steps:');
console.log('   1. Test the new tool: npm run release:patch');
console.log('   2. Verify CHANGELOG.md is generated correctly');
console.log('   3. Check version bumps in package.json');
console.log('   4. Push with tags: git push --follow-tags');
console.log('');
console.log('📚 Documentation: https://github.com/absolute-version/commit-and-tag-version');
