import React from 'react';

const ShiftList: React.FC = () => {
  const shifts = [
    { id: '1', date: '2024-10-01', total: '$320.00' },
    { id: '2', date: '2024-10-03', total: '$280.00' },
  ];

  return (
    <section>
      <header>
        <h2>Recent Shifts</h2>
      </header>
      <ul>
        {shifts.map((shift) => (
          <li key={shift.id}>
            <strong>{shift.date}</strong> — {shift.total}
          </li>
        ))}
      </ul>
    </section>
  );
};

export default ShiftList;
