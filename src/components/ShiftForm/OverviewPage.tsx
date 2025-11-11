import React from 'react';
import StatCard from '../shared/StatCard';
import FormField from '../shared/FormField';

type OverviewPageProps = {
  notes: string;
  onUpdateNotes: (value: string) => void;
};

const OverviewPage: React.FC<OverviewPageProps> = ({ notes, onUpdateNotes }) => (
  <section>
    <header>
      <h3>Overview</h3>
      <p>High-level summary of the shift.</p>
    </header>
    <div>
      <StatCard label="Projected Total" value="$0.00" helperText="Calculated from tips + wage + supplement." />
    </div>
    <FormField label="Shift Notes">
      <textarea value={notes} onChange={(event) => onUpdateNotes(event.target.value)} />
    </FormField>
  </section>
);

export default OverviewPage;
