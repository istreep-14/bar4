import React from 'react';
import styles from './WagePage.module.css';

type WagePageProps = {
  formData: any;
  timeErrors: Record<string, string>;
  getTimeDraftValue: (path: string) => string;
  handleTimeDraftChange: (path: string, value: string) => void;
  commitTimeValue: (path: string, value: string, options?: any) => void;
  updateFormPath: (path: string, value: any) => void;
  wageClockHours: number | null;
  wageTotal: number;
  earningsSnapshot: any;
  overtimeInputValue: number;
  toFixed: (value: any) => string;
};

const WagePage: React.FC<WagePageProps> = ({
  formData,
  timeErrors,
  getTimeDraftValue,
  handleTimeDraftChange,
  commitTimeValue,
  updateFormPath,
  wageClockHours,
  wageTotal,
  earningsSnapshot,
  overtimeInputValue,
  toFixed,
}) => {
  return (
    <div className={`${styles.root} glass rounded-2xl p-6 border border-slate-800/60 space-y-6`}>
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-4">
        <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-4 space-y-3">
          <p className="text-xs uppercase tracking-wider text-slate-500">Wage Clock</p>
          <div>
            <label className="text-xs uppercase text-slate-500">Base Rate</label>
            <input
              type="text"
              value={formData.wage.base ?? ''}
              onChange={(e) => updateFormPath('wage.base', e.target.value)}
              className="mt-1 w-full px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-xl"
              placeholder="5.00"
            />
          </div>
          <div>
            <label className="text-xs uppercase text-slate-500">Hours</label>
            <input
              type="text"
              value={formData.wage.hours ?? ''}
              onChange={(e) => updateFormPath('wage.hours', e.target.value)}
              className="mt-1 w-full px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-xl"
              placeholder="6"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="text-xs uppercase text-slate-500">Clock Start</label>
              <div className="mt-1 space-y-1">
                <input
                  type="text"
                  inputMode="numeric"
                  value={getTimeDraftValue('wage.clock.start')}
                  onChange={(e) => handleTimeDraftChange('wage.clock.start', e.target.value)}
                  onBlur={(e) => commitTimeValue('wage.clock.start', e.target.value, { mode: 'start' })}
                  onFocus={(e) => e.target.select()}
                  className="w-full px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-xl"
                  placeholder="10"
                />
                {timeErrors['wage.clock.start'] && (
                  <p className="text-xs text-amber-400">{timeErrors['wage.clock.start']}</p>
                )}
              </div>
            </div>
            <div>
              <label className="text-xs uppercase text-slate-500">Clock End</label>
              <div className="mt-1 space-y-1">
                <input
                  type="text"
                  inputMode="numeric"
                  value={getTimeDraftValue('wage.clock.end')}
                  onChange={(e) => handleTimeDraftChange('wage.clock.end', e.target.value)}
                  onBlur={(e) =>
                    commitTimeValue('wage.clock.end', e.target.value, {
                      mode: 'end',
                      referenceStart: formData.wage?.clock?.start,
                    })
                  }
                  onFocus={(e) => e.target.select()}
                  className="w-full px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-xl"
                  placeholder="6p"
                />
                {timeErrors['wage.clock.end'] && (
                  <p className="text-xs text-amber-400">{timeErrors['wage.clock.end']}</p>
                )}
              </div>
            </div>
          </div>
          {wageClockHours != null && (
            <p className="text-xs text-slate-500">Clocked {wageClockHours.toFixed(2)} hours</p>
          )}
          <p className="text-xs text-slate-500">Base total ${toFixed(wageTotal)}</p>
        </div>
        <div className="space-y-4">
          <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-4">
            <p className="text-xs uppercase tracking-wider text-slate-500">Differential</p>
            <div className="mt-3 space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  type="number"
                  step="0.01"
                  value={formData.earnings?.wage?.differential?.managerDifferential ?? ''}
                  onChange={(e) => updateFormPath('earnings.wage.differential.managerDifferential', e.target.value)}
                  className="px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-xl"
                  placeholder="Manager"
                />
                <input
                  type="number"
                  step="0.01"
                  value={formData.earnings?.wage?.differential?.shiftDifferential ?? ''}
                  onChange={(e) => updateFormPath('earnings.wage.differential.shiftDifferential', e.target.value)}
                  className="px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-xl"
                  placeholder="Shift"
                />
                <input
                  type="number"
                  step="0.01"
                  value={formData.earnings?.wage?.differential?.trainingDifferential ?? ''}
                  onChange={(e) => updateFormPath('earnings.wage.differential.trainingDifferential', e.target.value)}
                  className="px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-xl"
                  placeholder="Training"
                />
              </div>
              <p className="text-xs text-slate-500">
                Combined ${toFixed(earningsSnapshot?.wage?.differential?.total)}
              </p>
            </div>
          </div>
          <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-4">
            <p className="text-xs uppercase tracking-wider text-slate-500">Overtime</p>
            <input
              type="number"
              step="0.01"
              value={formData.earnings?.wage?.overtime ?? formData.earnings?.overtime ?? ''}
              onChange={(e) => updateFormPath('earnings.wage.overtime', e.target.value)}
              className="mt-3 w-full px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-xl"
              placeholder="0.00"
            />
            <p className="text-xs text-slate-500 mt-2">Currently ${toFixed(overtimeInputValue)}</p>
          </div>
          <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-4">
            <p className="text-xs uppercase tracking-wider text-slate-500">Wage Summary</p>
            <div className="mt-3 space-y-2 text-sm text-slate-300">
              <div className="flex justify-between">
                <span>Base</span>
                <span className="font-semibold text-emerald-300">
                  ${toFixed(earningsSnapshot?.wage?.base)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Differential</span>
                <span className="font-semibold text-indigo-300">
                  ${toFixed(earningsSnapshot?.wage?.differential?.total)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Overtime</span>
                <span className="font-semibold text-amber-300">
                  ${toFixed(earningsSnapshot?.wage?.overtime)}
                </span>
              </div>
              <div className="flex justify-between border-t border-slate-800/50 pt-2">
                <span>Total Wage</span>
                <span className="font-bold text-cyan-300">
                  ${toFixed(earningsSnapshot?.wage?.total)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WagePage;
