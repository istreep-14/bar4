// @ts-nocheck
import React from 'react';
import { useShiftFormContext } from '../ShiftFormContext';
import { BARTENDER_LOCATION_OPTIONS, BARTENDER_STATUS_OPTIONS } from '../constants';

const CrewPage: React.FC = () => {
  const {
    formData,
    crewRows,
    expandedCrewRows,
    toggleCrewRow,
    addBartenderRow,
    addServerRow,
    addSupportRow,
    removeCrewMember,
    removeBartenderRow,
    removeServerRow,
    removeSupportRow,
    handleCrewNameInput,
    handleBartenderNameChange,
    handleServerNameChange,
    handleSupportNameChange,
    getTimeDraftValue,
    handleTimeDraftChange,
    commitTimeValue,
    commitCrewTime,
    timeErrors,
    updateFormPath,
    syncBartenderActualTimes,
    applyFallbackToBartenders,
    crewLocationOptions,
    bartenderDirectory,
    serverDirectory,
    supportDirectory,
    goToOverview,
  } = useShiftFormContext();

  const renderCrewRow = (row) => {
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
              placeholder="2"
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
              className="w-full px-3 py-2 bg-slate-900/70 border border-slate-700 rounded-xl focus:outline-none focus:ring-1 focus:ring-cyan-500 text-slate-100"
              placeholder="Main Bar"
            />
          </td>
          <td className="px-3 py-3 text-right">
            <button
              type="button"
              onClick={() => removeCrewMember(row.roleKey, row.index)}
              className="text-xs px-3 py-1.5 border border-rose-500/40 text-rose-200 rounded-xl hover:border-rose-400/60"
            >
              Remove
            </button>
          </td>
        </tr>
        {expanded && (
          <tr className="bg-slate-950/50">
            <td colSpan={5} className="px-4 py-4">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-xs uppercase text-slate-500 block">Status</label>
                  <select
                    value={member.status || ''}
                    onChange={(e) => updateFormPath(`coworkers.${row.roleKey}.${row.index}.status`, e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900/70 border border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  >
                    <option value="">—</option>
                    {BARTENDER_STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <label className="text-xs uppercase text-slate-500 block mt-3">Location Tag</label>
                  <select
                    value={member.assignment || ''}
                    onChange={(e) => updateFormPath(`coworkers.${row.roleKey}.${row.index}.assignment`, e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900/70 border border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  >
                    <option value="">—</option>
                    {BARTENDER_LOCATION_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs uppercase text-slate-500 block mb-1">Actual Start</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={getTimeDraftValue(`coworkers.${row.roleKey}.${row.index}.actualStart`)}
                      onChange={(e) => handleTimeDraftChange(`coworkers.${row.roleKey}.${row.index}.actualStart`, e.target.value)}
                      onBlur={(e) =>
                        commitTimeValue(`coworkers.${row.roleKey}.${row.index}.actualStart`, e.target.value, { mode: 'start' })
                      }
                      onFocus={(e) => e.target.select()}
                      className="w-full px-3 py-2 bg-slate-900/70 border border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs uppercase text-slate-500 block mb-1">Actual End</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={getTimeDraftValue(`coworkers.${row.roleKey}.${row.index}.actualEnd`)}
                      onChange={(e) => handleTimeDraftChange(`coworkers.${row.roleKey}.${row.index}.actualEnd`, e.target.value)}
                      onBlur={(e) =>
                        commitTimeValue(`coworkers.${row.roleKey}.${row.index}.actualEnd`, e.target.value, {
                          mode: 'end',
                          referenceStart: member.actualStart || member.start || formData.time?.base?.start,
                        })
                      }
                      onFocus={(e) => e.target.select()}
                      className="w-full px-3 py-2 bg-slate-900/70 border border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
                    />
                  </div>
                </div>
                <div className="space-y-3">
                  <textarea
                    value={member.notes || ''}
                    onChange={(e) => updateFormPath(`coworkers.${row.roleKey}.${row.index}.notes`, e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900/70 border border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500 min-h-[120px]"
                    placeholder="Notes, coverage swaps, call-outs..."
                  ></textarea>
                  {row.roleKey === 'bartenders' && (
                    <button
                      type="button"
                      onClick={() => syncBartenderActualTimes(row.index)}
                      className="text-[11px] px-3 py-1 border border-slate-700 rounded-lg text-slate-200 hover-border-cyan-500/50 w-full"
                    >
                      Copy scheduled times to actual
                    </button>
                  )}
                </div>
              </div>
            </td>
          </tr>
        )}
      </React.Fragment>
    );
  };
  return (
    <div className="glass rounded-2xl p-6 border border-slate-800/60 space-y-6">
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
            className="text-xs px-3 py-1.5 rounded-lg border border-slate-600 text-slate-200 hover:border-cyan-500/40"
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
              crewRows.map(renderCrewRow)
            )}
          </tbody>
        </table>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-sm font-semibold text-slate-200">Bartenders</h4>
            <span className="text-xs text-slate-400">{(formData.coworkers?.bartenders || []).length} logged</span>
          </div>
          {(formData.coworkers?.bartenders || []).map((member, index) => (
            <div key={`bartender-${index}`} className="border border-slate-800/60 rounded-2xl bg-slate-900/40 p-4 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                <div className="md:col-span-2">
                  <label className="text-xs uppercase text-slate-500 block mb-1">Name</label>
                  <input
                    type="text"
                    list="bartender-name-options"
                    value={member.name || ''}
                    onChange={(e) => handleBartenderNameChange(index, e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900/70 border border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
                    placeholder="Bartender name"
                  />
                </div>
                <div>
                  <label className="text-xs uppercase text-slate-500 block mb-1">Status</label>
                  <select
                    value={member.status || 'tentative'}
                    onChange={(e) => updateFormPath(`coworkers.bartenders.${index}.status`, e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900/70 border border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  >
                    {BARTENDER_STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs uppercase text-slate-500 block mb-1">Location</label>
                  <select
                    value={member.location || ''}
                    onChange={(e) => updateFormPath(`coworkers.bartenders.${index}.location`, e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900/70 border border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-1 focus-ring-cyan-500"
                  >
                    <option value="">—</option>
                    {BARTENDER_LOCATION_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="text-right">
                  <button
                    type="button"
                    onClick={() => removeBartenderRow(index)}
                    className="text-xs px-3 py-2 border border-rose-500/40 text-rose-200 rounded-xl hover:border-rose-400/60"
                  >
                    Remove
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                  <label className="text-xs uppercase text-slate-500 block mb-1">Start</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={getTimeDraftValue(`coworkers.bartenders.${index}.start`)}
                    onChange={(e) => handleTimeDraftChange(`coworkers.bartenders.${index}.start`, e.target.value)}
                    onBlur={(e) =>
                      commitTimeValue(`coworkers.bartenders.${index}.start`, e.target.value, {
                        mode: 'start',
                        referenceStart: formData.time?.base?.start,
                      })
                    }
                    onFocus={(e) => e.target.select()}
                    className="w-full px-3 py-2 bg-slate-900/70 border border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  />
                </div>
                <div>
                  <label className="text-xs uppercase text-slate-500 block mb-1">End</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={getTimeDraftValue(`coworkers.bartenders.${index}.end`)}
                    onChange={(e) => handleTimeDraftChange(`coworkers.bartenders.${index}.end`, e.target.value)}
                    onBlur={(e) =>
                      commitTimeValue(`coworkers.bartenders.${index}.end`, e.target.value, {
                        mode: 'end',
                        referenceStart: member.start || formData.time?.base?.start,
                      })
                    }
                    onFocus={(e) => e.target.select()}
                    className="w-full px-3 py-2 bg-slate-900/70 border border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  />
                </div>
                <div>
                  <label className="text-xs uppercase text-slate-500 block mb-1">Actual Start</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={getTimeDraftValue(`coworkers.bartenders.${index}.actualStart`)}
                    onChange={(e) => handleTimeDraftChange(`coworkers.bartenders.${index}.actualStart`, e.target.value)}
                    onBlur={(e) => commitTimeValue(`coworkers.bartenders.${index}.actualStart`, e.target.value, { mode: 'start' })}
                    onFocus={(e) => e.target.select()}
                    className="w-full px-3 py-2 bg-slate-900/70 border border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
                    placeholder="5"
                  />
                </div>
                <div>
                  <label className="text-xs uppercase text-slate-500 block mb-1">Actual End</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={getTimeDraftValue(`coworkers.bartenders.${index}.actualEnd`)}
                    onChange={(e) => handleTimeDraftChange(`coworkers.bartenders.${index}.actualEnd`, e.target.value)}
                    onBlur={(e) =>
                      commitTimeValue(`coworkers.bartenders.${index}.actualEnd`, e.target.value, {
                        mode: 'end',
                        referenceStart: member.actualStart || member.start || formData.time?.base?.start,
                      })
                    }
                    onFocus={(e) => e.target.select()}
                    className="w-full px-3 py-2 bg-slate-900/70 border border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
                    placeholder="2"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => syncBartenderActualTimes(index)}
                  className="text-[11px] px-3 py-1 border border-slate-700 rounded-lg text-slate-200 hover:border-cyan-500/50"
                >
                  Copy scheduled times to actual
                </button>
              </div>
              <textarea
                value={member.notes || ''}
                onChange={(e) => updateFormPath(`coworkers.bartenders.${index}.notes`, e.target.value)}
                className="w-full px-3 py-2 bg-slate-900/70 border border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
                placeholder="Location notes, coverage swaps, call-outs, etc."
              ></textarea>
            </div>
          ))}
        </div>
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-sm font-semibold text-slate-200">Servers</h4>
            <span className="text-xs text-slate-400">{(formData.coworkers?.servers || []).length} logged</span>
          </div>
          {(formData.coworkers?.servers || []).length === 0 ? (
            <p className="text-sm text-slate-500">Log the servers you coordinated with, their start times, and cut order.</p>
          ) : (
            (formData.coworkers?.servers || []).map((member, index) => (
              <div key={`server-${index}`} className="border border-slate-800/60 rounded-2xl bg-slate-900/40 p-4 space-y-3">
                <div className="flex flex-wrap items-start gap-3">
                  <div className="flex-1 min-w-[160px]">
                    <label className="text-xs uppercase text-slate-500 block mb-1">Name</label>
                    <input
                      type="text"
                      list="server-name-options"
                      value={member.name || ''}
                      onChange={(e) => handleServerNameChange(index, e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900/70 border border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
                      placeholder="Server name"
                    />
                  </div>
                  <div className="w-32">
                    <label className="text-xs uppercase text-slate-500 block mb-1">Cut Order</label>
                    <input
                      type="number"
                      min="1"
                      value={member.order || ''}
                      onChange={(e) => updateFormPath(`coworkers.servers.${index}.order`, e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900/70 border border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
                      placeholder="#"
                    />
                  </div>
                  <div className="w-36">
                    <label className="text-xs uppercase text-slate-500 block mb-1">Tip Out</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={member.tipOut ?? ''}
                      onChange={(e) => updateFormPath(`coworkers.servers.${index}.tipOut`, e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900/70 border border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
                      placeholder="Amount"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeServerRow(index)}
                    className="text-xs px-3 py-2 border border-rose-500/40 text-rose-200 rounded-xl hover:border-rose-400/60"
                  >
                    Remove
                  </button>
                </div>
                <textarea
                  value={member.notes || ''}
                  onChange={(e) => updateFormPath(`coworkers.servers.${index}.notes`, e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900/70 border border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  placeholder="Service notes, sections, strengths."
                ></textarea>
              </div>
            ))
          )}
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-sm font-semibold text-slate-200">Support</h4>
            <span className="text-xs text-slate-400">{(formData.coworkers?.support || []).length} logged</span>
          </div>
          {(formData.coworkers?.support || []).length === 0 ? (
            <p className="text-sm text-slate-500">
              Track hosts, bussers, security, and other support members who influenced the shift.
            </p>
          ) : (
            (formData.coworkers?.support || []).map((member, index) => (
              <div key={`support-${index}`} className="border border-slate-800/60 rounded-2xl bg-slate-900/40 p-4 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                  <div className="md:col-span-2">
                    <label className="text-xs uppercase text-slate-500 block mb-1">Name</label>
                    <input
                      type="text"
                      list="support-name-options"
                      value={member.name || ''}
                      onChange={(e) => handleSupportNameChange(index, e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900/70 border border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
                      placeholder="Support role"
                    />
                  </div>
                  <div>
                    <label className="text-xs uppercase text-slate-500 block mb-1">Role</label>
                    <input
                      type="text"
                      value={member.role || ''}
                      onChange={(e) => updateFormPath(`coworkers.support.${index}.role`, e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900/70 border border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
                      placeholder="Host, Busser..."
                    />
                  </div>
                  <div>
                    <label className="text-xs uppercase text-slate-500 block mb-1">Tip Out</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={member.tipOut ?? ''}
                      onChange={(e) => updateFormPath(`coworkers.support.${index}.tipOut`, e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900/70 border border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
                      placeholder="Amount"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeSupportRow(index)}
                    className="text-xs px-3 py-2 border border-rose-500/40 text-rose-200 rounded-xl hover:border-rose-400/60"
                  >
                    Remove
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs uppercase text-slate-500 block mb-1">Actual Start</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={getTimeDraftValue(`coworkers.support.${index}.actualStart`)}
                      onChange={(e) => handleTimeDraftChange(`coworkers.support.${index}.actualStart`, e.target.value)}
                      onBlur={(e) => commitTimeValue(`coworkers.support.${index}.actualStart`, e.target.value, { mode: 'start' })}
                      onFocus={(e) => e.target.select()}
                      className="w-full px-3 py-2 bg-slate-900/70 border border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs uppercase text-slate-500 block mb-1">Actual End</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={getTimeDraftValue(`coworkers.support.${index}.actualEnd`)}
                      onChange={(e) => handleTimeDraftChange(`coworkers.support.${index}.actualEnd`, e.target.value)}
                      onBlur={(e) =>
                        commitTimeValue(`coworkers.support.${index}.actualEnd`, e.target.value, {
                          mode: 'end',
                          referenceStart: member.actualStart || member.start || formData.time?.base?.start,
                        })
                      }
                      onFocus={(e) => e.target.select()}
                      className="w-full px-3 py-2 bg-slate-900/70 border border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
                    />
                  </div>
                </div>
                <textarea
                  value={member.notes || ''}
                  onChange={(e) => updateFormPath(`coworkers.support.${index}.notes`, e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900/70 border border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  placeholder="Notes or context for this support role."
                ></textarea>
              </div>
            ))
          )}
        </div>

        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-slate-200">Fallbacks &amp; Notes</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs uppercase text-slate-500 block mb-1">Default Cut Time (Schedule)</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  value={getTimeDraftValue('coworkers.estimates.fallbackEnd')}
                  onChange={(e) => handleTimeDraftChange('coworkers.estimates.fallbackEnd', e.target.value)}
                  onBlur={(e) =>
                    commitTimeValue('coworkers.estimates.fallbackEnd', e.target.value, {
                      mode: 'end',
                      referenceStart: formData.time?.base?.start,
                    })
                  }
                  onFocus={(e) => e.target.select()}
                  className="flex-1 px-3 py-2 bg-slate-900/70 border border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  placeholder="2"
                />
                <button
                  type="button"
                  onClick={() => applyFallbackToBartenders('fallbackEnd')}
                  className="text-xs px-3 py-2 border border-slate-700 text-slate-200 rounded-xl hover:border-cyan-500/40"
                >
                  Apply
                </button>
              </div>
            </div>
            <div>
              <label className="text-xs uppercase text-slate-500 block mb-1">Default Cut Time (Actual)</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  value={getTimeDraftValue('coworkers.estimates.fallbackActualEnd')}
                  onChange={(e) => handleTimeDraftChange('coworkers.estimates.fallbackActualEnd', e.target.value)}
                  onBlur={(e) =>
                    commitTimeValue('coworkers.estimates.fallbackActualEnd', e.target.value, {
                      mode: 'end',
                      referenceStart: formData.time?.base?.start,
                    })
                  }
                  onFocus={(e) => e.target.select()}
                  className="flex-1 px-3 py-2 bg-slate-900/70 border border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  placeholder="2"
                />
                <button
                  type="button"
                  onClick={() => applyFallbackToBartenders('fallbackActualEnd')}
                  className="text-xs px-3 py-2 border border-slate-700 text-slate-200 rounded-xl hover:border-cyan-500/40"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
          <textarea
            value={formData.coworkers?.estimates?.notes || ''}
            onChange={(e) => updateFormPath('coworkers.estimates.notes', e.target.value)}
            className="w-full px-3 py-2 bg-slate-900/70 border border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
            placeholder="General observations, shift swaps, schedule changes, or anything to remember next time."
          ></textarea>
        </div>
      </div>

      <datalist id="crew-location-options">
        {crewLocationOptions.length
          ? crewLocationOptions.map((option, idx) => <option key={`crew-location-${idx}`} value={option} />)
          : BARTENDER_LOCATION_OPTIONS.map((option) => (
              <option key={`crew-location-default-${option.value}`} value={option.label} />
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
          Save Crew
        </button>
      </div>
    </div>
  );
};

export default CrewPage;
