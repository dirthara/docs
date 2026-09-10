#!/usr/bin/env node

/**
 * Materialises the documentation site's content from the package repositories.
 *
 * Every package keeps its own `docs` directory, written to be Docusaurus-ready.
 * This script reads `sources.json`, fetches that directory at the git ref each
 * documentation version pins, and lays the result out the way Docusaurus wants
 * it: the current version under `content/`, every older one under
 * `versioned_docs/version-<name>/`, one subdirectory per package.
 *
 * Nothing it writes is committed. The markdown belongs to the package that
 * owns it, so this repository stores the mapping and not a copy.
 *
 * Usage: node scripts/pull-docs.mjs [--offline]
 *
 * `--offline` skips fetching and reuses whatever is already in `.sources`,
 * which is what you want on a plane or in a loop of local rebuilds.
 *
 * To preview documentation you have not pushed yet, point a package at a
 * working copy instead of a clone:
 *
 *     DOCS_SOURCE_SCHEMA=../schema npm run pull
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cacheDir = path.join(root, '.sources');
const contentDir = path.join(root, 'content');
const versionedDocsDir = path.join(root, 'versioned_docs');
const versionedSidebarsDir = path.join(root, 'versioned_sidebars');
const versionsFile = path.join(root, 'versions.json');

const offline = process.argv.includes('--offline');

function fail(message) {
    console.error(`\n  ${message}\n`);
    process.exit(1);
}

function git(args, cwd = root) {
    return execFileSync('git', args, {
        cwd,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
}

/**
 * Reads and validates the manifest. Every mistake it can catch here is a
 * mistake that would otherwise surface as a confusing Docusaurus error.
 */
async function readManifest() {
    const file = path.join(root, 'sources.json');

    if (!existsSync(file)) {
        fail('sources.json is missing.');
    }

    const manifest = JSON.parse(await fs.readFile(file, 'utf8'));
    const packages = manifest.packages ?? {};
    const versions = manifest.versions ?? [];

    if (Object.keys(packages).length === 0) {
        fail('sources.json declares no packages.');
    }

    if (versions.length === 0) {
        fail('sources.json declares no versions.');
    }

    const current = versions.filter((version) => version.current === true);

    if (current.length !== 1) {
        fail(
            `sources.json must mark exactly one version as "current": true, found ${current.length}. ` +
                'The current version is the one built from the newest branch, and the only one Docusaurus keeps outside versioned_docs.',
        );
    }

    for (const version of versions) {
        if (!version.name) {
            fail('Every version in sources.json needs a "name".');
        }

        const pinned = Object.keys(version.packages ?? {});

        if (pinned.length === 0) {
            fail(`Version "${version.name}" pins no packages.`);
        }

        for (const name of pinned) {
            if (!packages[name]) {
                fail(
                    `Version "${version.name}" pins the package "${name}", which is not declared in the "packages" object.`,
                );
            }
        }
    }

    return { packages, versions };
}

/**
 * Puts `<package>/docs` at the requested ref in the cache and answers with the
 * path to it. Clones are shallow, blobless, and sparse: the only thing fetched
 * is the documentation, which keeps a cold run fast even as a package grows.
 */
function fetchPackageDocs(name, source, ref) {
    const override = process.env[`DOCS_SOURCE_${name.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`];

    if (override) {
        const local = path.resolve(root, override, 'docs');

        if (!existsSync(local)) {
            fail(`DOCS_SOURCE override for "${name}" points at ${override}, which has no docs directory.`);
        }

        return { dir: local, revision: 'local working copy', local: true };
    }

    const checkout = path.join(cacheDir, name, ref.replace(/\//g, '-'));

    try {
        if (!existsSync(path.join(checkout, '.git'))) {
            if (offline) {
                fail(`--offline was given but ${name}@${ref} has never been fetched.`);
            }

            // An interrupted clone can leave a directory with no .git in it,
            // which git then refuses to clone into. Clearing it first keeps the
            // cache self-healing rather than something to delete by hand.
            rmSync(checkout, { recursive: true, force: true });

            git(['clone', '--filter=blob:none', '--sparse', '--branch', ref, source.repo, checkout]);
            git(['sparse-checkout', 'set', 'docs'], checkout);
        } else if (!offline) {
            git(['fetch', 'origin', ref], checkout);
            git(['reset', '--hard', 'FETCH_HEAD'], checkout);
            git(['sparse-checkout', 'set', 'docs'], checkout);
        }
    } catch (error) {
        const detail = (error.stderr ?? error.message ?? '').toString().trim();

        fail(
            `Could not fetch ${name}@${ref} from ${source.repo}.\n  ${detail}\n\n` +
                `  Does the ref exist? Release branches are named for their major and minor version, so "1" is a major and "1.2" is a branch.`,
        );
    }

    const dir = path.join(checkout, 'docs');

    if (!existsSync(dir)) {
        fail(`${name}@${ref} has no docs directory. Nothing to publish for that version.`);
    }

    return { dir, revision: git(['rev-parse', '--short', 'HEAD'], checkout), local: false };
}

async function countMarkdown(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true, recursive: true });

    return entries.filter((entry) => entry.isFile() && /\.mdx?$/.test(entry.name)).length;
}

