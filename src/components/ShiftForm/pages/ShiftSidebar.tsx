// @ts-nocheck
import React from 'react';
import { useShiftFormContext } from '../ShiftFormContext';

const ShiftSidebar: React.FC = () => {
  const {
    shiftPageDefs,
    activePage,
    setActivePage,
    calculatedHours,
    displayedEarnings,
    displayedHourly,
    tipsPerHour,
    formData,
  } = useShiftFormContext();

  return (
    <aside className="w-full lg:w-72 space-y-4">
      <div className="glass rounded-2xl border border-slate-800/60 p-4 space-y-3">
        <h4 className="text-xs uppercase tracking-widest text-slate-500">Quick Stats</h4>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500">Earnings</p>
            <p className="text-lg font-semibold text-cyan-200">${displayedEarnings.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Hourly</p>
            <p className="text-lg font-semibold text-emerald-200">${displayedHourly.toFixed(2)}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setActivePage('timings')}
          className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl border border-slate-700 text-slate-200 hover:border-cyan-500/50 transition"
        >
          <span>
            Hours <span className="ml-1 text-xs text-slate-500">tap to edit</span>
          </span>
          <span className="font-semibold text-emerald-200">{(calculatedHours || 0).toFixed(1)}h</span>
        </button>
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Tips</span>
            <span className="text-slate-200">
              ${Number.parseFloat(formData.tips?._total || 0).toFixed(2)}
            </span>
          </div>
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>Tips / hr</span>
          <span className="text-slate-200">${tipsPerHour.toFixed(2)}</span>
        </div>
      </div>

      <div className="glass rounded-2xl border border-slate-800/60 divide-y divide-slate-800/50 overflow-hidden">
        {shiftPageDefs.map((page) => {
          const isActive = activePage === page.key;
          return (
            <button
              key={page.key}
              type="button"
              onClick={() => setActivePage(page.key)}
              className={`w-full flex items-center justify-between px-4 py-3 transition ${
                isActive ? 'bg-cyan-500/10 text-cyan-100' : 'bg-slate-900/50 text-slate-300 hover:bg-slate-900/70'
              }`}
            >
              <span className="flex items-center gap-3">
                <span
                  className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                    isActive ? 'bg-cyan-500/30 text-cyan-100' : 'bg-slate-900/80 text-slate-500'
                  }`}
                >
                  <i className={`fas ${page.icon}`}></i>
                </span>
                <span className="font-medium text-left">
                  {page.label}
                  {page.description && <span className="block text-xs font-normal text-slate-500">{page.description}</span>}
                </span>
              </span>
              <i className={`fas fa-chevron-right text-xs ${isActive ? 'text-cyan-300' : 'text-slate-500'}`}></i>
            </button>
          );
        })}
      </div>
    </aside>
  );
};

export default ShiftSidebar;
