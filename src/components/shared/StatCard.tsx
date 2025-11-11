import React from 'react';
import styles from './shared.module.css';

type StatCardProps = {
  label: string;
  value: string;
  helperText?: string;
};

const StatCard: React.FC<StatCardProps> = ({ label, value, helperText }) => (
  <article className={styles.statCard}>
    <span className={styles.label}>{label}</span>
    <strong>{value}</strong>
    {helperText && <small>{helperText}</small>}
  </article>
);

export default StatCard;
