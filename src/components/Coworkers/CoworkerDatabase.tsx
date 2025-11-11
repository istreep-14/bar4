import React, { useMemo, useState } from 'react';
import { CREW_POSITION_OPTIONS } from '../../lib/constants';

type CoworkerRecord = {
  rowIndex?: number | null;
  id?: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  positions?: string[];
  isManager?: boolean;
  isSelf?: boolean;
};

type CoworkerDraft = {
  rowIndex: number | null;
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  positions: string[];
  isManager: boolean;
};

type CoworkerDatabaseProps = {
  records?: CoworkerRecord[];
  onCreate?: (record: CoworkerDraft) => Promise<void> | void;
  onUpdate?: (record: CoworkerDraft) => Promise<void> | void;
  onDelete?: (record: CoworkerRecord) => Promise<void> | void;
  onRefresh?: () => void;
  positions?: string[];
};

const defaultDraft: CoworkerDraft = {
  rowIndex: null,
  id: '',
  name: '',
  firstName: '',
  lastName: '',
  positions: [],
  isManager: false,
};

const CoworkerDatabase: React.FC<CoworkerDatabaseProps> = ({
  records = [],
  onCreate,
  onUpdate,
  onDelete,
  onRefresh,
  positions = CREW_POSITION_OPTIONS,
}) => {
  const [filter, setFilter] = useState('');
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draft, setDraft] = useState<CoworkerDraft>(defaultDraft);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const resetDraft = () => {
    setEditingKey(null);
    setDraft(defaultDraft);
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

  const positionsList = positions.length ? positions : CREW_POSITION_OPTIONS;

  const handleStartCreate = () => {
    setMessage(null);
    setEditingKey('new');
    setDraft(defaultDraft);
  };

  const handleStartEdit = (record: CoworkerRecord) => {
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

  const handleDraftChange = (field: keyof CoworkerDraft, value: string | boolean) => {
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
      const payload: CoworkerDraft = {
        ...draft,
        positions: Array.from(new Set(draft.positions || [])),
      };
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

  const handleDelete = async (record: CoworkerRecord) => {
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

  const renderPositionsBadges = (record: CoworkerRecord) => {
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

  const renderEditRow = (isNew: boolean) => (
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
        <div className="space-y-3">
          <input
            type="text"
            value={draft.name}
            onChange={(e) => handleDraftChange('name', e.target.value)}
            className="w-full px-3 py-2 bg-slate-900/70 border border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
            placeholder="Display name"
            disabled={saving}
          />
          <div className="grid grid-cols-2 gap-2">
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
        </div>
      </td>
      <td className="px-3 py-3 align-top">
        <div className="flex flex-wrap gap-2">
          {positionsList.map((pos) => {
            const active = draft.positions.includes(pos);
            return (
              <button
                type="button"
                key={pos}
                onClick={() => togglePosition(pos)}
                disabled={saving}
                className={`text-xs px-3 py-1.5 rounded-full border transition ${
                  active
                    ? 'bg-cyan-500/30 border-cyan-400/60 text-cyan-100'
                    : 'bg-slate-900/70 border-slate-700 text-slate-300 hover:border-cyan-400/60 hover:text-cyan-100'
                }`}
              >
                {pos}
              </button>
            );
          })}
        </div>
      </td>
      <td className="px-3 py-3 align-top text-center">
        <label className="inline-flex items-center gap-2 text-xs text-slate-300">
          <input
            type="checkbox"
            checked={draft.isManager}
            onChange={(e) => handleDraftChange('isManager', e.target.checked)}
            className="accent-cyan-500"
            disabled={saving}
          />
          Manager
        </label>
      </td>
      <td className="px-3 py-3 align-top">
        <div className="flex flex-wrap gap-2 justify-end">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="bg-gradient-to-r from-cyan-500 to-fuchsia-500 text-white px-4 py-2 rounded-xl text-xs font-semibold hover:shadow-lg hover:shadow-cyan-500/30 transition disabled:opacity-60"
          >
            {saving ? 'Saving...' : isNew ? 'Add' : 'Save'}
          </button>
          <button
            type="button"
            onClick={handleCancel}
            disabled={saving}
            className="px-4 py-2 rounded-xl border border-slate-700 text-xs text-slate-300 hover:border-slate-500 disabled:opacity-60"
          >
            Cancel
          </button>
        </div>
      </td>
    </tr>
  );

  return (
    <div className="glass rounded-2xl shadow-xl p-6 border border-slate-800/40 animate-slide-in">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-slate-100">Crew Database</h2>
            <span className="badge-pill bg-slate-800 text-slate-300 border border-slate-700">
              {records.length} teammates
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Manage the roster synced to the <code>Coworkers</code> sheet. This tab will be created automatically if it
            is missing.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onRefresh}
            className="px-4 py-2 rounded-xl border border-slate-700 text-slate-200 hover:border-cyan-500/60 transition text-sm"
            disabled={saving}
          >
            <i className="fas fa-rotate mr-2"></i>
            Refresh
          </button>
          <button
            type="button"
            onClick={handleStartCreate}
            className="bg-gradient-to-r from-cyan-500 to-fuchsia-500 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:shadow-lg hover:shadow-cyan-500/30 transition disabled:opacity-60"
            disabled={saving}
          >
            <i className="fas fa-user-plus mr-2"></i>
            Add Coworker
          </button>
        </div>
      </div>

      <div className="mt-6">
        <input
          type="search"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-full px-4 py-2.5 bg-slate-900/70 border border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
          placeholder="Search by name, position, or ID..."
          disabled={saving && !editingKey}
        />
      </div>

      {message && (
        <div
          className={`mt-4 rounded-xl px-4 py-3 text-sm border ${
            message.type === 'success'
              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
              : 'border-rose-500/40 bg-rose-500/10 text-rose-200'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="mt-6 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-slate-400 uppercase text-xs tracking-widest">
              <th className="px-3 py-2 font-medium">ID</th>
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Positions</th>
              <th className="px-3 py-2 font-medium text-center">Manager</th>
              <th className="px-3 py-2 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/40">
            {editingKey === 'new' && renderEditRow(true)}
            {filteredRecords.map((record) => {
              const key = record.id || `row-${record.rowIndex}`;
              const isEditing = editingKey === key;
              if (isEditing) {
                return <React.Fragment key={key}>{renderEditRow(false)}</React.Fragment>;
              }
              return (
                <tr key={key} className="hover:bg-slate-900/40 transition">
                  <td className="px-3 py-3 text-slate-300">
                    {record.id || <span className="text-xs text-slate-500">—</span>}
                  </td>
                  <td className="px-3 py-3 text-slate-100 font-medium">
                    <div className="flex items-center gap-2">
                      {record.name || <span className="text-xs text-slate-500">Unnamed</span>}
                      {record.isSelf && (
                        <span className="badge-pill bg-cyan-500/30 text-cyan-100 border border-cyan-400/40">You</span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      {[(record.firstName || '').trim(), (record.lastName || '').trim()].filter(Boolean).join(' ') ||
                        '—'}
                    </div>
                  </td>
                  <td className="px-3 py-3">{renderPositionsBadges(record)}</td>
                  <td className="px-3 py-3 text-center">
                    {record.isManager ? (
                      <span className="badge-pill bg-amber-500/20 text-amber-100 border border-amber-400/40">
                        Manager
                      </span>
                    ) : (
                      <span className="text-xs text-slate-500">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => handleStartEdit(record)}
                        className="px-3 py-2 rounded-xl border border-slate-700 text-xs text-slate-200 hover:border-cyan-500/50 hover:text-cyan-100 transition"
                        disabled={saving}
                      >
                        <i className="fas fa-pen mr-2"></i>
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(record)}
                        className="px-3 py-2 rounded-xl border border-rose-500/40 text-xs text-rose-200 hover:bg-rose-500/20 transition"
                        disabled={saving}
                      >
                        <i className="fas fa-trash mr-2"></i>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {!filteredRecords.length && editingKey !== 'new' && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-slate-500">
                  No coworkers match your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CoworkerDatabase;
