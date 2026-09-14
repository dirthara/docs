<p align="center">
  <img src="brand/logo-no-bg.png" alt="Dirthara" width="480">
</p>

# Dirthara Docs

The documentation site for the Dirthara packages, published to
[dirthara.github.io/docs](https://dirthara.github.io/docs).

Every Dirthara package keeps its usage documentation as markdown in its own
`docs` directory, next to the code it describes, written to be Docusaurus-ready.
This repository collects those directories and builds them into one site with a
category per package and a version per major release.

The markdown is not copied into this repository. Each build pulls it from the
package repositories at the git ref the version pins, so a page on this site is
the page that shipped with the code. What lives here is the site: the theme, the
landing page, the release notes, and [`sources.json`](sources.json), which maps
every package and version to a ref.

## Docker development environment

Requires Docker with Docker Compose. The image provides Node 24 and git, which
the pull script needs to reach the package repositories. Nothing has to be
installed on the host.

```sh
LOCAL_UID=$(id -u) LOCAL_GID=$(id -g) docker compose up -d --build docusaurus
docker compose exec docusaurus npm ci
```

`LOCAL_UID` and `LOCAL_GID` build the container's user with your own ids, so
files it writes into the working directory belong to you. `node_modules` lives
in a named volume rather than the bind mount, because its binaries are built for
the image and not for your machine.

## Running the site

Collect the documentation, then start the development server:

```sh
docker compose exec docusaurus npm run pull
docker compose exec docusaurus npm start
```

The site is at [localhost:3000/docs](http://localhost:3000/docs). Set
`DOCS_PORT` if something already holds port 3000.

`npm run pull` reaches out to every repository in `sources.json`, so it needs
network access. It caches its clones in `.sources`, which makes a second run
cheap; pass `--offline` to skip fetching and rebuild from that cache.

To preview documentation you have not pushed yet, point a package at a working
copy instead of a clone:

```sh
docker compose exec -e DOCS_SOURCE_SCHEMA=../schema docusaurus npm run pull
```

## Building the site

```sh
docker compose exec docusaurus npm run build
docker compose exec docusaurus npm run serve
```

`npm run ci` does the pull and the build together, which is what the workflows
run. Broken links, broken anchors, and broken images all fail the build. Since
the markdown comes from the package repositories, that is where a bad relative
link in a package gets caught — the failure names the file, and the fix belongs
in the package that owns it.

## Adding a package

Add it to the `packages` object in [`sources.json`](sources.json), then pin it in
every version that should carry it:

```json
{
  "packages": {
    "cache": {
      "repo": "https://github.com/dirthara/cache.git",
      "label": "Cache",
      "position": 6,
      "description": "One sentence, shown on the landing page and the category index."
    }
  },
  "versions": [
    { "name": "dev", "current": true, "packages": { "cache": { "ref": "0.1" } } }
  ]
}
```

`label` and `position` become the package's category in the sidebar;
`description` becomes its card on the landing page and the blurb on its category
index. Nothing else needs to change: the sidebar is generated from what the pull
script lays down, and each page orders itself by the `sidebar_position` in its
own front matter.

The card and the footer link open the package's `intro` page, which every
package ships. They do not link the category path: that only resolves for a
package that happens to carry a page named after itself, the way `database` does
with `database.md`.

## The package template

Every Dirthara package begins as a copy of
[`dirthara/package-template`](https://github.com/dirthara/package-template),
which carries the Docker development environment, the Mago and PHPUnit
configuration, the CI workflow and its coverage gate, the branch-per-version
contributing rules, and a `docs` directory already laid out for this site. Its
`TEMPLATE.md` walks through creating a package; registering it in
[`sources.json`](sources.json) is the last step.

That is why a new package needs nothing here but a manifest entry. The
conventions the pull script and the build rely on — front matter carrying `id`,
`title`, `sidebar_position`, and `description` on every page, a
`_category_.json` in every subdirectory, relative links that keep their `.md`
extension, MDX-safe prose — are written down in the template's
`agents/documentation.md` and inherited by every package copied from it. A
package ships a `docs/intro.md` and a `docs/installation.md` from its first
commit, so it can be published before it has an API.

The template is not a package and is never added to the manifest: its
documentation still holds the placeholders the init script fills in. Because the
scaffold is copied rather than inherited, a change to those conventions has to
be made in the template and carried into the packages already copied from it —
otherwise the next package starts from the old shape and this site is what
notices.

## Opening a documentation version

Documentation is published per major version. `dev` is the current version and
follows the newest release branch of each package. When a major is released, add
a version for it and repoint `dev`:

```json
{
  "versions": [
    { "name": "dev", "label": "dev", "current": true, "banner": "unreleased",
      "packages": { "database": { "ref": "1.1" }, "schema": { "ref": "1.0" } } },

    { "name": "1", "label": "1.x",
      "packages": { "database": { "ref": "1.0" }, "schema": { "ref": "1.0" } } }
  ]
}
```

Each package pins its own ref within a version, so a version can carry
`database` 1.1 and `schema` 1.0 — packages release on their own schedule. List
versions newest first; exactly one is `current`.

The current version is built into `content`, and every older one into
`versioned_docs`. Both are generated and both are ignored by git, so
`docusaurus docs:version` is never run: it would snapshot whatever happened to
be checked out, which is the wrong thing when versions come from different refs.

## Images

The logo, favicon, and social card are derived from the originals in
[`brand`](brand), which are the same files the package repositories carry:

```sh
docker compose exec docusaurus npm run images
```

The originals are between 0.4 and 1.4 MB each, far too heavy to serve. The
derivatives in `static/img` are committed, so a plain build needs no image
tooling; regenerate them only when the brand changes.

## Deployment

Pushing to `main` builds the site and publishes it to GitHub Pages. The workflow
also runs on a nightly schedule, because the documentation lives in the package
repositories: a merge there changes what this site should show without producing
a commit here, and nothing would otherwise rebuild it. `workflow_dispatch`
publishes on demand.

Branching and pull request rules are in [CONTRIBUTING.md](CONTRIBUTING.md).

## License

Released under the [MIT License](LICENSE).
