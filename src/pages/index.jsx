import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import PackageCards from '@site/src/components/PackageCards';
import sources from '@site/sources.json';
import Layout from '@theme/Layout';

import styles from './index.module.css';

const currentVersion = sources.versions.find((version) => version.current);

export default function Home() {
    const { siteConfig } = useDocusaurusContext();

    return (
        <Layout title="Documentation" description={siteConfig.tagline}>
            <header className={styles.hero}>
                <div className="container">
                    <img
                        className={styles.logo}
                        src={`${siteConfig.baseUrl}img/logo-square.png`}
                        alt=""
                    />
                    <h1 className={styles.title}>{siteConfig.title}</h1>
                    <p className={styles.tagline}>{siteConfig.tagline}</p>
                    <Link
                        className="button button--primary button--lg"
                        to={`/${currentVersion.name}/database/intro`}
                    >
                        Read the documentation
                    </Link>
                </div>
            </header>
            <main>
                <PackageCards />
            </main>
        </Layout>
    );
}
