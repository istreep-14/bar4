import React from 'react';
import StatCard from '../shared/StatCard';

const ChartsPanel: React.FC = () => (
  <section>
    <header>
      <h2>Performance</h2>
    </header>
    <div>
      <p>Charts will visualise tips, wage, and supplement trends.</p>
      <StatCard label="Placeholder Chart" value="Coming Soon" />
    </div>
  </section>
);

export default ChartsPanel;
