const png2icons = require('png2icons');
const fs = require('fs');
const path = require('path');

const inputPath = path.join(__dirname, 'assets', 'app_image.png');
const outputPath = path.join(__dirname, 'assets', 'app_image.ico');

console.log('Converting PNG to ICO with 256x256 resolution...');

const input = fs.readFileSync(inputPath);

// Convert PNG to ICO with multiple sizes including 256x256
const output = png2icons.createICO(input, png2icons.BICUBIC, 0, false, [256, 128, 64, 48, 32, 24, 16]);

if (output) {
  fs.writeFileSync(outputPath, output);
  console.log('✓ Icon converted successfully: ' + outputPath);
} else {
  console.error('✗ Failed to convert icon');
  process.exit(1);
}
