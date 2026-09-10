#!/usr/bin/env node

/**
 * Derives the site's images from the brand originals in `brand/`.
 *
 * The originals are the same files the package repositories carry, at the size
 * they were exported: between 0.4 and 1.4 MB each, which is far too heavy to
 * put in a navbar. This produces the sizes the site actually serves, and the
 * results are committed so a plain `npm run build` needs no image tooling.
 *
 * Usage: node scripts/build-images.mjs
 */

import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const brand = path.join(root, 'brand');
const target = path.join(root, 'static', 'img');

const derivatives = [
    {
        // The navbar renders the logo about 32 px tall; 96 keeps it sharp on a
        // 3x display without shipping the 1672 px original.
        source: 'logo-no-bg.png',
        output: 'logo.png',
        resize: { height: 96 },
        note: 'navbar',
    },
    {
        source: 'logo-square-no-bg.png',
        output: 'logo-square.png',
        resize: { width: 512, height: 512, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } },
        note: 'landing page',
    },
    {
        // A PNG favicon, not an .ico: every browser in the browserslist
        // supports it, and sharp cannot write .ico anyway.
        source: 'logo-square-no-bg.png',
        output: 'favicon.png',
        resize: { width: 256, height: 256, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } },
        note: 'favicon',
    },
    {
        // The size Open Graph and X both crop least aggressively.
        source: 'blog-card.png',
        output: 'social-card.png',
        resize: { width: 1200, height: 630, fit: 'cover' },
        note: 'og:image',
    },
];

await fs.mkdir(target, { recursive: true });

for (const derivative of derivatives) {
    const source = path.join(brand, derivative.source);

    if (!existsSync(source)) {
        console.error(`\n  ${derivative.source} is missing from brand/.\n`);
        process.exit(1);
    }

    const destination = path.join(target, derivative.output);

    await sharp(source)
        .resize(derivative.resize)
        .png({ compressionLevel: 9, palette: true })
        .toFile(destination);

    const { size } = await fs.stat(destination);
    const { width, height } = await sharp(destination).metadata();

    console.log(
        `  ${derivative.output.padEnd(18)} ${`${width}x${height}`.padEnd(10)} ${String(Math.round(size / 1024)).padStart(5)} KB   ${derivative.note}`,
    );
}

console.log('');