/**
 * Stamps each page with the date of the commit that last touched it, in the
 * repository that owns it.
 *
 * Docusaurus works this out from git history, but the history it would read is
 * this repository's, and the markdown is not committed here — every page would
 * report the date of the pull. The date that means anything is the one from the
 * package, so it is written into the front matter, which takes precedence.
 */
function stampLastUpdate(sourceDir, destination, relativePath) {
    let date;

    try {
        date = git(['log', '-1', '--format=%aI', '--', path.posix.join('docs', relativePath)], sourceDir);
    } catch {
        return;
    }

    if (!date) {
        return;
    }

    const contents = readFileSync(destination, 'utf8');
    const frontMatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(contents);

    // A page without front matter is a page the owning package has not written
    // to the documented conventions. Leave it be rather than invent a header.
    if (!frontMatter || /^last_update:/m.test(frontMatter[1])) {
        return;
    }

    writeFileSync(
        destination,
        contents.replace(frontMatter[0], `---\n${frontMatter[1]}\nlast_update:\n  date: ${date}\n---`),
    );
}

/**
 * The package repositories deliberately ship no `_category_.json` at the root
 * of their `docs` directory: a package does not know what it is called next to
 * its siblings, or in what order they appear. The site decides that, here.
 */
async function writeCategory(dir, name, source) {
    await fs.writeFile(
        path.join(dir, '_category_.json'),
        `${JSON.stringify(
            {
                label: source.label ?? name,
                position: source.position ?? 99,
                collapsed: false,
                link: {
                    type: 'generated-index',
                    title: source.label ?? name,
                    description: source.description ?? undefined,
                },
            },
            null,
            2,
        )}\n`,
    );
}

async function main() {
    const { packages, versions } = await readManifest();

    // Wiped rather than merged, so a package or version removed from the
    // manifest disappears from the build instead of lingering.
    for (const dir of [contentDir, versionedDocsDir, versionedSidebarsDir]) {
        await fs.rm(dir, { recursive: true, force: true });
    }

    await fs.rm(versionsFile, { force: true });

    const older = [];

    for (const version of versions) {
        const target = version.current
            ? contentDir
            : path.join(versionedDocsDir, `version-${version.name}`);

        console.log(`\n${version.label ?? version.name}${version.current ? ' (current)' : ''}`);

        await fs.mkdir(target, { recursive: true });

        for (const [name, pin] of Object.entries(version.packages)) {
            const source = packages[name];
            const { dir, revision, local } = fetchPackageDocs(name, source, pin.ref);
            const destination = path.join(target, name);

            await fs.cp(dir, destination, { recursive: true });
            await writeCategory(destination, name, source);

            if (!local) {
                const checkout = path.resolve(dir, '..');

                for (const page of await fs.readdir(destination, { withFileTypes: true, recursive: true })) {
                    if (!page.isFile() || !/\.mdx?$/.test(page.name)) {
                        continue;
                    }

                    const absolute = path.join(page.parentPath, page.name);

                    stampLastUpdate(checkout, absolute, path.relative(destination, absolute).split(path.sep).join('/'));
                }
            }

            const pages = await countMarkdown(destination);

            console.log(`  ${name.padEnd(12)} ${pin.ref.padEnd(8)} ${String(revision).padEnd(20)} ${pages} pages${local ? '  (override)' : ''}`);
        }

        if (!version.current) {
            older.push(version.name);

            // Every version uses the same autogenerated sidebar, built from the
            // per-package `_category_.json` and each page's `sidebar_position`.
            await fs.mkdir(versionedSidebarsDir, { recursive: true });
            await fs.writeFile(
                path.join(versionedSidebarsDir, `version-${version.name}-sidebars.json`),
                `${JSON.stringify({ docs: [{ type: 'autogenerated', dirName: '.' }] }, null, 2)}\n`,
            );
        }
    }

    // Docusaurus reads this to know which versions exist, newest first, and
    // expects the current version to be absent from it.
    if (older.length > 0) {
        await fs.writeFile(versionsFile, `${JSON.stringify(older, null, 2)}\n`);
    }

    console.log(`\nDone. ${versions.length} version(s) ready.\n`);
}

await main();
