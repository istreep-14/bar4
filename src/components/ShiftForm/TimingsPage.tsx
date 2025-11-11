import React from 'react';
import TimeInput from '../shared/TimeInput';

type TimingsPageProps = {
  onUpdateTime: (path: string, value: string) => void;
};

const TimingsPage: React.FC<TimingsPageProps> = ({ onUpdateTime }) => (
  <section>
    <header>
      <h3>Timings</h3>
      <p>Capture scheduled and actual shift windows.</p>
    </header>
    <div>
      <TimeInput label="Scheduled Start" value="16:00" onChange={(value) => onUpdateTime('time.scheduled.start', value)} />
      <TimeInput label="Scheduled End" value="23:00" onChange={(value) => onUpdateTime('time.scheduled.end', value)} />
    </div>
  </section>
);

export default TimingsPage;
