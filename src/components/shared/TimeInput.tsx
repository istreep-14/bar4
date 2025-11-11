import React from 'react';
import styles from './shared.module.css';

type TimeInputProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
};

const TimeInput: React.FC<TimeInputProps> = ({ label, value, onChange }) => (
  <label className={styles.formField}>
    <span className={styles.label}>{label}</span>
    <input
      className={styles.input}
      placeholder="e.g. 4:30p"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  </label>
);

export default TimeInput;
