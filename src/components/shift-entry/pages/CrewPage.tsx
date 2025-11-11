import React from 'react';
import styles from './CrewPage.module.css';

type CrewPageProps = {
  formData: any;
  crewRows: any[];
  expandedCrewRows: Record<string, boolean>;
  crewLocationOptions: string[];
  bartenderDirectory: any[];
  serverDirectory: any[];
  supportDirectory: any[];
  timeErrors: Record<string, string>;
  SUPPORT_ROLE_OPTIONS: string[];
  addBartenderRow: (...args: any[]) => void;
  addServerRow: (...args: any[]) => void;
  addSupportRow: (...args: any[]) => void;
  toggleCrewRow: (...args: any[]) => void;
  handleCrewNameInput: (...args: any[]) => void;
  getTimeDraftValue: (path: string) => string;
  handleTimeDraftChange: (...args: any[]) => void;
  commitCrewTime: (...args: any[]) => void;
  updateFormPath: (...args: any[]) => void;
  removeCrewMember: (...args: any[]) => void;
};

const CrewPage: React.FC<CrewPageProps> = ({
  formData,
  crewRows,
  expandedCrewRows,
  crewLocationOptions,
  bartenderDirectory,
  serverDirectory,
  supportDirectory,
  timeErrors,
  SUPPORT_ROLE_OPTIONS,
  addBartenderRow,
  addServerRow,
  addSupportRow,
  toggleCrewRow,
  handleCrewNameInput,
  getTimeDraftValue,
  handleTimeDraftChange,
  commitCrewTime,
  updateFormPath,
  removeCrewMember,
}) => {
  return (
    <div className={`${styles.root} glass rounded-2xl p-6 border border-slate-800/60 space-y-6`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-100">
          <i className="fas fa-people-group text-slate-400"></i>
          Crew Knowledge
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => addBartenderRow({ status: 'tentative' })}
            className="text-xs px-3 py-1.5 rounded-lg border border-cyan-500/40 text-cyan-200 hover:bg-cyan-500/10"
          >
            <i className="fas fa-user-plus mr-2"></i>Bartender
          </button>
          <button
            type="button"
            onClick={addServerRow}
            className="text-xs px-3 py-1.5 rounded-lg border border-slate-600 text-slate-200 hover:border-cyan-500/40"
          >
            <i className="fas fa-clipboard-list mr-2"></i>Server
          </button>
          <button
            type="button"
            onClick={addSupportRow}
            className="text-xs px-3 py-1.5 rounded-lg border border-slate-600 text-slate-200 hover-border-cyan-500/40"
          >
            <i className="fas fa-user-shield mr-2"></i>Support
          </button>
        </div>
      </div>

      <p className="text-xs text-slate-400">
        Track who worked with you, their tip hours, and where they posted up. Expand a row for deeper notes.
      </p>

      <div className="overflow-x-auto rounded-xl border border-slate-800/60">
        <table className="min-w-full divide-y divide-slate-800/70 text-sm">
          <thead className="bg-slate-900/60 text-slate-400 uppercase tracking-widest text-[11px]">
            <tr>
              <th scope="col" className="px-3 py-3 text-left font-semibold">
                Crew Member
              </th>
              <th scope="col" className="px-3 py-3 text-left font-semibold">
                Tip Start
              </th>
              <th scope="col" className="px-3 py-3 text-left font-semibold">
                Tip End
              </th>
              <th scope="col" className="px-3 py-3 text-left font-semibold">
                Location
              </th>
              <th scope="col" className="px-3 py-3 text-right font-semibold">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/70">
            {crewRows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                  No crew logged yet. Add teammates to capture their tip hours.
                </td>
              </tr>
            ) : (
              crewRows.map((row) => {
                const member = row.member || {};
                const expanded = !!expandedCrewRows[row.id];
                const startPath = `coworkers.${row.roleKey}.${row.index}.start`;
                const endPath = `coworkers.${row.roleKey}.${row.index}.end`;
                const locationPath = `coworkers.${row.roleKey}.${row.index}.location`;

                return (
                  <React.Fragment key={row.id}>
                    <tr className={`hover:bg-slate-900/50 transition ${member.isSelf ? 'bg-cyan-500/5' : ''}`}>
                      <td className="px-3 py-3 align-top">
                        <div className="flex items-start gap-2">
                          <button
                            type="button"
                            onClick={() => toggleCrewRow(row.id)}
                            className="mt-1 h-6 w-6 flex items-center justify-center rounded-lg border border-slate-700 text-slate-300 hover:border-cyan-500/40"
                            title={expanded ? 'Collapse details' : 'Expand details'}
                          >
                            <i className={`fas fa-chevron-${expanded ? 'up' : 'down'} text-xs`}></i>
                          </button>
                          <div className="flex-1 space-y-1">
                            <input
                              type="text"
                              list={
                                row.roleKey === 'servers'
                                  ? 'server-name-options'
                                  : row.roleKey === 'support'
                                  ? 'support-name-options'
                                  : 'bartender-name-options'
                              }
                              value={member.name || ''}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => handleCrewNameInput(row.roleKey, row.index, e.target.value)}
                              className="w-full px-3 py-2 bg-slate-900/70 border border-slate-700 rounded-xl focus:outline-none focus:ring-1 focus:ring-cyan-500 text-slate-100"
                              placeholder="Crew member"
                            />
                            <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-wide text-slate-500">
                              <span>{row.roleLabel}</span>
                              {member.isSelf && <span className="text-cyan-300">You</span>}
                              {member.isManager && <span className="text-amber-300">Mgr</span>}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={getTimeDraftValue(startPath)}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => handleTimeDraftChange(startPath, e.target.value)}
                          onBlur={(e) => commitCrewTime(row.roleKey, row.index, 'start', e.target.value, { mode: 'start' })}
                          onFocus={(e) => e.target.select()}
                          placeholder="5"
                          className="w-full px-3 py-2 bg-slate-900/70 border border-slate-700 rounded-xl focus:outline-none focus:ring-1 focus:ring-cyan-500 text-slate-100"
                        />
                        {timeErrors[startPath] && <p className="text-xs text-amber-400 mt-1">{timeErrors[startPath]}</p>}
                      </td>
                      <td className="px-3 py-3 align-top">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={getTimeDraftValue(endPath)}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => handleTimeDraftChange(endPath, e.target.value)}
                          onBlur={(e) =>
                            commitCrewTime(row.roleKey, row.index, 'end', e.target.value, {
                              mode: 'end',
                              referenceStart: member.start || formData.time?.base?.start,
                            })
                          }
                          onFocus={(e) => e.target.select()}
                          placeholder="11"
                          className="w-full px-3 py-2 bg-slate-900/70 border border-slate-700 rounded-xl focus:outline-none focus:ring-1 focus:ring-cyan-500 text-slate-100"
                        />
                        {timeErrors[endPath] && <p className="text-xs text-amber-400 mt-1">{timeErrors[endPath]}</p>}
                      </td>
                      <td className="px-3 py-3 align-top">
                        <input
                          type="text"
                          list="crew-location-options"
                          value={member.location || ''}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => updateFormPath(locationPath, e.target.value)}
                          placeholder="Main, Deck..."
                          className="w-full px-3 py-2 bg-slate-900/70 border border-slate-700 rounded-xl focus:outline-none focus:ring-1 focus:ring-cyan-500 text-slate-100"
                        />
                      </td>
                      <td className="px-3 py-3 align-top">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            className="h-8 w-8 flex items-center justify-center rounded-lg border border-slate-700 text-slate-300 hover:border-cyan-500/40"
                            onClick={() => toggleCrewRow(row.id)}
                            title={expanded ? 'Hide details' : 'Show details'}
                          >
                            <i className="fas fa-layer-group text-xs"></i>
                          </button>
                          <button
                            type="button"
                            disabled={member.isSelf}
                            className={`h-8 w-8 flex items-center justify-center rounded-lg border ${
                              member.isSelf
                                ? 'border-slate-800 text-slate-600 cursor-not-allowed'
                                : 'border-rose-500/40 text-rose-300 hover:bg-rose-500/20'
                            }`}
                            onClick={() => removeCrewMember(row.roleKey, row.index)}
                            title={member.isSelf ? 'Cannot remove yourself' : 'Remove from crew'}
                          >
                            <i className="fas fa-trash text-xs"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expanded && (
                      <tr className="bg-slate-900/40">
                        <td colSpan={5} className="px-6 py-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-slate-200">
                            {row.roleKey === 'servers' && (
                              <React.Fragment>
                                <div className="space-y-2">
                                  <label className="text-xs uppercase text-slate-500 block">Cut Order</label>
                                  <input
                                    type="text"
                                    value={member.order || ''}
                                    onChange={(e) => updateFormPath(`coworkers.servers.${row.index}.order`, e.target.value)}
                                    className="w-full px-3 py-2 bg-slate-900/70 border border-slate-700 rounded-xl focus:outline-none focus:ring-1 focus:ring-cyan-500"
                                    placeholder="1st"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <label className="text-xs uppercase text-slate-500 block">Tip-Out</label>
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    value={member.tipOut || ''}
                                    onChange={(e) => updateFormPath(`coworkers.servers.${row.index}.tipOut`, e.target.value)}
                                    className="w-full px-3 py-2 bg-slate-900/70 border border-slate-700 rounded-xl focus:outline-none focus:ring-1 focus:ring-cyan-500"
                                    placeholder="20"
                                  />
                                </div>
                              </React.Fragment>
                            )}
                            {row.roleKey === 'support' && (
                              <div className="space-y-2">
                                <label className="text-xs uppercase text-slate-500 block">Role</label>
                                <select
                                  value={member.role || 'Host'}
                                  onChange={(e) => updateFormPath(`coworkers.support.${row.index}.role`, e.target.value)}
                                  className="w-full px-3 py-2 bg-slate-900/70 border border-slate-700 rounded-xl focus:outline-none focus:ring-1 focus:ring-cyan-500"
                                >
                                  {SUPPORT_ROLE_OPTIONS.map((role) => (
                                    <option key={role} value={role}>
                                      {role}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}
                            <div className="md:col-span-2 space-y-2">
                              <label className="text-xs uppercase text-slate-500 block">Notes</label>
                              <textarea
                                value={member.notes || ''}
                                onChange={(e) => updateFormPath(`coworkers.${row.roleKey}.${row.index}.notes`, e.target.value)}
                                className="w-full px-3 py-2 bg-slate-900/70 border border-slate-700 rounded-xl focus:outline-none focus:ring-1 focus:ring-cyan-500 min-h-[72px]"
                                placeholder="Assignments, party coverage, cut order notes..."
                              ></textarea>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
        </div>

        <datalist id="crew-location-options">
          {crewLocationOptions.map((option, idx) => (
            <option key={`crew-location-${idx || 'empty'}`} value={option} />
          ))}
        </datalist>
        <datalist id="bartender-name-options">
          {bartenderDirectory.map((member) => (
            <option key={`bartender-option-${member.id}`} value={member.name} />
          ))}
        </datalist>
        <datalist id="server-name-options">
          {serverDirectory.map((member) => (
            <option key={`server-option-${member.id}`} value={member.name} />
          ))}
        </datalist>
        <datalist id="support-name-options">
          {supportDirectory.map((member) => (
            <option key={`support-option-${member.id}`} value={member.name} />
          ))}
        </datalist>
      </div>
    );
  };

export default CrewPage;
