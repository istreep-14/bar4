import React, { ReactNode } from 'react';
import styles from './shared.module.css';

type FormFieldProps = {
  label: string;
  children: ReactNode;
};

const FormField: React.FC<FormFieldProps> = ({ label, children }) => (
  <label className={styles.formField}>
    <span className={styles.label}>{label}</span>
    {children}
  </label>
);

export default FormField;
