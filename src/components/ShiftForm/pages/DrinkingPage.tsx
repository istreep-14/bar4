// @ts-nocheck
import React from 'react';
import { useShiftFormContext } from '../ShiftFormContext';

const DrinkingPage: React.FC = () => {
  const {
    formData,
    handleAddDrinkingItem,
    duplicateDrinkingItem,
    handleDeleteDrinkingItem,
    updateFormPath,
    goToOverview,
  } = useShiftFormContext();

  return (
    <div className="glass rounded-2xl p-6 border border-slate-800/60 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-100">
          <i className="fas fa-wine-glass text-slate-400"></i>
          On-Shift Drinking
        </h3>
        <button type="button" onClick={handleAddDrinkingItem} className="text-sm text-cyan-200 hover:text-white flex items-center gap-2">
          <i className="fas fa-plus"></i>
          Add Item
        </button>
      </div>

      {(formData.drinking?.items || []).map((item, idx) => (
        <div key={idx} className="grid grid-cols-1 md:grid-cols-6 gap-2">
          <input
            type="text"
            value={item.name || ''}
            onChange={(e) => updateFormPath(`drinking.items.${idx}.name`, e.target.value)}
            className="px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-xl"
            placeholder="Name"
          />
          <input
            type="text"
            value={item.code || ''}
            onChange={(e) => updateFormPath(`drinking.items.${idx}.code`, e.target.value)}
            className="px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-xl"
            placeholder="Code"
          />
          <input
            type="number"
            step="0.1"
            value={item.abv || ''}
            onChange={(e) => updateFormPath(`drinking.items.${idx}.abv`, e.target.value)}
            className="px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-xl"
            placeholder="ABV%"
          />
          <input
            type="number"
            step="0.5"
            value={item.oz || ''}
            onChange={(e) => updateFormPath(`drinking.items.${idx}.oz`, e.target.value)}
            className="px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-xl"
            placeholder="Oz"
          />
          <input
            type="number"
            step="0.1"
            value={item.quantity || 1}
            onChange={(e) => updateFormPath(`drinking.items.${idx}.quantity`, e.target.value)}
            className="px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-xl"
            placeholder="Qty"
          />
          <input
            type="number"
            step="0.01"
            value={item.sbe || ''}
            onChange={(e) => updateFormPath(`drinking.items.${idx}.sbe`, e.target.value)}
            className="px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-xl"
            placeholder="SBE"
          />
          <div className="flex items-center justify-end gap-2 md:col-span-6">
            <button
              type="button"
              onClick={() => duplicateDrinkingItem(idx)}
              className="text-xs px-3 py-1.5 border border-slate-700 text-slate-300 rounded-lg hover:border-cyan-500/40"
            >
              Duplicate
            </button>
            <button
              type="button"
              onClick={() => handleDeleteDrinkingItem(idx)}
              className="text-xs px-3 py-1.5 border border-rose-500/40 text-rose-300 rounded-lg hover:bg-rose-500/10"
            >
              Remove
            </button>
          </div>
        </div>
      ))}

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
          Save Drinks
        </button>
      </div>
    </div>
  );
};

export default DrinkingPage;
