// @ts-nocheck
import React, { useMemo, useState } from 'react';

type CrewRecord = {
  rowIndex: number | null;
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  positions?: string[];
  isManager?: boolean;
  [key: string]: any;
};

type CrewDatabasePageProps = {
  records?: CrewRecord[];
  onCreate?: (record: CrewRecord) => Promise<void> | void;
  onUpdate?: (record: CrewRecord) => Promise<void> | void;
  onDelete?: (record: CrewRecord) => Promise<void> | void;
  onRefresh?: () => Promise<void> | void;
  positions?: string[];
};

export default function CrewDatabasePage({
  records = [],
  onCreate,
  onUpdate,
  onDelete,
  onRefresh,
  positions = [],
}: CrewDatabasePageProps) {
  const [filter, setFilter] = useState('');
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draft, setDraft] = useState<CrewRecord>({
    rowIndex: null,
    id: '',
    name: '',
    firstName: '',
    lastName: '',
    positions: [],
    isManager: false,
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const resetDraft = () => {
    setEditingKey(null);
    setDraft({
      rowIndex: null,
      id: '',
      name: '',
      firstName: '',
      lastName: '',
      positions: [],
      isManager: false,
    });
  };

  const sortedRecords = useMemo(() => {
    const list = Array.isArray(records) ? [...records] : [];
    list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    return list;
  }, [records]);

  const filteredRecords = useMemo(() => {
    if (!filter) return sortedRecords;
    const search = filter.trim().toLowerCase();
    if (!search) return sortedRecords;
    return sortedRecords.filter((record) => {
      const tokens = [
        record.id,
        record.name,
        record.firstName,
        record.lastName,
        ...(record.positions || []),
      ]
        .filter(Boolean)
        .map((value) => String(value).toLowerCase());
      return tokens.some((token) => token.includes(search));
    });
  }, [sortedRecords, filter]);

  const positionsList = positions.length ? positions : ['Bartender', 'Server', 'Expo', 'Busser', 'Hostess', 'Door'];

  const handleStartCreate = () => {
    setMessage(null);
    setEditingKey('new');
    setDraft({
      rowIndex: null,
      id: '',
      name: '',
      firstName: '',
      lastName: '',
      positions: [],
      isManager: false,
    });
  };

  const handleStartEdit = (record: CrewRecord) => {
    setMessage(null);
    setEditingKey(record.id || `row-${record.rowIndex}`);
    setDraft({
      rowIndex: record.rowIndex || null,
      id: record.id || '',
      name: record.name || '',
      firstName: record.firstName || '',
      lastName: record.lastName || '',
      positions: Array.isArray(record.positions) ? [...record.positions] : [],
      isManager: !!record.isManager,
    });
  };

  const handleDraftChange = (field: keyof CrewRecord, value: any) => {
    setDraft((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const togglePosition = (position: string) => {
    setDraft((prev) => {
      const current = Array.isArray(prev.positions) ? prev.positions : [];
      const exists = current.includes(position);
      return {
        ...prev,
        positions: exists ? current.filter((item) => item !== position) : [...current, position],
      };
    });
  };

  const handleCancel = () => {
    resetDraft();
  };

  const handleSubmit = async () => {
    if (!editingKey) return;
    setSaving(true);
    setMessage(null);
    try {
      const payload = { ...draft, positions: Array.from(new Set(draft.positions || [])) };
      if (editingKey === 'new') {
        await onCreate?.(payload);
        setMessage({ type: 'success', text: 'Coworker added.' });
      } else {
        await onUpdate?.(payload);
        setMessage({ type: 'success', text: 'Coworker updated.' });
      }
      resetDraft();
    } catch (error: any) {
      setMessage({ type: 'error', text: error?.message || 'Unable to save coworker.' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (record: CrewRecord) => {
    if (!onDelete) return;
    if (!confirm(`Remove ${record.name || 'this coworker'} from the directory?`)) return;
    setSaving(true);
    setMessage(null);
    try {
      await onDelete(record);
      setMessage({ type: 'success', text: 'Coworker removed.' });
      if (editingKey && (editingKey === record.id || editingKey === `row-${record.rowIndex}`)) {
        resetDraft();
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error?.message || 'Unable to delete coworker.' });
    } finally {
      setSaving(false);
    }
  };

  const renderPositionsBadges = (record: CrewRecord) => {
    const list = Array.isArray(record.positions) ? record.positions : [];
    if (!list.length) {
      return <span className="text-xs text-slate-500">—</span>;
    }
    return (
      <div className="flex flex-wrap gap-2">
        {list.map((pos) => (
          <span key={pos} className="badge-pill bg-slate-800 text-slate-200 border border-slate-700">
            {pos}
          </span>
        ))}
      </div>
    );
  };

  const renderEditRow = () => (
    <tr className="glass border border-slate-800/60">
      <td className="px-3 py-3 align-top">
        <input
          type="text"
          value={draft.id}
          onChange={(e) => handleDraftChange('id', e.target.value)}
          className="w-full px-3 py-2 bg-slate-900/70 border border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
          placeholder="ID (optional)"
          disabled={saving}
        />
      </td>
      <td className="px-3 py-3 align-top">
        <input
          type="text"
          value={draft.name}
          onChange={(e) => handleDraftChange('name', e.target.value)}
          className="w-full px-3 py-2 bg-slate-900/70 border border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
          placeholder="Display name"
          disabled={saving}
        />
      </td>
      <td className="px-3 py-3 align-top">
        <div className="space-y-2">
          <input
            type="text"
            value={draft.firstName}
            onChange={(e) => handleDraftChange('firstName', e.target.value)}
            className="w-full px-3 py-2 bg-slate-900/70 border border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
            placeholder="First name"
            disabled={saving}
          />
          <input
            type="text"
            value={draft.lastName}
            onChange={(e) => handleDraftChange('lastName', e.target.value)}
            className="w-full px-3 py-2 bg-slate-900/70 border border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
            placeholder="Last name"
            disabled={saving}
          />
        </div>
      </td>
      <td className="px-3 py-3 align-top">
        <div className="flex flex-wrap gap-2">
          {positionsList.map((position) => {
            const active = draft.positions?.includes(position);
            return (
              <button
                key={position}
                type="button"
                onClick={() => togglePosition(position)}
                className={`px-3 py-1 text-xs rounded-xl border transition ${
                  active
                    ? 'bg-cyan-500/20 text-cyan-100 border-cyan-400/50'
                    : 'bg-slate-900/70 text-slate-300 border-slate-700 hover:border-cyan-500/40'
                }`}
                disabled={saving}
              >
                {position}
              </button>
            );
          })}
        </div>
      </td>
      <td className="px-3 py-3 align-top">
        <label className="inline-flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={draft.isManager}
            onChange={(e) => handleDraftChange('isManager', e.target.checked)}
            className="rounded border-slate-600 text-cyan-500 focus:ring-cyan-600"
            disabled={saving}
          />
          Manager
        </label>
      </td>
      <td className="px-3 py-3 align-top">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="px-3 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-fuchsia-500 text-white text-xs font-semibold hover:shadow-lg hover:shadow-cyan-500/30 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button
            type="button"
            onClick={handleCancel}
            className="px-3 py-2 rounded-xl border border-slate-700 text-slate-300 hover:border-slate-500 text-xs"
            disabled={saving}
          >
            Cancel
          </button>
        </div>
      </td>
    </tr>
  );

  return (
    <div className="glass rounded-2xl shadow-xl p-6 animate-slide-in border border-slate-800/40">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <i className="fas fa-people-group text-cyan-400"></i>
            Crew Database
          </h2>
          <p className="text-slate-400 text-sm">Manage coworkers, positions, and leadership status.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm"></i>
            <input
              type="search"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Search roster..."
              className="pl-9 pr-4 py-2 bg-slate-900/70 border border-slate-700 rounded-xl text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
          </div>
          <button
            type="button"
            onClick={() => onRefresh?.()}
            className="px-4 py-2 rounded-xl border border-slate-700 text-slate-300 hover:border-cyan-500/40"
            disabled={saving}
          >
            <i className="fas fa-rotate-right mr-2"></i>
            Refresh
          </button>
          <button
            type="button"
            onClick={handleStartCreate}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-fuchsia-500 text-white hover:shadow-lg hover:shadow-cyan-500/30"
            disabled={saving}
          >
            <i className="fas fa-user-plus mr-2"></i>
            Add Coworker
          </button>
        </div>
      </div>

      {message && (
        <div
          className={`rounded-xl border px-4 py-3 mb-6 ${
            message.type === 'success'
              ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200'
              : 'border-red-400/40 bg-red-500/10 text-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-800/70 text-sm">
          <thead className="bg-slate-900/70 text-slate-400 uppercase tracking-widest text-[11px]">
            <tr>
              <th className="px-3 py-3 text-left font-semibold">ID</th>
              <th className="px-3 py-3 text-left font-semibold">Display Name</th>
              <th className="px-3 py-3 text-left font-semibold">Details</th>
              <th className="px-3 py-3 text-left font-semibold">Positions</th>
              <th className="px-3 py-3 text-left font-semibold">Manager</th>
              <th className="px-3 py-3 text-left font-semibold w-40">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/70">
            {editingKey && renderEditRow()}
            {filteredRecords.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-10 text-center text-slate-500 text-sm">
                  No coworkers found. Try adjusting your search or add a new coworker.
                </td>
              </tr>
            ) : (
              filteredRecords.map((record) => {
                const isEditing =
                  editingKey && (editingKey === record.id || editingKey === `row-${record.rowIndex}`);
                if (isEditing) {
                  return renderEditRow();
                }

                return (
                  <tr key={record.id || `row-${record.rowIndex}`} className="hover:bg-slate-900/40 transition">
                    <td className="px-3 py-3 align-top">
                      <div className="text-xs text-slate-500 uppercase tracking-wide">ID</div>
                      <div className="text-sm font-semibold text-slate-100">{record.id || '—'}</div>
                      <div className="text-[11px] text-slate-500">Row: {record.rowIndex ?? '—'}</div>
                    </td>
                    <td className="px-3 py-3 align-top">
                      <div className="text-sm font-semibold text-slate-100">{record.name || '—'}</div>
                      <div className="text-xs text-slate-500">
                        {record.firstName || '—'} {record.lastName || ''}
                      </div>
                    </td>
                    <td className="px-3 py-3 align-top">
                      <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Details</div>
                      <div className="text-xs text-slate-400 space-y-1">
                        {record.phone && (
                          <div>
                            <i className="fas fa-phone mr-2"></i>
                            {record.phone}
                          </div>
                        )}
                        {record.email && (
                          <div>
                            <i className="fas fa-envelope mr-2"></i>
                            {record.email}
                          </div>
                        )}
                        {record.notes && (
                          <div className="italic text-slate-500">&ldquo;{record.notes}&rdquo;</div>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3 align-top">{renderPositionsBadges(record)}</td>
                    <td className="px-3 py-3 align-top">
                      {record.isManager ? (
                        <span className="badge-pill bg-emerald-500/20 text-emerald-100 border border-emerald-400/40">
                          Manager
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3 align-top">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => handleStartEdit(record)}
                          className="px-3 py-2 rounded-xl border border-slate-700 text-slate-300 hover:border-cyan-500/40 text-xs"
                          disabled={saving}
                        >
                          <i className="fas fa-edit mr-1.5"></i>
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(record)}
                          className="px-3 py-2 rounded-xl border border-red-500/40 text-red-300 hover:bg-red-500/10 text-xs"
                          disabled={saving}
                        >
                          <i className="fas fa-trash mr-1.5"></i>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
