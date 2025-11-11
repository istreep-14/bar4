import React from 'react';
import styles from './TimingsPage.module.css';

type TimingsPageProps = {
  formData: any;
  timeErrors: Record<string, string>;
  getTimeDraftValue: (path: string) => string;
  handleTimeDraftChange: (path: string, value: string) => void;
  commitTimeValue: (path: string, value: string, options?: any) => void;
  updateFormPath: (path: string, value: any) => void;
};

const TIMING_BUCKETS = ['present', 'clock', 'tips', 'working'];

const TimingsPage: React.FC<TimingsPageProps> = ({
  formData,
  timeErrors,
  getTimeDraftValue,
  handleTimeDraftChange,
  commitTimeValue,
  updateFormPath,
}) => {
  return (
    <div className={`${styles.root} glass rounded-2xl p-6 border border-slate-800/60 space-y-4`}>
      <h3 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
        <i className="fas fa-clock text-slate-400" />
        Timing Buckets
      </h3>
      {TIMING_BUCKETS.map((bucket) => (
        <div key={bucket} className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
          <div className="md:col-span-1">
            <p className="text-xs uppercase tracking-wider text-slate-500">{bucket.toUpperCase()}</p>
          </div>
          <div className="md:col-span-1">
            <label className="text-xs text-slate-500">Start</label>
            <div className="mt-1 space-y-1">
              <input
                type="text"
                inputMode="numeric"
                value={getTimeDraftValue(`time.${bucket}.start`)}
                onChange={(e) => handleTimeDraftChange(`time.${bucket}.start`, e.target.value)}
                onBlur={(e) => commitTimeValue(`time.${bucket}.start`, e.target.value, { mode: 'start' })}
                onFocus={(e) => e.target.select()}
                className="w-full px-4 py-2 bg-slate-900/60 border border-slate-700 rounded-xl"
                placeholder="e.g. 4p"
              />
              {timeErrors[`time.${bucket}.start`] && (
                <p className="text-xs text-amber-400">{timeErrors[`time.${bucket}.start`]}</p>
              )}
            </div>
          </div>
          <div className="md:col-span-1">
            <label className="text-xs text-slate-500">End</label>
            <div className="mt-1 space-y-1">
              <input
                type="text"
                inputMode="numeric"
                value={getTimeDraftValue(`time.${bucket}.end`)}
                onChange={(e) => handleTimeDraftChange(`time.${bucket}.end`, e.target.value)}
                onBlur={(e) =>
                  commitTimeValue(`time.${bucket}.end`, e.target.value, {
                    mode: 'end',
                    referenceStart: formData.time?.[bucket]?.start,
                  })
                }
                onFocus={(e) => e.target.select()}
                className="w-full px-4 py-2 bg-slate-900/60 border border-slate-700 rounded-xl"
                placeholder="e.g. 1230"
              />
              {timeErrors[`time.${bucket}.end`] && (
                <p className="text-xs text-amber-400">{timeErrors[`time.${bucket}.end`]}</p>
              )}
            </div>
          </div>
          <div className="md:col-span-1">
            <label className="text-xs text-slate-500">Hours</label>
            <input
              type="number"
              step="0.25"
              value={formData.time[bucket]?.hours || ''}
              onChange={(e) =>
                updateFormPath(`time.${bucket}.hours`, e.target.value === '' ? '' : parseFloat(e.target.value))
              }
              className="mt-1 w-full px-4 py-2 bg-slate-900/60 border border-slate-700 rounded-xl"
            />
          </div>
        </div>
      ))}
    </div>
  );
};

export default TimingsPage;
