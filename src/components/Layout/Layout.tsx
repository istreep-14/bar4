import React, { ReactNode } from 'react';
import Sidebar from './Sidebar';
import MobileNav from './MobileNav';
import styles from './Layout.module.css';

type LayoutProps = {
  children: ReactNode;
  onNavigate: (section: string) => void;
};

const Layout: React.FC<LayoutProps> = ({ children, onNavigate }) => (
  <div className={styles.layout}>
    <Sidebar onNavigate={onNavigate} />
    <main className={styles.main}>
      <MobileNav onNavigate={onNavigate} />
      {children}
    </main>
  </div>
);

export default Layout;
