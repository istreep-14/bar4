import React from 'react';
import FormField from '../shared/FormField';

type Cut = {
  id: string;
  label: string;
  status: string;
  amount: string;
};

type CutsPageProps = {
  cuts: Cut[];
  onRecordCut: (id: string, amount: string) => void;
};

const CutsPage: React.FC<CutsPageProps> = ({ cuts, onRecordCut }) => (
  <section>
    <header>
      <h3>Cuts &amp; Distributions</h3>
      <p>Track house, support, and other tip-outs.</p>
    </header>
    <ul>
      {cuts.map((cut) => (
        <li key={cut.id}>
          <FormField label={`${cut.label} (${cut.status})`}>
            <input
              value={cut.amount}
              onChange={(event) => onRecordCut(cut.id, event.target.value)}
              placeholder="$0.00"
            />
          </FormField>
        </li>
      ))}
    </ul>
  </section>
);

export default CutsPage;
