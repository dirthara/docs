# Project instructions

## Ownership
Dirthara owns this repository. Attribute copyright, licensing, and authorship to
`Dirthara` rather than to an individual maintainer. The MIT `LICENSE` reads
`Copyright (c) <year> Dirthara`, and new files or documents that name an owner
use the same name.

## What this repository is
It builds the documentation site, and it does not contain the documentation.
Every package writes its own usage documentation as markdown under its `docs`
directory; `scripts/pull-docs.mjs` collects those directories at the refs
[`sources.json`](sources.json) pins and lays them out for Docusaurus.

Never commit pulled markdown. `content`, `versioned_docs`, `versioned_sidebars`,
`versions.json`, and `.sources` are generated and ignored. A page that needs
changing is changed in the package that owns it.

## Branching
One long-lived branch, `main`. This is the exception in Dirthara: the packages
have a branch per supported version, and this repository does not, because it
publishes every version from a single commit. Read
[CONTRIBUTING.md](CONTRIBUTING.md) before branching.

## The manifest is the interface
Adding a package or a documentation version is an edit to `sources.json`, not to
the theme or the scripts. The sidebar, the landing page cards, the footer links,
and the version dropdown all derive from it. If a change would hard-code a
package name anywhere else, put it in the manifest instead.

## Failing loudly
Broken links, broken anchors, and broken images fail the build, and the pull
script exits non-zero on a missing ref or a package with no `docs` directory. A
silently missing page is worse than a red build, because the site keeps
publishing and nobody finds out. Keep it that way when adding configuration.

## Documentation
The `README.md` covers the repository: what the site is, how to run it in
Docker, how to add a package or a version, and how it deploys.
`CONTRIBUTING.md` owns branching, what belongs here versus in a package, and
what a pull request has to satisfy. Usage documentation for a package never
goes in either; it goes in that package.

Release notes go in `blog`. Declare authors in `blog/authors.yml` and tags in
`blog/tags.yml` — both are configured to reject inline values, so a typo fails
the build instead of creating a second author page. Every post needs a
`{/* truncate */}` marker, in MDX comment syntax rather than an HTML comment.
