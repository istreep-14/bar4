import React from 'react';
import styles from './ShiftForm.module.css';
import OverviewPage from './OverviewPage';
import TimingsPage from './TimingsPage';
import CutsPage from './CutsPage';
import CrewPage from './CrewPage';
import PartiesPage from './PartiesPage';
import EnhancementsPage from './EnhancementsPage';
import DrinkingPage from './DrinkingPage';
import { SHIFT_FORM_PAGES, useShiftForm } from '../../hooks/useShiftForm';
import { useTimeInputs } from '../../hooks/useTimeInputs';
import { useCuts } from '../../hooks/useCuts';
import { useCoworkers } from '../../hooks/useCoworkers';

const ShiftForm: React.FC = () => {
  const { activePage, setActivePage, formState, updateFormField, pages } = useShiftForm();
  const { parseTime } = useTimeInputs();
  const { cuts, recordCut } = useCuts();
  const { coworkers, addCoworker } = useCoworkers();

  const handleTimeChange = (path: string, value: string) => {
    const normalized = parseTime(value);
    updateFormField(path, normalized);
  };

  const renderPage = () => {
    switch (activePage) {
      case 'overview':
        return (
          <OverviewPage
            notes={formState.meta.notes}
            onUpdateNotes={(value) => updateFormField('meta.notes', value)}
          />
        );
      case 'timings':
        return <TimingsPage onUpdateTime={handleTimeChange} />;
      case 'cuts':
        return <CutsPage cuts={cuts} onRecordCut={recordCut} />;
      case 'crew':
        return <CrewPage coworkers={coworkers} onAddCoworker={addCoworker} />;
      case 'parties':
        return <PartiesPage />;
      case 'enhancements':
        return <EnhancementsPage onUpdateField={updateFormField} />;
      case 'drinking':
        return <DrinkingPage />;
      default:
        return null;
    }
  };

  return (
    <section className={styles.root}>
      <nav className={styles.nav} aria-label="Shift form pages">
        {(pages ?? SHIFT_FORM_PAGES).map((page) => (
          <button
            key={page}
            type="button"
            className={`${styles.navButton} ${activePage === page ? styles.navButtonActive : ''}`}
            onClick={() => setActivePage(page)}
          >
            {page}
          </button>
        ))}
      </nav>
      {renderPage()}
    </section>
  );
};

export default ShiftForm;
