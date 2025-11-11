import React from 'react';
import FormField from '../shared/FormField';

type EnhancementsPageProps = {
  onUpdateField: (path: string, value: string) => void;
};

const EnhancementsPage: React.FC<EnhancementsPageProps> = ({ onUpdateField }) => (
  <section>
    <header>
      <h3>Supplements &amp; Bonuses</h3>
      <p>Capture retention bonuses, consideration, or other incentives.</p>
    </header>
    <FormField label="Retention Bonus">
      <input
        placeholder="$0.00"
        onChange={(event) => onUpdateField('supplement.retention', event.target.value)}
      />
    </FormField>
  </section>
);

export default EnhancementsPage;
