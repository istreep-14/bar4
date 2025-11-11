import React from 'react';
import styles from './SupplementPage.module.css';

type SupplementPageProps = {
  formData: any;
  onUpdate: (path: string, value: any) => void;
  onAddConsideration: () => void;
  considerationAuto: number;
  considerationValue: number;
  retentionValue: number;
  toFixed: (value: any) => string;
};

const SupplementPage: React.FC<SupplementPageProps> = ({
  formData,
  onUpdate,
  onAddConsideration,
  considerationAuto,
  considerationValue,
  retentionValue,
  toFixed,
}) => {
  return (
    <div className={`${styles.root} glass rounded-2xl p-6 border border-slate-800/60 space-y-6`}>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="border border-slate-800/60 rounded-2xl p-4 bg-slate-900/40 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-slate-200">Consideration</h4>
            <button
              type="button"
              onClick={onAddConsideration}
              className="text-xs text-cyan-200 hover:text-white flex items-center gap-2"
            >
              <i className="fas fa-plus" />
              Item
            </button>
          </div>
          {(formData.consideration?.items || []).map((item: any, idx: number) => (
            <div key={idx} className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <input
                type="text"
                value={item.from || ''}
                onChange={(e) => onUpdate(`consideration.items.${idx}.from`, e.target.value)}
                className="px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-xl"
                placeholder="From"
              />
              <input
                type="number"
                step="0.01"
                value={item.amount || ''}
                onChange={(e) => onUpdate(`consideration.items.${idx}.amount`, e.target.value)}
                className="px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-xl"
                placeholder="Amount"
              />
              <input
                type="text"
                value={item.reason || ''}
                onChange={(e) => onUpdate(`consideration.items.${idx}.reason`, e.target.value)}
                className="px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-xl"
                placeholder="Reason"
              />
            </div>
          ))}
          <div className="pt-3 border-t border-slate-800/60 space-y-2">
            <label className="text-xs uppercase tracking-wider text-slate-500">Net Consideration</label>
            <input
              type="number"
              step="0.01"
              value={formData.earnings?.supplement?.consideration ?? ''}
              onChange={(e) => onUpdate('earnings.supplement.consideration', e.target.value)}
              className="w-full px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-xl"
              placeholder={toFixed(considerationAuto)}
            />
            <p className="text-xs text-slate-500">Auto-sum ${toFixed(considerationAuto)}</p>
          </div>
        </div>
        <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-4 space-y-3">
          <p className="text-xs uppercase tracking-wider text-slate-500">Retention Bonus</p>
          <input
            type="number"
            step="0.01"
            value={formData.earnings?.supplement?.retention ?? formData.supplement?.retention ?? ''}
            onChange={(e) => onUpdate('earnings.supplement.retention', e.target.value)}
            className="w-full px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-xl"
            placeholder="0.00"
          />
          <p className="text-xs text-slate-500">Logged retention ${toFixed(retentionValue)}</p>
        </div>
      </div>
      <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-4">
        <p className="text-xs uppercase tracking-wider text-slate-500">Supplement Summary</p>
        <div className="mt-3 space-y-2 text-sm text-slate-300">
          <div className="flex justify-between">
            <span>Consideration</span>
            <span className="font-semibold text-amber-300">${toFixed(considerationValue)}</span>
          </div>
          <div className="flex justify-between">
            <span>Retention</span>
            <span className="font-semibold text-emerald-300">${toFixed(retentionValue)}</span>
          </div>
          <div className="flex justify-between border-t border-slate-800/50 pt-2">
            <span>Total Supplement</span>
            <span className="font-bold text-cyan-300">
              ${toFixed(formData.earnings?.supplement?.total ?? considerationValue + retentionValue)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SupplementPage;
