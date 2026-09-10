---
title: The documentation site is live
authors: [dirthara]
tags: [documentation]
---

Every Dirthara package writes its usage documentation as markdown in its own
`docs` directory, next to the code it describes. That is where it belongs: a
change in behaviour and the paragraph describing it land in the same pull
request, reviewed together.

It is not, however, where anybody wants to read it.

{/* truncate */}

This site collects those directories and publishes them as one set of
documentation, with a category per package. The markdown is not copied here.
Each build pulls it from the package repositories at the git ref the version
pins, so a page on this site is the page that shipped with the code.

Documentation is published per major version. There is no `1.0` yet, so there
is one version — `dev` — built from the newest release branch of each package.
When the first major lands, `dev` keeps following the newest branch and `1`
becomes a version of its own, still built from the branch that carries it.
