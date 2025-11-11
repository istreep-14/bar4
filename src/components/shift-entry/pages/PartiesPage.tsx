import React from 'react';
import styles from './PartiesPage.module.css';

type PartiesPageProps = {
  formData: any;
  partyCount: number;
  expandedParties: Record<string, boolean>;
  shiftType: string;
  timeErrors: Record<string, string>;
  getTimeDraftValue: (path: string) => string;
  handleTimeDraftChange: (path: string, value: string) => void;
  commitTimeValue: (path: string, value: string, options?: any) => void;
  updateFormPath: (path: string, value: any) => void;
  onToggleParty: (id: string) => void;
  onAddParty: () => void;
  onDeleteParty: (id: string) => void;
  onCancelParty: (id: string) => void;
  onSaveParty: (id: string) => void;
};

type PartyEntry = [string, any];

const PartiesPage: React.FC<PartiesPageProps> = ({
  formData,
  partyCount,
  expandedParties,
  shiftType,
  timeErrors,
  getTimeDraftValue,
  handleTimeDraftChange,
  commitTimeValue,
  updateFormPath,
  onToggleParty,
  onAddParty,
  onDeleteParty,
  onCancelParty,
  onSaveParty,
}) => {
  const defaultCutType = shiftType === 'day' ? 'day' : 'night';

  return (
    <div className={`${styles.root} glass rounded-2xl p-6 border border-slate-800/60 space-y-4`}>
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-100">
          <i className="fas fa-martini-glass-citrus text-slate-400" />
          Parties &amp; Events
        </h3>
        <button
          type="button"
          onClick={onAddParty}
          className="text-sm text-cyan-200 hover:text-white flex items-center gap-2"
        >
          <i className="fas fa-plus" />
          Add Party
        </button>
      </div>

      {partyCount === 0 && <p className="text-sm text-slate-500">No parties logged yet.</p>}

      <div className="space-y-3">
        {(Object.entries(formData.parties || {}) as PartyEntry[]).map(([id, party], index) => {
          const expanded = !!expandedParties[id];
          const partyLabel = party.name || `Party ${index + 1}`;

          return (
            <div key={id} className="border border-slate-800/60 rounded-2xl p-4 bg-slate-900/40 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center gap-3 justify-between">
                <button
                  type="button"
                  onClick={() => onToggleParty(id)}
                  className="flex items-center gap-3 text-left text-slate-100 hover:text-cyan-200 transition"
                >
                  <span className="badge-pill bg-slate-800 text-slate-300 border border-slate-700">
                    {`Party ${index + 1}`}
                  </span>
                  <span>{partyLabel}</span>
                  <i className={`fas fa-chevron-${expanded ? 'up' : 'down'} text-xs text-slate-500`} />
                </button>
                <div className="flex items-center gap-2">
                  <select
                    value={party.cutType || defaultCutType}
                    onChange={(e) => updateFormPath(`parties.${id}.cutType`, e.target.value)}
                    className="px-3 py-1.5 bg-slate-900/60 border border-slate-700 rounded-xl text-xs"
                  >
                    <option value="day">Day</option>
                    <option value="night">Night</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => onDeleteParty(id)}
                    className="text-xs text-rose-300 hover:text-rose-100 px-3 py-1 border border-rose-500/40 rounded-lg"
                  >
                    <i className="fas fa-trash" />
                  </button>
                </div>
              </div>

              {expanded && (
                <div className="space-y-4 border-t border-slate-800/60 pt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs uppercase text-slate-500">Party Name</label>
                      <input
                        type="text"
                        value={party.name || ''}
                        onChange={(e) => updateFormPath(`parties.${id}.name`, e.target.value)}
                        className="mt-1 w-full px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-xl"
                        placeholder="Party Name"
                      />
                    </div>
                    <div>
                      <label className="text-xs uppercase text-slate-500">Location</label>
                      <input
                        type="text"
                        value={party.location || ''}
                        onChange={(e) => updateFormPath(`parties.${id}.location`, e.target.value)}
                        className="mt-1 w-full px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-xl"
                        placeholder="Bar, Room, Patio..."
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div>
                      <label className="text-xs uppercase text-slate-500">Start</label>
                      <div className="mt-1 space-y-1">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={getTimeDraftValue(`parties.${id}.time.start`)}
                          onChange={(e) => handleTimeDraftChange(`parties.${id}.time.start`, e.target.value)}
                          onBlur={(e) => commitTimeValue(`parties.${id}.time.start`, e.target.value, { mode: 'start' })}
                          onFocus={(e) => e.target.select()}
                          className="w-full px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-xl"
                          placeholder="e.g. 3"
                        />
                        {timeErrors[`parties.${id}.time.start`] && (
                          <p className="text-xs text-amber-400">{timeErrors[`parties.${id}.time.start`]}</p>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="text-xs uppercase text-slate-500">End</label>
                      <div className="mt-1 space-y-1">
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
                          className="w-full px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-xl"
                          placeholder="e.g. 630"
                        />
                        {timeErrors[`parties.${id}.time.end`] && (
                          <p className="text-xs text-amber-400">{timeErrors[`parties.${id}.time.end`]}</p>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="text-xs uppercase text-slate-500">Gratuity</label>
                      <input
                        type="text"
                        value={party.tips?.gratuity ?? ''}
                        onChange={(e) => updateFormPath(`parties.${id}.tips.gratuity`, e.target.value)}
                        className="mt-1 w-full px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-xl"
                        placeholder="≈800"
                      />
                    </div>
                    <div>
                      <label className="text-xs uppercase text-slate-500">Cash Tips</label>
                      <input
                        type="text"
                        value={party.tips?.cashTips ?? ''}
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
                  />

                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => onCancelParty(id)}
                      className="px-4 py-2 border border-slate-700 text-slate-300 rounded-xl hover:border-slate-500"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => onSaveParty(id)}
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
