import React from 'react';

const MobileNav: React.FC<{ onNavigate: (section: string) => void }> = ({ onNavigate }) => (
  <nav aria-label="Mobile navigation">
    <select onChange={(event) => onNavigate(event.target.value)} defaultValue="dashboard">
      <option value="dashboard">Dashboard</option>
      <option value="shift-form">Shift Form</option>
      <option value="coworkers">Crew Database</option>
    </select>
  </nav>
);

export default MobileNav;
