import React from 'react';
import styles from './Dashboard.module.css';
import ShiftList from './ShiftList';
import MonthlyCalendar from './MonthlyCalendar';
import ChartsPanel from './ChartsPanel';
import StatCard from '../shared/StatCard';

const Dashboard: React.FC = () => {
  const summary = [
    { label: 'Shifts This Week', value: '4' },
    { label: 'Tips Collected', value: '$1,240' },
    { label: 'Average Hourly', value: '$38.50' },
  ];

  return (
    <section className={styles.root}>
      <div className={styles.grid}>
        {summary.map((card) => (
          <StatCard key={card.label} label={card.label} value={card.value} />
        ))}
      </div>
      <ChartsPanel />
      <MonthlyCalendar />
      <ShiftList />
    </section>
  );
};

export default Dashboard;
