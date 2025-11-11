// @ts-nocheck
import React from 'react';
import { useShiftFormContext } from '../ShiftFormContext';

const CutsPage: React.FC = () => {
  const {
    formData,
    handleAddCut,
    expandedCuts,
    toggleCutDetails,
    updateFormPath,
    deleteCut,
    cancelCutSection,
    saveCutSection,
    goToOverview,
  } = useShiftFormContext();

  return (
    <div className="glass rounded-2xl p-6 border border-slate-800/60 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-100">
          <i className="fas fa-layer-group text-slate-400"></i>
          Cuts
        </h3>
        <button type="button" onClick={handleAddCut} className="text-sm text-cyan-200 hover:text-white flex items-center gap-2">
          <i className="fas fa-plus"></i>
          Custom Cut
        </button>
      </div>

      <div className="space-y-3">
        {Object.entries(formData.cuts || {}).map(([key, cut]) => {
          const expanded = !!expandedCuts[key];
          const baseCut = ['day', 'mid', 'night'].includes(key);
          const label = cut.label || key.charAt(0).toUpperCase() + key.slice(1);

          return (
            <div key={key} className="border border-slate-800/60 rounded-2xl p-4 bg-slate-900/40 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center gap-3 justify-between">
                <button
                  type="button"
                  onClick={() => toggleCutDetails(key)}
                  className="flex items-center gap-3 text-left text-slate-100 hover:text-cyan-200 transition"
                >
                  <span className="badge-pill bg-slate-800 text-slate-300 border border-slate-700">{label}</span>
                  <i className={`fas fa-chevron-${expanded ? 'up' : 'down'} text-xs text-slate-500`}></i>
                </button>
                <div className="flex items-center gap-2">
                  <label className="text-xs uppercase text-slate-500">My Tips</label>
                  <input
                    type="text"
                    value={cut.me?.tips ?? ''}
                    onChange={(e) => updateFormPath(`cuts.${key}.me.tips`, e.target.value)}
                    className="px-3 py-1.5 bg-slate-900/60 border border-slate-700 rounded-xl"
                    placeholder="0.00"
                  />
                </div>
                {!baseCut && (
                  <button
                    type="button"
                    onClick={() => deleteCut(key)}
                    className="text-xs text-rose-300 hover:text-rose-100 px-3 py-1 border border-rose-500/40 rounded-lg"
                  >
                    <i className="fas fa-trash"></i>
                  </button>
                )}
              </div>

              {expanded && (
                <div className="space-y-4 border-t border-slate-800/60 pt-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs uppercase text-slate-500">Label</label>
                      <input
                        type="text"
                        value={cut.label || ''}
                        onChange={(e) => updateFormPath(`cuts.${key}.label`, e.target.value)}
                        className="mt-1 w-full px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-xl"
                        placeholder="Label"
                      />
                    </div>
                    <div>
                      <label className="text-xs uppercase text-slate-500">Status</label>
                      <select
                        value={cut.status || 'pending'}
                        onChange={(e) => updateFormPath(`cuts.${key}.status`, e.target.value)}
                        className="mt-1 w-full px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-xl"
                      >
                        <option value="pending">Pending</option>
                        <option value="estimated">Estimated</option>
                        <option value="confirmed">Confirmed</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs uppercase text-slate-500">My Hours</label>
                      <input
                        type="text"
                        value={cut.me?.hours ?? ''}
                        onChange={(e) => updateFormPath(`cuts.${key}.me.hours`, e.target.value)}
                        className="mt-1 w-full px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-xl"
                        placeholder="0"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs uppercase text-slate-500">Pool Total</label>
                      <input
                        type="text"
                        value={cut.total?.tips ?? ''}
                        onChange={(e) => updateFormPath(`cuts.${key}.total.tips`, e.target.value)}
                        className="mt-1 w-full px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-xl"
                        placeholder="optional"
                      />
                    </div>
                    <div>
                      <label className="text-xs uppercase text-slate-500">Pool Hours</label>
                      <input
                        type="text"
                        value={cut.total?.hours ?? ''}
                        onChange={(e) => updateFormPath(`cuts.${key}.total.hours`, e.target.value)}
                        className="mt-1 w-full px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-xl"
                        placeholder="optional"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs uppercase text-slate-500">Share %</label>
                      <input
                        type="text"
                        value={cut.share?.pct ?? ''}
                        onChange={(e) => updateFormPath(`cuts.${key}.share.pct`, e.target.value)}
                        className="mt-1 w-full px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-xl"
                        placeholder="optional"
                      />
                    </div>
                    <div>
                      <label className="text-xs uppercase text-slate-500">People</label>
                      <input
                        type="text"
                        value={cut.share?.people ?? ''}
                        onChange={(e) => updateFormPath(`cuts.${key}.share.people`, e.target.value)}
                        className="mt-1 w-full px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-xl"
                        placeholder="optional"
                      />
                    </div>
                    <div>
                      <label className="text-xs uppercase text-slate-500">Notes</label>
                      <input
                        type="text"
                        value={cut.share?.notes ?? ''}
                        onChange={(e) => updateFormPath(`cuts.${key}.share.notes`, e.target.value)}
                        className="mt-1 w-full px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-xl"
                        placeholder="Team, weighting, etc."
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => cancelCutSection(key)}
                      className="px-4 py-2 border border-slate-700 text-slate-300 rounded-xl hover:border-slate-500"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => saveCutSection(key)}
                      className="px-4 py-2 bg-cyan-500/20 text-cyan-200 border border-cyan-500/40 rounded-xl hover:bg-cyan-500/30"
                    >
                      Save &amp; Close
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={goToOverview}
          className="px-4 py-2 text-sm text-slate-300 border border-slate-700 rounded-xl hover:border-slate-500"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={goToOverview}
          className="px-4 py-2 text-sm bg-cyan-500/20 text-cyan-200 border border-cyan-500/40 rounded-xl hover:bg-cyan-500/30"
        >
          Save Cuts
        </button>
      </div>
    </div>
  );
};

export default CutsPage;
