# Contributing

## Branching

This repository has a single long-lived branch, `main`.

That is deliberately unlike the packages, which have no `main` and give every
supported version its own branch. A package needs a branch per version because
`0.1` and `1.0` are different code that has to be maintained, tested, and
released independently. This repository is not versioned that way: it builds
*every* documentation version from one commit, by pulling each version's
markdown from the branch that carries it. A branch per version here would mean
several branches racing to publish the same site.

Work happens on a short-lived branch and arrives through a pull request. Name it
after what it does:

| Branch | For |
| --- | --- |
| `feature/<issue>-short-slug` | A change to the site. |
| `bugfix/<issue>-short-slug` | A fix for a reported bug. |

## What belongs here, and what does not

Usage documentation does not belong in this repository. It belongs in the `docs`
directory of the package it describes, so that a change in behaviour and the
paragraph describing it are reviewed in the same pull request. This repository
holds the site that publishes it.

So:

- **A wrong or missing paragraph** is a pull request against the package. The
  "Edit this page" link on every page goes to the right file in the right
  repository, on the branch the version pins.
- **A broken relative link** is also a pull request against the package, even
  though this repository's build is what fails.
- **A new package, or a new documentation version** is a change to
  [`sources.json`](sources.json) here.
- **Anything about how the documentation looks or is assembled** is a change
  here: the theme, the landing page, the pull script, the workflows.

Release notes are the exception. They describe releases across packages rather
than any one package, so they live in [`blog`](blog).

## Before you open a pull request

Run what CI runs:

```sh
docker compose exec docusaurus npm run ci
```

That pulls the documentation from every repository in `sources.json` and builds
the site. CI builds in the same image against the same manifest, so a green run
locally means a green run there. The individual commands are in
[README.md](README.md).

Your pull request needs:

- **Every check green.** A single `CI` check reports the result of the build.
- **A build with no warnings.** Broken links, broken anchors, and broken images
  fail the build rather than warn, because each one is a 404 that nobody notices
  until a reader hits it. If the cause is in a package, fix it there and say so
  in the pull request.
- **`sources.json` and the site agreeing.** The sidebar, the landing page cards,
  and the footer are all generated from the manifest. If you find yourself
  hard-coding a package name in the theme, the manifest is the place for it.

## Deployment

Merging to `main` publishes the site. There is no release to cut and no tag to
push: the site has no version of its own, only the versions it publishes.

A nightly build also runs, because documentation merged in a package repository
changes what this site should show without producing a commit here. If you need
the published site to catch up sooner, run the `Deploy` workflow by hand.
