// @ts-nocheck
import React from 'react';
import { useShiftFormContext } from '../ShiftFormContext';

const OverviewPage: React.FC = () => {
  const {
    formData,
    activePage,
    setActivePage,
    getTimeDraftValue,
    handleTimeDraftChange,
    commitTimeValue,
    timeErrors,
    handleTipsChange,
    updateFormPath,
    calculatedHours,
    displayedEarnings,
    displayedHourly,
    tipsPerHour,
    chumpStatus,
    quickPanels,
    statusBadgeClass,
    handleAddParty,
  } = useShiftFormContext();

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <label className="text-sm uppercase tracking-wide text-slate-400 flex items-center gap-2">
            Start Time
            <button type="button" onClick={() => setActivePage('timings')} className="text-slate-500 hover:text-cyan-300">
              <i className="fas fa-clock"></i>
            </button>
          </label>
          <div className="mt-2 space-y-1">
            <input
              type="text"
              inputMode="numeric"
              value={getTimeDraftValue('time.base.start')}
              onChange={(e) => handleTimeDraftChange('time.base.start', e.target.value)}
              onBlur={(e) => commitTimeValue('time.base.start', e.target.value, { mode: 'start' })}
              onFocus={(e) => e.target.select()}
              className="w-full px-5 py-5 bg-slate-900/60 border border-slate-700 rounded-2xl text-2xl tracking-wide focus:outline-none focus:ring-2 focus:ring-cyan-500"
              placeholder="e.g. 10"
              required
            />
            {timeErrors['time.base.start'] && <p className="text-xs text-amber-400">{timeErrors['time.base.start']}</p>}
          </div>
        </div>
        <div>
          <label className="text-sm uppercase tracking-wide text-slate-400 flex items-center gap-2">
            End Time
            <button type="button" onClick={() => setActivePage('timings')} className="text-slate-500 hover:text-cyan-300">
              <i className="fas fa-business-time"></i>
            </button>
          </label>
          <div className="mt-2 space-y-1">
            <input
              type="text"
              inputMode="numeric"
              value={getTimeDraftValue('time.base.end')}
              onChange={(e) => handleTimeDraftChange('time.base.end', e.target.value)}
              onBlur={(e) =>
                commitTimeValue('time.base.end', e.target.value, {
                  mode: 'end',
                  referenceStart: formData.time?.base?.start,
                })
              }
              onFocus={(e) => e.target.select()}
              className="w-full px-5 py-5 bg-slate-900/60 border border-slate-700 rounded-2xl text-2xl tracking-wide focus:outline-none focus:ring-2 focus:ring-cyan-500"
              placeholder="e.g. 630"
              required
            />
            {timeErrors['time.base.end'] && <p className="text-xs text-amber-400">{timeErrors['time.base.end']}</p>}
          </div>
        </div>
        <div>
          <label className="text-sm uppercase tracking-wide text-slate-400 flex items-center gap-2">
            <span>Tips</span>
            <button
              type="button"
              onClick={() => updateFormPath('meta.tipsPending', !formData.meta?.tipsPending)}
              className={`text-xs px-2 py-1 rounded-lg border ${
                formData.meta?.tipsPending ? 'border-amber-400 text-amber-200 bg-amber-400/10' : 'border-slate-600 text-slate-400 hover:border-slate-400'
              }`}
            >
              {formData.meta?.tipsPending ? 'Mark Received' : 'Mark Pending'}
            </button>
            <button
              type="button"
              onClick={() => setActivePage('cuts')}
              className="icon-button text-slate-500 hover:text-cyan-300"
              title="Open cuts"
            >
              <i className="fas fa-layer-group"></i>
            </button>
          </label>
          <div className="mt-2 relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-2xl">$</span>
            <input
              type="text"
              inputMode="decimal"
              pattern="[0-9]*[.,]?[0-9]*"
              value={formData.tips._total ?? ''}
              onChange={(e) => handleTipsChange(e.target.value)}
              onWheel={(e) => e.currentTarget.blur()}
              className="w-full pl-12 pr-4 py-5 bg-slate-900/60 border border-slate-700 rounded-2xl text-3xl font-semibold focus:outline-none focus:ring-2 focus:ring-cyan-500"
              placeholder="0.00"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="glass rounded-2xl p-4 border border-slate-800/60">
          <p className="text-xs uppercase tracking-widest text-slate-500">Total Earnings</p>
          <p className="mt-2 text-3xl font-semibold text-cyan-300">${displayedEarnings.toFixed(2)}</p>
          <p className="text-xs text-slate-500 mt-1">Includes tips, wage, adjustments</p>
        </div>
        <div className="glass rounded-2xl p-4 border border-slate-800/60">
          <p className="text-xs uppercase tracking-widest text-slate-500">Hours</p>
          <p className="mt-2 text-3xl font-semibold text-emerald-300">{(calculatedHours || 0).toFixed(1)}h</p>
          <p className="text-xs text-slate-500 mt-1">
            {formData.time.base.start || '--:--'} &rarr; {formData.time.base.end || '--:--'}
          </p>
        </div>
        <div className="glass rounded-2xl p-4 border border-slate-800/60">
          <p className="text-xs uppercase tracking-widest text-slate-500">Hourly</p>
          <p className="mt-2 text-3xl font-semibold text-indigo-300">${displayedHourly.toFixed(2)}</p>
          <p className="text-xs text-slate-500 mt-1">Tips/hr ${tipsPerHour.toFixed(2)}</p>
        </div>
        <div className="glass rounded-2xl p-4 border border-slate-800/60 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <i className="fas fa-dice text-sm text-slate-400"></i>
            <span className="text-xs uppercase tracking-widest text-slate-500">Chump</span>
            <span
              className={`badge-pill ${
                chumpStatus === 'recorded'
                  ? 'bg-emerald-400/20 text-emerald-200 border border-emerald-400/40'
                  : chumpStatus === 'pending'
                  ? 'bg-amber-400/20 text-amber-200 border border-amber-400/40'
                  : 'bg-slate-800 text-slate-400 border border-slate-700'
              }`}
            >
              {chumpStatus === 'recorded' ? 'Logged' : chumpStatus === 'pending' ? 'Result Pending' : 'Not Played'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setActivePage('enhancements')}
            className="text-sm text-cyan-200 hover:text-white flex items-center gap-2"
          >
            Manage Enhancements
            <i className="fas fa-arrow-right"></i>
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        {quickPanels.map((panel) => (
          <button
            key={panel.key}
            type="button"
            onClick={() => setActivePage(panel.page)}
            className={`icon-button glass px-4 py-3 rounded-2xl flex items-center gap-3 border border-slate-800/60 ${
              activePage === panel.page ? 'ring-2 ring-cyan-500/40' : ''
            }`}
          >
            <div className="relative">
              <span className="w-8 h-8 rounded-xl bg-slate-900/70 flex items-center justify-center text-cyan-300">
                <i className={`fas ${panel.icon}`}></i>
              </span>
              <span className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full shadow ${statusBadgeClass(panel.status)}`}></span>
            </div>
            <div className="text-left">
              <p className="text-xs uppercase tracking-wider text-slate-400">{panel.label}</p>
              <p className="text-sm font-semibold text-slate-200">{panel.metric || '—'}</p>
            </div>
            <i className={`fas ${activePage === panel.page ? 'fa-circle-dot text-cyan-200' : 'fa-arrow-right text-slate-600'}`}></i>
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            handleAddParty();
            setActivePage('parties');
          }}
          className="icon-button glass px-4 py-3 rounded-2xl flex items-center gap-2 text-slate-200 border border-slate-800/60 hover:border-cyan-500/50"
        >
          <i className="fas fa-plus"></i>
          Quick Add Party
        </button>
      </div>
    </div>
  );
};

export default OverviewPage;
