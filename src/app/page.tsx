import { Banner } from '@/components/banner/banner';
import { CompareForm } from '@/components/CompareForm';
import styles from './page.module.css';
export default function Home() {
  return (
    <main className={styles.home}>
      <Banner />
      <section className={styles.compare} aria-labelledby="compare-title">
        <CompareForm />
      </section>
    </main>
  );
}
