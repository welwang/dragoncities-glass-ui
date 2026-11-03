const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const panel = process.env.PANEL_DIR || '/var/www/pterodactyl';
const directory = path.join(panel, 'public/branding');
const configFile = path.join(directory, 'brand.json');
const previous = fs.existsSync(configFile) ? JSON.parse(fs.readFileSync(configFile, 'utf8')) : { name: 'DragonCities' };
const name = (process.env.BRAND_NAME ?? previous.name).trim();
if (!name || [...name].length > 48 || /[\u0000-\u001f\u007f]/.test(name)) {
    throw new Error('BRAND_NAME must contain 1–48 characters without control characters.');
}
const source = process.env.BRAND_LOGO || path.join(directory, 'panel-logo.png');
const image = fs.readFileSync(source);
const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
if (image.length < 24 || !image.subarray(0, 8).equals(signature) || image.toString('ascii', 12, 16) !== 'IHDR' || !image.readUInt32BE(16) || !image.readUInt32BE(20)) {
    throw new Error('BRAND_LOGO must be a valid PNG image. Transparent square PNG is recommended.');
}
const version = crypto.createHash('sha256').update(image).digest('hex').slice(0, 12);
const logo = '/branding/panel-logo.png?v=' + version;
fs.mkdirSync(directory, { recursive: true });
fs.writeFileSync(path.join(directory, 'panel-logo.png'), image, { mode: 0o644 });
fs.writeFileSync(configFile, JSON.stringify({ name, logo }, null, 2) + '\n', { mode: 0o644 });
fs.writeFileSync(path.join(directory, 'manifest.json'), JSON.stringify({ name, short_name: name, start_url: '/', display: 'standalone', icons: [{ src: logo, sizes: 'any', type: 'image/png' }] }, null, 2) + '\n', { mode: 0o644 });
fs.writeFileSync(path.join(directory, 'browserconfig.xml'), '<?xml version="1.0" encoding="utf-8"?><browserconfig><msapplication><tile><square150x150logo src="' + logo.replaceAll('&', '&amp;') + '"/><TileColor>#0e4688</TileColor></tile></msapplication></browserconfig>\n', { mode: 0o644 });
console.log('Panel branding updated: ' + name);
console.log('Logo: ' + logo);
console.log('Refresh the browser. No frontend rebuild or service restart is required.');
