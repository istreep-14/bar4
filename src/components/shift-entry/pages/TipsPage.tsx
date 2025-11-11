import React from 'react';
import styles from './TipsPage.module.css';

type TipsPageProps = {
  formData: any;
  tipsTotalValue: number;
  chumpChangeValue: number;
  earningsSnapshot: any;
  onNavigateOverview: () => void;
  onUpdate: (path: string, value: any) => void;
  toFixed: (value: any) => string;
};

const TipsPage: React.FC<TipsPageProps> = ({
  formData,
  tipsTotalValue,
  chumpChangeValue,
  earningsSnapshot,
  onNavigateOverview,
  onUpdate,
  toFixed,
}) => {
  return (
    <div className={`${styles.root} glass rounded-2xl p-6 border border-slate-800/60 space-y-6`}>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-4">
          <p className="text-xs uppercase tracking-wider text-slate-500">Tip Out</p>
          <p className="mt-3 text-3xl font-semibold text-cyan-300">${toFixed(tipsTotalValue)}</p>
          <p className="text-xs text-slate-500 mt-1">Edit from the overview page.</p>
          <button
            type="button"
            onClick={onNavigateOverview}
            className="text-xs text-cyan-200 hover:text-white flex items-center gap-2 mt-3"
          >
            Adjust Overview
            <i className="fas fa-arrow-right" />
          </button>
        </div>
        <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-4">
          <label className="text-xs uppercase tracking-wider text-slate-500">Chump Change</label>
          <input
            type="number"
            step="0.01"
            value={formData.earnings?.tips?.chumpChange ?? ''}
            onChange={(e) => onUpdate('earnings.tips.chumpChange', e.target.value)}
            className="mt-3 w-full px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-xl"
            placeholder="0.00"
          />
          <p className="text-xs text-slate-500 mt-2">
            Currently adds ${toFixed(chumpChangeValue)} to reported tips.
          </p>
        </div>
        <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-4">
          <p className="text-xs uppercase tracking-wider text-slate-500">Tips Summary</p>
          <div className="mt-3 space-y-2 text-sm text-slate-300">
            <div className="flex justify-between">
              <span>Tip Out</span>
              <span className="font-semibold text-cyan-300">${toFixed(tipsTotalValue)}</span>
            </div>
            <div className="flex justify-between">
              <span>Chump Change</span>
              <span className="font-semibold text-fuchsia-300">${toFixed(chumpChangeValue)}</span>
            </div>
            <div className="flex justify-between border-t border-slate-800/50 pt-2">
              <span>Total Tips</span>
              <span className="font-bold text-emerald-300">
                ${toFixed(earningsSnapshot?.tips?.total)}
              </span>
            </div>
          </div>
        </div>
      </div>
      <div className="border border-slate-800/60 rounded-2xl p-4 bg-slate-900/40 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-wider text-slate-500">Chump Log</p>
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500">Played?</label>
            <input
              type="checkbox"
              checked={formData.chump?.played || false}
              onChange={(e) => onUpdate('chump.played', e.target.checked)}
              className="accent-cyan-500"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <input
            type="number"
            step="0.01"
            value={formData.chump?.amount?.total || ''}
            onChange={(e) => onUpdate('chump.amount.total', e.target.value)}
            className="w-full px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-xl"
            placeholder="Pot total"
          />
          <input
            type="text"
            value={formData.chump?.winner || ''}
            onChange={(e) => onUpdate('chump.winner', e.target.value)}
            className="w-full px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-xl"
            placeholder="Winner"
          />
          <select
            value={formData.chump?.outcome || ''}
            onChange={(e) => onUpdate('chump.outcome', e.target.value)}
            className="w-full px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-xl"
          >
            <option value="">Outcome</option>
            <option value="win">Win</option>
            <option value="loss">Loss</option>
            <option value="push">Push</option>
          </select>
        </div>
        <textarea
          value={formData.chump?.notes || ''}
          onChange={(e) => onUpdate('chump.notes', e.target.value)}
          className="w-full px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-xl text-sm"
          placeholder="Notes"
        />
      </div>
    </div>
  );
};

export default TipsPage;
