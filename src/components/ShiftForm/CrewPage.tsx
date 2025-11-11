import React from 'react';

type CrewMember = {
  id: string;
  name: string;
  role: string;
  start?: string;
  end?: string;
};

type CrewPageProps = {
  coworkers: CrewMember[];
  onAddCoworker: (role: string) => void;
};

const CrewPage: React.FC<CrewPageProps> = ({ coworkers, onAddCoworker }) => (
  <section>
    <header>
      <h3>Crew Notes</h3>
      <p>Log who worked the shift and their timelines.</p>
      <div>
        <button type="button" onClick={() => onAddCoworker('Bartender')}>
          Add Bartender
        </button>
        <button type="button" onClick={() => onAddCoworker('Server')}>
          Add Server
        </button>
      </div>
    </header>
    <ul>
      {coworkers.map((coworker) => (
        <li key={coworker.id}>
          <strong>{coworker.name}</strong> — {coworker.role} ({coworker.start ?? '--'} - {coworker.end ?? '--'})
        </li>
      ))}
    </ul>
  </section>
);

export default CrewPage;
