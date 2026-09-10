import Link from '@docusaurus/Link';
import sources from '@site/sources.json';
import clsx from 'clsx';

import styles from './styles.module.css';

const currentVersion = sources.versions.find((version) => version.current);

/**
 * A card per package, ordered and described by sources.json. Adding a package
 * to the manifest adds it here, so the landing page cannot fall out of step
 * with what the site actually builds.
 */
export default function PackageCards() {
    const packages = Object.entries(sources.packages).sort(
        ([, a], [, b]) => (a.position ?? 99) - (b.position ?? 99),
    );

    return (
        <section className={styles.packages}>
            <div className="container">
                <div className="row">
                    {packages.map(([name, pkg]) => (
                        <div className={clsx('col', 'col--6')} key={name}>
                            <Link
                                className={styles.card}
                                to={`/${currentVersion.name}/${name}`}
                            >
                                <h2 className={styles.cardTitle}>{pkg.label ?? name}</h2>
                                <p className={styles.cardDescription}>{pkg.description}</p>
                                <code className={styles.cardInstall}>
                                    composer require dirthara/{name}
                                </code>
                            </Link>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
