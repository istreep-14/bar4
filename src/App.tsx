import React, { useState } from 'react';
import Layout from './components/Layout/Layout';
import Dashboard from './components/Dashboard/Dashboard';
import ShiftForm from './components/ShiftForm/ShiftForm';
import CoworkerDatabase from './components/Coworkers/CoworkerDatabase';

const App: React.FC = () => {
  const [view, setView] = useState<'dashboard' | 'shift-form' | 'coworkers'>('dashboard');

  const renderView = () => {
    switch (view) {
      case 'shift-form':
        return <ShiftForm />;
      case 'coworkers':
        return <CoworkerDatabase />;
      case 'dashboard':
      default:
        return <Dashboard />;
    }
  };

  return <Layout onNavigate={(section) => setView(section as typeof view)}>{renderView()}</Layout>;
};

export default App;
