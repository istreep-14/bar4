import React from 'react';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'shift-form', label: 'Shift Form' },
  { id: 'coworkers', label: 'Crew Database' },
];

type SidebarProps = {
  onNavigate: (id: string) => void;
};

const Sidebar: React.FC<SidebarProps> = ({ onNavigate }) => (
  <aside>
    <h1>Bar Tracker</h1>
    <nav>
      <ul>
        {NAV_ITEMS.map((item) => (
          <li key={item.id}>
            <button type="button" onClick={() => onNavigate(item.id)}>
              {item.label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  </aside>
);

export default Sidebar;
