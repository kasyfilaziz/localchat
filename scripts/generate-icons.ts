import sharp from 'sharp';
import { mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const iconsDir = join(projectRoot, 'static/icons');

if (!existsSync(iconsDir)) {
	mkdirSync(iconsDir, { recursive: true });
}

const size192 = 192;
const size512 = 512;

const svgIcon = `
<svg width="{SIZE}" height="{SIZE}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#3b82f6;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#1d4ed8;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="{SIZE}" height="{SIZE}" rx="40" fill="url(#grad)"/>
  <text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" 
        font-family="Arial, sans-serif" font-weight="bold" font-size="{FONT_SIZE}" fill="white">LC</text>
</svg>
`;

async function generateIcons() {
	// Generate 192x192 icon
	const svg192 = svgIcon.replace(/{SIZE}/g, String(size192)).replace(/{FONT_SIZE}/g, '80');
	await sharp(Buffer.from(svg192))
		.png()
		.toFile(join(iconsDir, 'icon-192.png'));
	console.log('Generated icon-192.png');

	// Generate 512x512 icon
	const svg512 = svgIcon.replace(/{SIZE}/g, String(size512)).replace(/{FONT_SIZE}/g, '220');
	await sharp(Buffer.from(svg512))
		.png()
		.toFile(join(iconsDir, 'icon-512.png'));
	console.log('Generated icon-512.png');
}

generateIcons().catch(console.error);
