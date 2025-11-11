import React from 'react';
import styles from './CoworkerDatabase.module.css';

const CoworkerDatabase: React.FC = () => {
  const coworkers = [
    { id: '1', name: 'Morgan', role: 'Bartender', lastShift: '2024-09-29' },
    { id: '2', name: 'Reese', role: 'Server', lastShift: '2024-10-01' },
  ];

  return (
    <section className={styles.root}>
      <header>
        <h2>Crew Database</h2>
        <p>Track teammates, preferred sections, and availability.</p>
      </header>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Name</th>
            <th>Role</th>
            <th>Last Shift</th>
          </tr>
        </thead>
        <tbody>
          {coworkers.map((coworker) => (
            <tr key={coworker.id}>
              <td>{coworker.name}</td>
              <td>{coworker.role}</td>
              <td>{coworker.lastShift}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
};

export default CoworkerDatabase;
