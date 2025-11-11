// @ts-nocheck
import React from 'react';
import { useShiftFormContext } from '../ShiftFormContext';

const PartiesPage = () => {
  const {
    formData,
    handleAddParty,
    handleDeleteParty,
    expandedParties,
    togglePartyDetails,
    updateFormPath,
    getTimeDraftValue,
    handleTimeDraftChange,
    commitTimeValue,
    timeErrors,
    cancelPartySection,
    savePartySection,
  } = useShiftFormContext();

  const partyCount = Object.keys(formData.parties || {}).length;
  const defaultCutType = formData.type === 'day' ? 'day' : 'night';

  return (
    <div className="glass rounded-2xl p-6 border border-slate-800/60 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-100">
          <i className="fas fa-martini-glass-citrus text-slate-400"></i>
          Parties &amp; Events
        </h3>
        <button type="button" onClick={handleAddParty} className="text-sm text-cyan-200 hover:text-white flex items-center gap-2">
          <i className="fas fa-plus"></i>
          Add Party
        </button>
      </div>
      {partyCount === 0 && <p className="text-sm text-slate-500">No parties logged yet.</p>}
      <div className="space-y-3">
        {Object.entries(formData.parties || {}).map(([id, party], index) => {
          const expanded = !!expandedParties[id];
          const partyLabel = party.name || `Party ${index + 1}`;
          return (
            <div key={id} className="border border-slate-800/60 rounded-2xl p-4 bg-slate-900/40 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center gap-3 justify-between">
                <button
                  type="button"
                  onClick={() => togglePartyDetails(id)}
                  className="flex items-center gap-3 text-left text-slate-100 hover:text-cyan-200 transition"
                >
                  <span className="badge-pill bg-slate-800 text-slate-300 border border-slate-700">{`Party ${index + 1}`}</span>
                  <span>{partyLabel}</span>
                  <i className={`fas fa-chevron-${expanded ? 'up' : 'down'} text-xs text-slate-500`}></i>
                </button>
                <div className="flex items-center gap-2">
                  <select
                    value={party.cutType || defaultCutType}
                    onChange={(e) => updateFormPath(`parties.${id}.cutType`, e.target.value)}
                    className="px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-xl text-sm"
                  >
                    <option value="day">Day Cut</option>
                    <option value="mid">Mid</option>
                    <option value="night">Night Cut</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => handleDeleteParty(id)}
                    className="text-xs text-rose-300 hover:text-rose-100 px-3 py-1 border border-rose-500/40 rounded-lg"
                  >
                    <i className="fas fa-trash"></i>
                  </button>
                </div>
              </div>

              {expanded && (
                <div className="space-y-4 border-t border-slate-800/60 pt-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs uppercase text-slate-500">Party Name</label>
                      <input
                        type="text"
                        value={party.name || ''}
                        onChange={(e) => updateFormPath(`parties.${id}.name`, e.target.value)}
                        className="mt-1 w-full px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-xl"
                        placeholder="VIP / Event name"
                      />
                    </div>
                    <div>
                      <label className="text-xs uppercase text-slate-500">Type</label>
                      <input
                        type="text"
                        value={party.type || ''}
                        onChange={(e) => updateFormPath(`parties.${id}.type`, e.target.value)}
                        className="mt-1 w-full px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-xl"
                        placeholder="Birthday, Corp, ..."
                      />
                    </div>
                    <div>
                      <label className="text-xs uppercase text-slate-500">Location</label>
                      <input
                        type="text"
                        value={party.location || ''}
                        onChange={(e) => updateFormPath(`parties.${id}.location`, e.target.value)}
                        className="mt-1 w-full px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-xl"
                        placeholder="Main, Deck..."
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs uppercase text-slate-500">Time Start</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={getTimeDraftValue(`parties.${id}.time.start`)}
                        onChange={(e) => handleTimeDraftChange(`parties.${id}.time.start`, e.target.value)}
                        onBlur={(e) => commitTimeValue(`parties.${id}.time.start`, e.target.value, { mode: 'start' })}
                        onFocus={(e) => e.target.select()}
                        className="mt-1 w-full px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-xl"
                      />
                      {timeErrors[`parties.${id}.time.start`] && (
                        <p className="text-xs text-amber-400 mt-1">{timeErrors[`parties.${id}.time.start`]}</p>
                      )}
                    </div>
                    <div>
                      <label className="text-xs uppercase text-slate-500">Time End</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={getTimeDraftValue(`parties.${id}.time.end`)}
                        onChange={(e) => handleTimeDraftChange(`parties.${id}.time.end`, e.target.value)}
                        onBlur={(e) =>
                          commitTimeValue(`parties.${id}.time.end`, e.target.value, {
                            mode: 'end',
                            referenceStart: party.time?.start,
                          })
                        }
                        onFocus={(e) => e.target.select()}
                        className="mt-1 w-full px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-xl"
                      />
                      {timeErrors[`parties.${id}.time.end`] && (
                        <p className="text-xs text-amber-400 mt-1">{timeErrors[`parties.${id}.time.end`]}</p>
                      )}
                    </div>
                    <div>
                      <label className="text-xs uppercase text-slate-500">Duration</label>
                      <p className="mt-2 text-sm text-slate-200">
                        {party.time?.duration ? `${Number(party.time.duration).toFixed(2)}h` : '--'}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs uppercase text-slate-500">Package (Drink)</label>
                      <input
                        type="text"
                        value={party.packages?.drink || ''}
                        onChange={(e) => updateFormPath(`parties.${id}.packages.drink`, e.target.value)}
                        className="mt-1 w-full px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-xl"
                        placeholder="Open bar, Shots, ..."
                      />
                    </div>
                    <div>
                      <label className="text-xs uppercase text-slate-500">Package (Food)</label>
                      <input
                        type="text"
                        value={party.packages?.food || ''}
                        onChange={(e) => updateFormPath(`parties.${id}.packages.food`, e.target.value)}
                        className="mt-1 w-full px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-xl"
                        placeholder="Apps, Dinner, ..."
                      />
                    </div>
                    <div>
                      <label className="text-xs uppercase text-slate-500">Headcount</label>
                      <input
                        type="number"
                        min="0"
                        value={party.size || ''}
                        onChange={(e) => updateFormPath(`parties.${id}.size`, e.target.value)}
                        className="mt-1 w-full px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-xl"
                        placeholder="12"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs uppercase text-slate-500">Primary</label>
                      <input
                        type="text"
                        value={party.workers?.primary || ''}
                        onChange={(e) => updateFormPath(`parties.${id}.workers.primary`, e.target.value)}
                        className="mt-1 w-full px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-xl"
                        placeholder="Lead bartender"
                      />
                    </div>
                    <div>
                      <label className="text-xs uppercase text-slate-500">Supplements</label>
                      <input
                        type="text"
                        value={Array.isArray(party.workers?.supplement) ? party.workers.supplement.join(', ') : ''}
                        onChange={(e) => {
                          const value = e.target.value;
                          const supplements = value ? value.split(',').map((item) => item.trim()).filter(Boolean) : [];
                          updateFormPath(`parties.${id}.workers.supplement`, supplements);
                        }}
                        className="mt-1 w-full px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-xl"
                        placeholder="Support crew"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs uppercase text-slate-500">Tips (Cash)</label>
                      <input
                        type="text"
                        value={party.tips?.cash || ''}
                        onChange={(e) => updateFormPath(`parties.${id}.tips.cash`, e.target.value)}
                        className="mt-1 w-full px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-xl"
                        placeholder="optional"
                      />
                    </div>
                    <div>
                      <label className="text-xs uppercase text-slate-500">Tips (Non-Cash)</label>
                      <input
                        type="text"
                        value={party.tips?.cashTips || ''}
                        onChange={(e) => updateFormPath(`parties.${id}.tips.cashTips`, e.target.value)}
                        className="mt-1 w-full px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-xl"
                        placeholder="optional"
                      />
                    </div>
                  </div>

                  <textarea
                    value={party.notes || ''}
                    onChange={(e) => updateFormPath(`parties.${id}.notes`, e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-xl text-sm"
                    placeholder="Notes (helpers, packages, setup)"
                  ></textarea>

                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => cancelPartySection(id)}
                      className="px-4 py-2 border border-slate-700 text-slate-300 rounded-xl hover:border-slate-500"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => savePartySection(id)}
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
    </div>
  );
};

export default PartiesPage;
