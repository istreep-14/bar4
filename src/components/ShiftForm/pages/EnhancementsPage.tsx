// @ts-nocheck
import React from 'react';
import { useShiftFormContext } from '../ShiftFormContext';

const EnhancementsPage: React.FC = () => {
  const {
    formData,
    updateFormPath,
    getTimeDraftValue,
    handleTimeDraftChange,
    commitTimeValue,
    timeErrors,
    wageClockHours,
    wageTotal,
    handleAddConsideration,
    handleAddSwindleMovement,
    goToOverview,
  } = useShiftFormContext();

  return (
    <div className="glass rounded-2xl p-6 border border-slate-800/60 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-100">
          <i className="fas fa-sliders text-slate-400"></i>
          Enhancements &amp; Adjustments
        </h3>
        <div className="text-xs text-slate-500">Group overtime, consideration, swindle</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-4">
          <p className="text-xs uppercase tracking-wider text-slate-500">Wage</p>
          <div className="mt-3 space-y-3">
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
                  {timeErrors['wage.clock.start'] && <p className="text-xs text-amber-400">{timeErrors['wage.clock.start']}</p>}
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
                  {timeErrors['wage.clock.end'] && <p className="text-xs text-amber-400">{timeErrors['wage.clock.end']}</p>}
                </div>
              </div>
            </div>
            {wageClockHours != null && <p className="text-xs text-slate-500">Clocked {wageClockHours.toFixed(2)} hours</p>}
            <p className="text-xs text-slate-500">Total ${wageTotal.toFixed(2)}</p>
          </div>
        </div>

        <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-4">
          <p className="text-xs uppercase tracking-wider text-slate-500">Overtime</p>
          <input
            type="text"
            value={formData.earnings.overtime ?? ''}
            onChange={(e) => updateFormPath('earnings.overtime', e.target.value)}
            className="mt-3 w-full px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-xl"
            placeholder="0.00"
          />
        </div>

        <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-wider text-slate-500">Chump</p>
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-500">Played?</label>
              <input
                type="checkbox"
                checked={formData.chump?.played || false}
                onChange={(e) => updateFormPath('chump.played', e.target.checked)}
                className="accent-cyan-500"
              />
            </div>
          </div>
          <div className="mt-3 space-y-2">
            <input
              type="number"
              step="0.01"
              value={formData.chump?.amount?.total || ''}
              onChange={(e) => updateFormPath('chump.amount.total', e.target.value)}
              className="w-full px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-xl"
              placeholder="Pot total"
            />
            <input
              type="text"
              value={formData.chump?.winner || ''}
              onChange={(e) => updateFormPath('chump.winner', e.target.value)}
              className="w-full px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-xl"
              placeholder="Winner"
            />
            <textarea
              value={formData.chump?.notes || ''}
              onChange={(e) => updateFormPath('chump.notes', e.target.value)}
              className="w-full px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-xl text-sm"
              placeholder="Notes"
            ></textarea>
          </div>
        </div>
      </div>
      <div className="border border-slate-800/60 rounded-2xl p-4 bg-slate-900/40 space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-slate-200">Consideration</h4>
          <button type="button" onClick={handleAddConsideration} className="text-xs text-cyan-200 hover:text-white flex items-center gap-2">
            <i className="fas fa-plus"></i>
            Item
          </button>
        </div>
        {(formData.consideration?.items || []).map((item, idx) => (
          <div key={idx} className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <input
              type="text"
              value={item.from || ''}
              onChange={(e) => updateFormPath(`consideration.items.${idx}.from`, e.target.value)}
              className="px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-xl"
              placeholder="From"
            />
            <input
              type="number"
              step="0.01"
              value={item.amount || ''}
              onChange={(e) => updateFormPath(`consideration.items.${idx}.amount`, e.target.value)}
              className="px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-xl"
              placeholder="Amount"
            />
            <input
              type="text"
              value={item.reason || ''}
              onChange={(e) => updateFormPath(`consideration.items.${idx}.reason`, e.target.value)}
              className="px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-xl"
              placeholder="Reason"
            />
          </div>
        ))}
      </div>

      <div className="border border-slate-800/60 rounded-2xl p-4 bg-slate-900/40 space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-slate-200">Swindle Movements</h4>
          <button type="button" onClick={handleAddSwindleMovement} className="text-xs text-cyan-200 hover:text-white flex items-center gap-2">
            <i className="fas fa-plus"></i>
            Movement
          </button>
        </div>
        {(formData.swindle?.movements || []).map((move, idx) => (
          <div key={idx} className="grid grid-cols-1 md:grid-cols-4 gap-2">
            <input
              type="text"
              value={move.from || ''}
              onChange={(e) => updateFormPath(`swindle.movements.${idx}.from`, e.target.value)}
              className="px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-xl"
              placeholder="From"
            />
            <input
              type="text"
              value={move.to || ''}
              onChange={(e) => updateFormPath(`swindle.movements.${idx}.to`, e.target.value)}
              className="px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-xl"
              placeholder="To"
            />
            <input
              type="number"
              step="0.01"
              value={move.amount || ''}
              onChange={(e) => updateFormPath(`swindle.movements.${idx}.amount`, e.target.value)}
              className="px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-xl"
              placeholder="Amount"
            />
            <input
              type="text"
              value={move.note || ''}
              onChange={(e) => updateFormPath(`swindle.movements.${idx}.note`, e.target.value)}
              className="px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-xl"
              placeholder="Note"
            />
          </div>
        ))}
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
          Save Enhancements
        </button>
      </div>
    </div>
  );
};

export default EnhancementsPage;
