// @ts-nocheck
import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  DEFAULT_SHIFT_TEMPLATE,
  deepMergeShift,
  normalizeShiftPayload,
  buildInitialTimeDrafts,
  calculateHoursBetween,
  formatTimeDisplay,
  parseFlexibleTime,
  ensureCutSkeleton,
  normalizeCrewData,
  sanitizeBartenderEntry,
  sanitizeServerEntry,
  sanitizeSupportEntry,
  upsertSelfCrew,
  setNestedValue,
  getNestedValue,
  inferShiftTypeFromTimes,
  parseShiftDate,
} from '../../lib/shiftUtils';


const SHIFT_TYPE_META = {
    day: {
        icon: 'fa-sun',
        label: 'Day Shift',
    },
    night: {
        icon: 'fa-moon',
        label: 'Night Shift',
    },
    double: {
        icon: 'fa-infinity',
        label: 'Double Shift',
    },
    default: {
        icon: 'fa-circle-half-stroke',
        label: 'Shift',
    },
};

const SHIFT_FORM_PAGE_DEFS = [
    { key: 'overview', label: 'Overview', icon: 'fa-chart-simple' },
    { key: 'timings', label: 'Timings', icon: 'fa-clock' },
    { key: 'cuts', label: 'Cuts', icon: 'fa-layer-group' },
    { key: 'crew', label: 'Crew', icon: 'fa-people-group' },
    { key: 'parties', label: 'Parties', icon: 'fa-martini-glass-citrus' },
    { key: 'enhancements', label: 'Enhancements', icon: 'fa-sliders' },
    { key: 'drinking', label: 'Drinks', icon: 'fa-wine-glass' },
];

const BARTENDER_LOCATION_OPTIONS = [
    { value: '', label: '—' },
    { value: 'Main', label: 'Main Bar' },
    { value: 'Main-Service', label: 'Main • Service' },
    { value: 'Main-Pit', label: 'Main • Pit' },
    { value: 'Main-Middle', label: 'Main • Middle' },
    { value: 'Deck', label: 'Deck' },
    { value: 'Upper', label: 'Upper Event' },
    { value: 'Support', label: 'Support' },
];

const SUPPORT_ROLE_OPTIONS = ['Host', 'Busser', 'Doorman', 'Expo', 'Floor'];

const BARTENDER_STATUS_OPTIONS = [
    { value: 'tentative', label: 'Tentative' },
    { value: 'confirmed', label: 'Confirmed' },
    { value: 'actual', label: 'Actual' },
];


// Shift Form Component (Hybrid Dark UI)
function ShiftForm({ shift, onSave, onCancel, coworkerDirectory = [] }) {
    const initialFormSnapshot = useMemo(
        () => deepMergeShift(DEFAULT_SHIFT_TEMPLATE, normalizeShiftPayload(shift)),
        [shift]
    );
    const [formData, setFormData] = useState(initialFormSnapshot);
    const [activePage, setActivePage] = useState(SHIFT_FORM_PAGE_DEFS[0].key);
    const [sectionOpen, setSectionOpen] = useState({
        wage: false,
        overtime: false,
        chump: false,
    });
    const [timeDrafts, setTimeDrafts] = useState(() => buildInitialTimeDrafts(initialFormSnapshot));
    const [timeErrors, setTimeErrors] = useState({});
    const [shiftTypeMode, setShiftTypeMode] = useState(shift?.type ? 'manual' : 'auto');
    const [shiftTypeMenuOpen, setShiftTypeMenuOpen] = useState(false);
    const [expandedCuts, setExpandedCuts] = useState({});
    const [cutSnapshots, setCutSnapshots] = useState({});
    const [expandedParties, setExpandedParties] = useState({});
    const [partySnapshots, setPartySnapshots] = useState({});
    const [expandedCrewRows, setExpandedCrewRows] = useState({});
    const shiftTypeDropdownRef = useRef(null);
    const dateInputRef = useRef(null);
    const bartenderDirectory = useMemo(() => {
        if (!coworkerDirectory.length) return [];
        return coworkerDirectory.filter((member) => {
            const positions = member.positionsNormalized || [];
            if (positions.length === 0) return true;
            return positions.some((pos) =>
                ['bartender', 'bar', 'barback'].some((keyword) => pos.includes(keyword))
            );
        });
    }, [coworkerDirectory]);
    const serverDirectory = useMemo(() => {
        if (!coworkerDirectory.length) return [];
        return coworkerDirectory.filter((member) => {
            const positions = member.positionsNormalized || [];
            if (positions.length === 0) return true;
            return positions.some((pos) => ['server', 'wait', 'food'].some((keyword) => pos.includes(keyword)));
        });
    }, [coworkerDirectory]);
    const supportDirectory = useMemo(() => {
        if (!coworkerDirectory.length) return [];
        return coworkerDirectory.filter((member) => {
            const positions = member.positionsNormalized || [];
            if (positions.length === 0) return true;
            return positions.some((pos) =>
                ['host', 'busser', 'door', 'expo', 'support'].some((keyword) => pos.includes(keyword))
            );
        });
    }, [coworkerDirectory]);
    const selfIdentity = useMemo(
        () => coworkerDirectory.find((member) => member.isSelf) || null,
        [coworkerDirectory]
    );
    const selfName = selfIdentity?.name || 'Ian';

    useEffect(() => {
        setFormData(initialFormSnapshot);
        setTimeDrafts(buildInitialTimeDrafts(initialFormSnapshot));
        setTimeErrors({});
        setShiftTypeMode(initialFormSnapshot.type ? 'manual' : 'auto');
        setShiftTypeMenuOpen(false);
        setExpandedCuts({});
        setCutSnapshots({});
        setExpandedParties({});
        setPartySnapshots({});
        setExpandedCrewRows({});
        setSectionOpen({ wage: false, overtime: false, chump: false });
        setActivePage(SHIFT_FORM_PAGE_DEFS[0].key);
    }, [initialFormSnapshot]);

    useEffect(() => {
        if (!coworkerDirectory.length) return;
        setFormData((prev) => {
            const updated = upsertSelfCrew(prev, coworkerDirectory);
            if (updated === prev) return prev;
            setTimeDrafts(buildInitialTimeDrafts(updated));
            return updated;
        });
    }, [coworkerDirectory, formData.time?.base?.start, formData.time?.base?.end]);

    useEffect(() => {
        if (!shiftTypeMenuOpen) return undefined;
        const handleClickAway = (event) => {
            if (shiftTypeDropdownRef.current && !shiftTypeDropdownRef.current.contains(event.target)) {
                setShiftTypeMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickAway);
        return () => document.removeEventListener('mousedown', handleClickAway);
    }, [shiftTypeMenuOpen]);

    useEffect(() => {
        setFormData((prev) => {
            const nextCuts = ensureCutSkeleton(prev.type, prev.parties, prev.cuts);
            if (nextCuts === prev.cuts) return prev;
            return { ...prev, cuts: nextCuts };
        });
    }, [formData.type, Object.keys(formData.parties || {}).join('|')]);

    const recalcWageTotals = (draft) => {
        if (!draft || !draft.wage) return;
        draft.wage.clock = draft.wage.clock || { start: '', end: '', manualStart: false, manualEnd: false };
        const clockStart = draft.wage.clock.start;
        const clockEnd = draft.wage.clock.end;
        if (clockStart && clockEnd) {
            const hours = calculateHoursBetween(clockStart, clockEnd);
            draft.wage.hours = Number.isFinite(hours) ? hours.toFixed(2) : '';
            const wageRate = parseFloat(draft.wage.base) || 0;
            const autoEligible = draft.wage.autoTotal || draft.wage.total === '' || draft.wage.total === null;
            if (autoEligible) {
                const total = wageRate * hours;
                draft.wage.total = Number.isFinite(total) ? total.toFixed(2) : '';
                draft.wage.autoTotal = true;
            }
        } else {
            draft.wage.hours = '';
            if (draft.wage.autoTotal) {
                draft.wage.total = '';
            }
        }
    };

    const updateFormPath = (path, value) => {
        setFormData((prev) => {
            const next = JSON.parse(JSON.stringify(prev));
            setNestedValue(next, path, value);
            if (path === 'wage.total') {
                next.wage = next.wage || {};
                next.wage.autoTotal = value === '' ? true : false;
            }
            if (path === 'wage.base') {
                next.wage = next.wage || {};
                next.wage.base = value;
                recalcWageTotals(next);
            }
            if (path === 'chump.amount.total') {
                next.chump = next.chump || { amount: { total: '', cash: '', coins: '', manualTotal: false } };
                next.chump.amount = next.chump.amount || { total: '', cash: '', coins: '', manualTotal: false };
                next.chump.amount.manualTotal = !!(value && value !== '');
                if (!next.chump.amount.manualTotal) {
                    const cash = parseFloat(String(next.chump.amount.cash || '0').replace(/[^\d.-]/g, '')) || 0;
                    const coins = parseFloat(String(next.chump.amount.coins || '0').replace(/[^\d.-]/g, '')) || 0;
                    const total = cash + coins;
                    next.chump.amount.total = total ? total.toFixed(2) : '';
                }
            }
            if (path === 'chump.amount.cash' || path === 'chump.amount.coins') {
                next.chump = next.chump || { amount: { total: '', cash: '', coins: '', manualTotal: false } };
                next.chump.amount = next.chump.amount || { total: '', cash: '', coins: '', manualTotal: false };
                if (!next.chump.amount.manualTotal) {
                    const cash = parseFloat(String(next.chump.amount.cash || '0').replace(/[^\d.-]/g, '')) || 0;
                    const coins = parseFloat(String(next.chump.amount.coins || '0').replace(/[^\d.-]/g, '')) || 0;
                    const total = cash + coins;
                    next.chump.amount.total = total ? total.toFixed(2) : '';
                }
            }
            if (path === 'chump.outcome' && value === 'win') {
                if (!next.chump.winner) {
                    next.chump.winner = selfName;
                }
            } else if (path === 'chump.outcome' && value !== 'win') {
                if (next.chump.winner === selfName) {
                    next.chump.winner = value === 'loss' ? '' : next.chump.winner;
                }
            }
            return next;
        });
    };

    const mapFormPathToDraft = (path) => {
        if (path.startsWith('time.base.')) {
            return path.replace('time.base.', 'base.');
        }
        if (path.startsWith('time.')) {
            const [, bucket, key] = path.split('.');
            return `buckets.${bucket}.${key}`;
        }
        if (path.startsWith('parties.') && path.includes('.time.')) {
            return path.replace(/parties\.([^.]+)\.time\./, 'parties.$1.');
        }
        if (path.startsWith('wage.clock.')) {
            return path.replace('wage.clock.', 'wage.');
        }
        if (path.startsWith('coworkers.bartenders.')) {
            return path.replace('coworkers.', 'crew.');
        }
        if (path.startsWith('coworkers.servers.')) {
            return path.replace('coworkers.', 'crew.');
        }
        if (path.startsWith('coworkers.support.')) {
            return path.replace('coworkers.', 'crew.');
        }
        if (path.startsWith('coworkers.estimates.')) {
            return path.replace('coworkers.', 'crew.');
        }
        return path;
    };

    const getTimeDraftValue = (formPath) => {
        const draftPath = mapFormPathToDraft(formPath);
        const draftValue = getNestedValue(timeDrafts, draftPath);
        if (draftValue !== undefined) {
            return draftValue ?? '';
        }
        const persisted = getNestedValue(formData, formPath);
        return formatTimeDisplay(persisted);
    };

    const handleTimeDraftChange = (formPath, value) => {
        const draftPath = mapFormPathToDraft(formPath);
        setTimeDrafts((prev) => {
            const next = JSON.parse(JSON.stringify(prev));
            setNestedValue(next, draftPath, value);
            return next;
        });
    };

    const commitTimeValue = (formPath, rawValue, options = {}) => {
        const draftPath = mapFormPathToDraft(formPath);
        const parsed = parseFlexibleTime(rawValue, options);
        if (!parsed.ok) {
            setTimeErrors((prev) => ({
                ...prev,
                [formPath]: 'Unable to read time',
            }));
            setTimeDrafts((prev) => {
                const next = JSON.parse(JSON.stringify(prev));
                setNestedValue(next, draftPath, rawValue || '');
                return next;
            });
            return null;
        }

        setTimeErrors((prev) => {
            if (!prev[formPath]) return prev;
            const next = { ...prev };
            delete next[formPath];
            return next;
        });

        setTimeDrafts((prev) => {
            const next = JSON.parse(JSON.stringify(prev));
            setNestedValue(next, draftPath, parsed.display || '');
            return next;
        });

        setFormData((prev) => {
            const next = JSON.parse(JSON.stringify(prev));
            setNestedValue(next, formPath, parsed.normalized);

            if (formPath.startsWith('time.base.')) {
                const start = formPath === 'time.base.start' ? parsed.normalized : next.time.base.start;
                const end = formPath === 'time.base.end' ? parsed.normalized : next.time.base.end;
                next.wage = next.wage || {};
                next.wage.clock = next.wage.clock || { start: '', end: '', manualStart: false, manualEnd: false };
                if (formPath === 'time.base.start' && !next.wage.clock.manualStart) {
                    next.wage.clock.start = parsed.normalized;
                }
                if (formPath === 'time.base.end' && !next.wage.clock.manualEnd) {
                    next.wage.clock.end = parsed.normalized;
                }
                if (start && end) {
                    const hours = calculateHoursBetween(start, end);
                    next.time.base.hours = hours;
                    next.summary.hours = hours;
                }
                recalcWageTotals(next);
            }

            if (formPath.startsWith('wage.clock.')) {
                next.wage = next.wage || {};
                next.wage.clock = next.wage.clock || { start: '', end: '', manualStart: false, manualEnd: false };
                if (formPath === 'wage.clock.start') {
                    next.wage.clock.manualStart = true;
                }
                if (formPath === 'wage.clock.end') {
                    next.wage.clock.manualEnd = true;
                }
                recalcWageTotals(next);
            }

            const partyMatch = formPath.match(/^parties\.([^.]+)\.time\.(start|end)$/);
            if (partyMatch) {
                const [, partyId] = partyMatch;
                const party = next.parties?.[partyId];
                if (party) {
                    const start = party.time?.start;
                    const end = party.time?.end;
                    if (start && end) {
                        party.time.duration = calculateHoursBetween(start, end);
                    } else if (party.time) {
                        delete party.time.duration;
                    }
                }
            }

            return next;
        });

        return parsed;
    };

    const parseAmount = (value, fallback = 0) => {
        if (value === '' || value === null || value === undefined) return fallback;
        const numeric = typeof value === 'number' ? value : parseFloat(value);
        if (Number.isNaN(numeric)) return fallback;
        return numeric;
    };

    const matchCoworkerByName = (value) => {
        if (!value) return null;
        const normalized = value.trim().toLowerCase();
        if (!normalized) return null;
        return (
            coworkerDirectory.find((member) => {
                const nameMatch = member.name?.trim().toLowerCase() === normalized;
                if (nameMatch) return true;
                const full = [member.firstName, member.lastName].filter(Boolean).join(' ').trim().toLowerCase();
                if (full && full === normalized) return true;
                if (member.firstName && member.firstName.trim().toLowerCase() === normalized) return true;
                return false;
            }) || null
        );
    };

    const addBartenderRow = (defaults = {}) => {
        let snapshot = null;
        setFormData((prev) => {
            const next = JSON.parse(JSON.stringify(prev));
            next.coworkers = next.coworkers ? normalizeCrewData(next.coworkers) : normalizeCrewData();
            next.coworkers.bartenders = next.coworkers.bartenders || [];
            next.coworkers.bartenders.push(sanitizeBartenderEntry(defaults));
            snapshot = next;
            return next;
        });
        if (snapshot) {
            setTimeDrafts(buildInitialTimeDrafts(snapshot));
        }
    };

    const removeBartenderRow = (index) => {
        let snapshot = null;
        setFormData((prev) => {
            const list = prev.coworkers?.bartenders || [];
            const target = list[index];
            if (!target || target.isSelf) return prev;
            const next = JSON.parse(JSON.stringify(prev));
            next.coworkers.bartenders.splice(index, 1);
            snapshot = next;
            return next;
        });
        if (snapshot) {
            setTimeDrafts(buildInitialTimeDrafts(snapshot));
        }
    };

    const handleBartenderNameChange = (index, value) => {
        setFormData((prev) => {
            const list = prev.coworkers?.bartenders || [];
            if (!list[index]) return prev;
            const next = JSON.parse(JSON.stringify(prev));
            const target = next.coworkers.bartenders[index];
            target.name = value;
            const match = matchCoworkerByName(value);
            if (match) {
                target.id = match.id || target.id;
                target.positions = match.positions || target.positions || [];
                target.isManager = target.isManager || match.isManager;
                if (match.isSelf) {
                    target.isSelf = true;
                }
            } else if (!target.isSelf) {
                target.id = '';
                target.isManager = false;
            }
            return next;
        });
    };

    const syncBartenderActualTimes = (index) => {
        let snapshot = null;
        setFormData((prev) => {
            const list = prev.coworkers?.bartenders || [];
            if (!list[index]) return prev;
            const next = JSON.parse(JSON.stringify(prev));
            const target = next.coworkers.bartenders[index];
            if (target.start && !target.actualStart) {
                target.actualStart = target.start;
            }
            if (target.end && !target.actualEnd) {
                target.actualEnd = target.end;
            }
            snapshot = next;
            return next;
        });
        if (snapshot) {
            setTimeDrafts(buildInitialTimeDrafts(snapshot));
        }
    };

    const addServerRow = () => {
        let snapshot = null;
        setFormData((prev) => {
            const next = JSON.parse(JSON.stringify(prev));
            next.coworkers = next.coworkers ? normalizeCrewData(next.coworkers) : normalizeCrewData();
            next.coworkers.servers = next.coworkers.servers || [];
            next.coworkers.servers.push(sanitizeServerEntry());
            snapshot = next;
            return next;
        });
        if (snapshot) {
            setTimeDrafts(buildInitialTimeDrafts(snapshot));
        }
    };

    const removeServerRow = (index) => {
        let snapshot = null;
        setFormData((prev) => {
            const list = prev.coworkers?.servers || [];
            if (!list[index]) return prev;
            const next = JSON.parse(JSON.stringify(prev));
            next.coworkers.servers.splice(index, 1);
            snapshot = next;
            return next;
        });
        if (snapshot) {
            setTimeDrafts(buildInitialTimeDrafts(snapshot));
        }
    };

    const handleServerNameChange = (index, value) => {
        setFormData((prev) => {
            const list = prev.coworkers?.servers || [];
            if (!list[index]) return prev;
            const next = JSON.parse(JSON.stringify(prev));
            const target = next.coworkers.servers[index];
            target.name = value;
            const match = matchCoworkerByName(value);
            if (match) {
                target.id = match.id || target.id;
            } else {
                target.id = '';
            }
            return next;
        });
    };

    const addSupportRow = () => {
        let snapshot = null;
        setFormData((prev) => {
            const next = JSON.parse(JSON.stringify(prev));
            next.coworkers = next.coworkers ? normalizeCrewData(next.coworkers) : normalizeCrewData();
            next.coworkers.support = next.coworkers.support || [];
            next.coworkers.support.push(sanitizeSupportEntry());
            snapshot = next;
            return next;
        });
        if (snapshot) {
            setTimeDrafts(buildInitialTimeDrafts(snapshot));
        }
    };

    const removeSupportRow = (index) => {
        let snapshot = null;
        setFormData((prev) => {
            const list = prev.coworkers?.support || [];
            if (!list[index]) return prev;
            const next = JSON.parse(JSON.stringify(prev));
            next.coworkers.support.splice(index, 1);
            snapshot = next;
            return next;
        });
        if (snapshot) {
            setTimeDrafts(buildInitialTimeDrafts(snapshot));
        }
    };

    const handleSupportNameChange = (index, value) => {
        setFormData((prev) => {
            const list = prev.coworkers?.support || [];
            if (!list[index]) return prev;
            const next = JSON.parse(JSON.stringify(prev));
            const target = next.coworkers.support[index];
            target.name = value;
            const match = matchCoworkerByName(value);
            if (match) {
                target.id = match.id || target.id;
            } else {
                target.id = '';
            }
            return next;
        });
    };

    const applyFallbackToBartenders = () => {};

    const crewRows = useMemo(() => {
        const rows = [];
        const pushRow = (roleKey, roleLabel, member, index) => {
            if (!member) return;
            rows.push({
                id: `${roleKey}-${index}`,
                roleKey,
                roleLabel,
                index,
                member,
            });
        };

        (formData.coworkers?.bartenders || []).forEach((member, index) =>
            pushRow('bartenders', 'Bartender', member, index)
        );
        (formData.coworkers?.servers || []).forEach((member, index) =>
            pushRow('servers', 'Server', member, index)
        );
        (formData.coworkers?.support || []).forEach((member, index) =>
            pushRow('support', 'Support', member, index)
        );

        const roleOrder = { bartenders: 0, servers: 1, support: 2 };
        rows.sort((a, b) => {
            if (a.member?.isSelf && !b.member?.isSelf) return -1;
            if (!a.member?.isSelf && b.member?.isSelf) return 1;
            const roleDiff = (roleOrder[a.roleKey] || 0) - (roleOrder[b.roleKey] || 0);
            if (roleDiff !== 0) return roleDiff;
            return a.index - b.index;
        });

        return rows;
    }, [formData.coworkers]);

    const addCrewMember = (roleKey) => {
        if (roleKey === 'servers') {
            addServerRow();
            return;
        }
        if (roleKey === 'support') {
            addSupportRow();
            return;
        }
        addBartenderRow();
    };

    const removeCrewMember = (roleKey, index) => {
        if (roleKey === 'servers') {
            removeServerRow(index);
            return;
        }
        if (roleKey === 'support') {
            removeSupportRow(index);
            return;
        }
        removeBartenderRow(index);
    };

    const handleCrewNameInput = (roleKey, index, value) => {
        if (roleKey === 'servers') {
            handleServerNameChange(index, value);
            return;
        }
        if (roleKey === 'support') {
            handleSupportNameChange(index, value);
            return;
        }
        handleBartenderNameChange(index, value);
    };

    const toggleCrewRow = (rowId) => {
        setExpandedCrewRows((prev) => ({
            ...prev,
            [rowId]: !prev[rowId],
        }));
    };

    const commitCrewTime = (roleKey, index, field, rawValue, options = {}) => {
        const path = `coworkers.${roleKey}.${index}.${field}`;
        const parsed = commitTimeValue(path, rawValue, options);
        if (parsed && parsed.ok && (field === 'start' || field === 'end')) {
            setFormData((prev) => {
                const next = JSON.parse(JSON.stringify(prev));
                const target = next.coworkers?.[roleKey]?.[index];
                if (target) {
                    if (field === 'start') {
                        target.actualStart = parsed.normalized;
                    } else if (field === 'end') {
                        target.actualEnd = parsed.normalized;
                    }
                }
                return next;
            });
        }
        return parsed;
    };

    const crewLocationOptions = [
        '',
        'Main',
        'Main • Service',
        'Main • Pit',
        'Main • Middle',
        'Deck',
        'Upper',
        'Support',
        'Dining',
        'Event',
    ];

    useEffect(() => {
        if (shiftTypeMode !== 'auto') return;
        const start = formData.time?.base?.start;
        if (!start) return;
        const inferred = inferShiftTypeFromTimes(start, formData.time?.base?.end);
        if (inferred && inferred !== formData.type) {
            setFormData((prev) => ({ ...prev, type: inferred }));
        }
    }, [formData.time?.base?.start, formData.time?.base?.end, shiftTypeMode]);

    const handleTipsChange = (value) => {
        setFormData((prev) => {
            const next = JSON.parse(JSON.stringify(prev));
            const normalized = typeof value === 'string' ? value.replace(',', '.').trim() : value;
            next.tips._total = normalized;
            next.earnings.tips = parseAmount(normalized);
            if (!normalized) {
                next.meta = next.meta || {};
                next.meta.tipsPending = true;
            } else if (next.meta) {
                next.meta.tipsPending = false;
            }
            return next;
        });
    };

    const handleAddParty = () => {
        const partyId = `party_${(formData.date || '').replace(/-/g, '') || 'temp'}_${Date.now().toString(36)}`;
        const newParty = {
            id: partyId,
            name: 'New Party',
            type: '',
            cutType: formData.type === 'day' ? 'day' : 'night',
            location: '',
            time: { start: '', end: '', duration: null },
            size: '',
            packages: { drink: '', food: '' },
            tips: {},
            workers: { primary: '', supplement: [] },
            notes: '',
        };

        setFormData((prev) => {
            const next = JSON.parse(JSON.stringify(prev));
            next.parties = next.parties || {};
            next.parties[partyId] = newParty;
            return next;
        });

        setTimeDrafts((prev) => {
            const next = JSON.parse(JSON.stringify(prev));
            next.parties = next.parties || {};
            next.parties[partyId] = { start: '', end: '' };
            return next;
        });

        setPartySnapshots((prev) => ({ ...prev, [partyId]: null }));
        setExpandedParties((prev) => ({ ...prev, [partyId]: true }));
        setActivePage('parties');
    };

    const handleAddCut = () => {
        const cutKey = `custom_${Date.now().toString(36)}`;
        setFormData((prev) => {
            const next = JSON.parse(JSON.stringify(prev));
            next.cuts = next.cuts || {};
            next.cuts[cutKey] = {
                label: 'Custom Cut',
                me: { tips: '', hours: '' },
                total: { tips: '', hours: '' },
                share: { pct: '', people: '', notes: '' },
                status: 'pending',
            };
            return next;
        });
        setCutSnapshots((prev) => ({ ...prev, [cutKey]: null }));
        setExpandedCuts((prev) => ({ ...prev, [cutKey]: true }));
        setActivePage('cuts');
    };

    const togglePartyDetails = (partyId) => {
        setExpandedParties((prev) => {
            const isOpen = !!prev[partyId];
            if (!isOpen) {
                setPartySnapshots((snapshots) => {
                    if (Object.prototype.hasOwnProperty.call(snapshots, partyId)) return snapshots;
                    const original = formData.parties?.[partyId]
                        ? JSON.parse(JSON.stringify(formData.parties[partyId]))
                        : null;
                    return { ...snapshots, [partyId]: original };
                });
            }
            return { ...prev, [partyId]: !isOpen };
        });
    };

    const savePartySection = (partyId) => {
        setPartySnapshots((prev) => {
            const next = { ...prev };
            delete next[partyId];
            return next;
        });
        setExpandedParties((prev) => ({ ...prev, [partyId]: false }));
    };

    const cancelPartySection = (partyId) => {
        const snapshot = partySnapshots[partyId];
        setFormData((prev) => {
            const next = JSON.parse(JSON.stringify(prev));
            if (snapshot === null) {
                if (next.parties) {
                    delete next.parties[partyId];
                }
            } else if (snapshot) {
                next.parties = next.parties || {};
                next.parties[partyId] = JSON.parse(JSON.stringify(snapshot));
            }
            return next;
        });
        setTimeDrafts((prev) => {
            const next = JSON.parse(JSON.stringify(prev));
            next.parties = next.parties || {};
            if (snapshot === null) {
                if (next.parties[partyId]) {
                    delete next.parties[partyId];
                }
            } else {
                next.parties[partyId] = {
                    start: formatTimeDisplay(snapshot?.time?.start),
                    end: formatTimeDisplay(snapshot?.time?.end),
                };
            }
            return next;
        });
        setPartySnapshots((prev) => {
            const next = { ...prev };
            delete next[partyId];
            return next;
        });
        setExpandedParties((prev) => ({ ...prev, [partyId]: false }));
        setTimeErrors((prev) => {
            const next = { ...prev };
            delete next[`parties.${partyId}.time.start`];
            delete next[`parties.${partyId}.time.end`];
            return next;
        });
    };

    const toggleCutDetails = (cutKey) => {
        setExpandedCuts((prev) => {
            const isOpen = !!prev[cutKey];
            if (!isOpen) {
                setCutSnapshots((snapshots) => {
                    if (Object.prototype.hasOwnProperty.call(snapshots, cutKey)) return snapshots;
                    const original = formData.cuts?.[cutKey]
                        ? JSON.parse(JSON.stringify(formData.cuts[cutKey]))
                        : null;
                    return { ...snapshots, [cutKey]: original };
                });
            }
            return { ...prev, [cutKey]: !isOpen };
        });
    };

    const saveCutSection = (cutKey) => {
        setCutSnapshots((prev) => {
            const next = { ...prev };
            delete next[cutKey];
            return next;
        });
        setExpandedCuts((prev) => ({ ...prev, [cutKey]: false }));
    };

    const cancelCutSection = (cutKey) => {
        const snapshot = cutSnapshots[cutKey];
        setFormData((prev) => {
            const next = JSON.parse(JSON.stringify(prev));
            if (snapshot === null) {
                if (next.cuts) {
                    delete next.cuts[cutKey];
                }
            } else if (snapshot) {
                next.cuts = next.cuts || {};
                next.cuts[cutKey] = JSON.parse(JSON.stringify(snapshot));
            }
            return next;
        });
        setCutSnapshots((prev) => {
            const next = { ...prev };
            delete next[cutKey];
            return next;
        });
        setExpandedCuts((prev) => ({ ...prev, [cutKey]: false }));
    };

    const deleteCut = (cutKey) => {
        const baseKeys = new Set(['day', 'mid', 'night']);
        if (baseKeys.has(cutKey)) return;
        setFormData((prev) => {
            const next = JSON.parse(JSON.stringify(prev));
            if (next.cuts) {
                delete next.cuts[cutKey];
            }
            return next;
        });
        setCutSnapshots((prev) => {
            const next = { ...prev };
            delete next[cutKey];
            return next;
        });
        setExpandedCuts((prev) => {
            const next = { ...prev };
            delete next[cutKey];
            return next;
        });
    };

    const handleDeleteParty = (partyId) => {
        setFormData((prev) => {
            const next = JSON.parse(JSON.stringify(prev));
            if (next.parties) {
                delete next.parties[partyId];
            }
            return next;
        });
        setTimeDrafts((prev) => {
            const next = JSON.parse(JSON.stringify(prev));
            if (next.parties && next.parties[partyId]) {
                delete next.parties[partyId];
            }
            return next;
        });
        setPartySnapshots((prev) => {
            const next = { ...prev };
            delete next[partyId];
            return next;
        });
        setExpandedParties((prev) => {
            const next = { ...prev };
            delete next[partyId];
            return next;
        });
        setTimeErrors((prev) => {
            const next = { ...prev };
            delete next[`parties.${partyId}.time.start`];
            delete next[`parties.${partyId}.time.end`];
            return next;
        });
    };

    const selectShiftType = (nextType) => {
        if (nextType === 'auto') {
            setShiftTypeMode('auto');
            const inferred = inferShiftTypeFromTimes(formData.time?.base?.start, formData.time?.base?.end);
            setFormData((prev) => ({ ...prev, type: inferred || '' }));
        } else {
            setShiftTypeMode('manual');
            setFormData((prev) => ({ ...prev, type: nextType }));
        }
        setShiftTypeMenuOpen(false);
    };

    const removeCoworker = (role, name) => {
        setFormData((prev) => {
            const next = JSON.parse(JSON.stringify(prev));
            if (next.coworkers?.[role]) {
                delete next.coworkers[role][name];
            }
            return next;
        });
    };

    const shiftTypeLabel = useMemo(() => {
        if (shiftTypeMode === 'auto') {
            if (!formData.type) return 'Auto · Pending';
            const meta = SHIFT_TYPE_META[formData.type];
            return meta ? `Auto · ${meta.label}` : 'Auto';
        }
        if (formData.type) {
            const meta = SHIFT_TYPE_META[formData.type];
            return meta ? meta.label : 'Shift';
        }
        return 'Select shift type';
    }, [shiftTypeMode, formData.type]);

    const handleAddSwindleMovement = () => {
        setFormData((prev) => {
            const next = JSON.parse(JSON.stringify(prev));
            next.swindle.movements = next.swindle.movements || [];
            next.swindle.movements.push({ from: '', to: '', amount: '', note: '' });
            return next;
        });
    };

    const handleAddConsideration = () => {
        setFormData((prev) => {
            const next = JSON.parse(JSON.stringify(prev));
            next.consideration.items = next.consideration.items || [];
            next.consideration.items.push({ from: '', amount: '', reason: '' });
            return next;
        });
    };

    const handleAddDrinkingItem = () => {
        setFormData((prev) => {
            const next = JSON.parse(JSON.stringify(prev));
            next.drinking.items = next.drinking.items || [];
            next.drinking.items.push({ name: '', code: '', abv: '', oz: '', sbe: '', type: '', quantity: 1 });
            return next;
        });
        setActivePage('drinking');
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        setFormData((prev) => {
            const next = JSON.parse(JSON.stringify(prev));
            const hours = next.time.base.hours || calculateHoursBetween(next.time.base.start, next.time.base.end);
            const tipsTotal = parseAmount(next.tips._total);
            const wageBase = parseAmount(next.wage.base);
            const wageHours = next.wage.hours !== undefined && next.wage.hours !== '' ? parseAmount(next.wage.hours) : hours || 0;
            const wageTotal = next.wage.total !== undefined && next.wage.total !== '' ? parseAmount(next.wage.total) : parseFloat((wageBase * wageHours).toFixed(2));
            const overtime = parseAmount(next.earnings.overtime || next.overtime);
            const chump = parseAmount(next.earnings.chump);
            const consideration = parseAmount(next.earnings.consideration || next.consideration.net);
            const swindle = parseAmount(next.earnings.swindle || next.swindle.total);

            const totalEarnings = parseFloat((tipsTotal + wageTotal + overtime + chump + consideration + swindle).toFixed(2));
            const hourlyRate = hours > 0 ? parseFloat((totalEarnings / hours).toFixed(2)) : 0;

            next.time.base.hours = hours;
            next.wage.hours = next.wage.hours !== undefined && next.wage.hours !== '' ? next.wage.hours : hours;
            next.wage.total = wageTotal;
            next.summary.hours = hours;

            next.earnings = {
                tips: tipsTotal,
                wage: wageTotal,
                overtime,
                chump,
                consideration,
                swindle,
                total: totalEarnings,
            };

            next.summary.earnings = totalEarnings;
            next.summary.hourly = hourlyRate;
            next.summary.tips.actual = {
                total: tipsTotal,
                perHour: hours > 0 ? parseFloat((tipsTotal / hours).toFixed(2)) : 0,
            };

            const payload = {
                ...next,
                id: next.id || `shift_${(next.date || '').replace(/-/g, '')}`,
            };
            onSave(payload);
            setPartySnapshots({});
            setCutSnapshots({});
            setExpandedParties({});
            setExpandedCuts({});
            return next;
        });
    };

    const calculatedHours = formData.time.base.hours || calculateHoursBetween(formData.time.base.start, formData.time.base.end);
    const tipsTotalValue = parseAmount(formData.tips._total);
    const wageBaseValue = parseAmount(formData.wage.base);
    const wageHoursValue =
        formData.wage.hours !== undefined && formData.wage.hours !== ''
            ? parseAmount(formData.wage.hours)
            : calculatedHours || 0;
    const wageTotal =
        formData.wage.total !== undefined && formData.wage.total !== ''
            ? parseAmount(formData.wage.total)
            : parseFloat((wageBaseValue * wageHoursValue).toFixed(2));
    const overtimeTotal = parseAmount(formData.earnings.overtime);
    const chumpTotal = parseAmount(formData.earnings.chump);
    const considerationTotal = parseAmount(formData.earnings.consideration ?? formData.consideration?.net);
    const swindleTotal = parseAmount(formData.earnings.swindle ?? formData.swindle?.total);
    const displayedEarnings =
        formData.earnings.total !== undefined && formData.earnings.total !== ''
            ? parseAmount(formData.earnings.total)
            : parseFloat((tipsTotalValue + wageTotal + overtimeTotal + chumpTotal + considerationTotal + swindleTotal).toFixed(2));
    const displayedHourly =
        formData.summary.hourly !== undefined && formData.summary.hourly !== ''
            ? parseAmount(formData.summary.hourly)
            : calculatedHours > 0
                ? parseFloat((displayedEarnings / calculatedHours).toFixed(2))
                : 0;
    const tipsPerHour =
        formData.summary.tips?.actual?.perHour !== undefined && formData.summary.tips.actual.perHour !== ''
            ? parseAmount(formData.summary.tips.actual.perHour)
            : calculatedHours > 0
                ? parseFloat((tipsTotalValue / calculatedHours).toFixed(2))
                : 0;
    const wageClockHours =
        formData.wage?.clock?.start && formData.wage?.clock?.end
            ? calculateHoursBetween(formData.wage.clock.start, formData.wage.clock.end)
            : null;

    const shiftTypeMeta = SHIFT_TYPE_META[formData.type] || SHIFT_TYPE_META.default;
    const headerIcon = shiftTypeMeta.icon || (shiftTypeMode === 'auto' ? 'fa-circle-half-stroke' : 'fa-circle-question');
    const headerGradient = 'from-slate-950 via-slate-900 to-slate-950';
    const shiftDateObject = useMemo(() => parseShiftDate(formData.date), [formData.date]);
    const formattedShiftDate = shiftDateObject
        ? shiftDateObject.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : 'Set Date';
    const weekdayLabel = shiftDateObject
        ? shiftDateObject.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase()
        : 'SET DATE';
    const openDatePicker = () => {
        if (!dateInputRef.current) return;
        if (typeof dateInputRef.current.showPicker === 'function') {
            dateInputRef.current.showPicker();
        } else {
            dateInputRef.current.click();
        }
    };
    const partyCount = Object.keys(formData.parties || {}).length;
    const bartenderCount = (formData.coworkers?.bartenders || []).length;
    const serverCount = (formData.coworkers?.servers || []).length;
    const supportCount = (formData.coworkers?.support || []).length;
    const coworkerCount = bartenderCount + serverCount + supportCount;
    const chumpStatus = formData.chump?.played ? (formData.chump.winner ? 'recorded' : 'pending') : 'not-played';

    const quickPanels = [
        {
            key: 'cuts',
            page: 'cuts',
            icon: 'fa-chart-pie',
            label: 'Cuts',
            metric: Object.keys(formData.cuts || {}).length,
            status: Object.values(formData.cuts || {}).some((cut) => cut?.me?.tips) ? 'ok' : 'pending',
        },
        {
            key: 'parties',
            page: 'parties',
            icon: 'fa-glass-cheers',
            label: 'Parties',
            metric: partyCount,
            status: partyCount > 0 ? 'ok' : 'none',
        },
        {
            key: 'coworkers',
            page: 'crew',
            icon: 'fa-people-group',
            label: 'Crew',
            metric: coworkerCount,
            status: coworkerCount > 0 ? 'ok' : 'pending',
        },
        {
            key: 'enhancements',
            page: 'enhancements',
            icon: 'fa-sliders',
            label: 'Enhancements',
            metric: '',
            status: (formData.overtime || formData.consideration.items?.length || formData.swindle.movements?.length) ? 'ok' : 'none',
        },
        {
            key: 'drinking',
            page: 'drinking',
            icon: 'fa-wine-glass',
            label: 'Drinks',
            metric: formData.drinking?.items?.length || 0,
            status: formData.drinking?.items?.length ? 'ok' : 'none',
        },
    ];

    const statusBadgeClass = (status) => {
        switch (status) {
            case 'ok':
                return 'bg-emerald-400/80 shadow-emerald-300/30';
            case 'pending':
                return 'bg-amber-400/80 shadow-amber-300/30';
            case 'none':
            default:
                return 'bg-slate-600/70 shadow-slate-500/20';
        }
    };

    return (
        <div className="max-w-5xl mx-auto">
            <div className="glass rounded-3xl shadow-2xl overflow-hidden animate-slide-in border border-slate-800/40">
                <div className={`bg-gradient-to-r ${headerGradient} px-8 py-6 flex items-center justify-between`}>
                    <div className="flex items-center gap-4">
                        <div className="relative" ref={shiftTypeDropdownRef}>
                            <button
                                type="button"
                                onClick={() => setShiftTypeMenuOpen((prev) => !prev)}
                                className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center text-white text-2xl hover:bg-white/30 transition focus:outline-none focus:ring-2 focus:ring-cyan-400/80"
                                title={shiftTypeLabel}
                                aria-label={shiftTypeLabel}
                            >
                                <i className={`fas ${headerIcon}`}></i>
                            </button>
                            {shiftTypeMenuOpen && (
                                <div className="absolute left-0 top-full mt-3 w-48 bg-slate-900/95 border border-slate-700 rounded-xl shadow-lg backdrop-blur space-y-1 py-2 z-30">
                                    <button
                                        type="button"
                                        onClick={() => selectShiftType('auto')}
                                        className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-800 ${
                                            shiftTypeMode === 'auto' ? 'text-cyan-200' : 'text-slate-200'
                                        }`}
                                    >
                                        Auto (based on times)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => selectShiftType('day')}
                                        className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-800 ${
                                            shiftTypeMode === 'manual' && formData.type === 'day' ? 'text-cyan-200' : 'text-slate-200'
                                        }`}
                                    >
                                        Day Shift
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => selectShiftType('night')}
                                        className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-800 ${
                                            shiftTypeMode === 'manual' && formData.type === 'night' ? 'text-cyan-200' : 'text-slate-200'
                                        }`}
                                    >
                                        Night Shift
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => selectShiftType('double')}
                                        className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-800 ${
                                            shiftTypeMode === 'manual' && formData.type === 'double' ? 'text-cyan-200' : 'text-slate-200'
                                        }`}
                                    >
                                        Double Shift
                                    </button>
                                </div>
                            )}
                        </div>
                        <div>
                            <p className="text-xs uppercase tracking-[0.4em] text-white/70">{weekdayLabel}</p>
                            <button
                                type="button"
                                onClick={openDatePicker}
                                className="mt-1 text-3xl font-semibold text-white flex items-center gap-2 hover:text-cyan-200 transition"
                            >
                                {formattedShiftDate}
                                <i className="fas fa-calendar-alt text-base text-white/60"></i>
                            </button>
                            <p className="text-sm text-white/60">Shift Worksheet</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {formData.meta?.tipsPending && (
                            <span className="badge-pill bg-amber-400/30 text-amber-200 border border-amber-300/30">
                                Tips Pending
                            </span>
                        )}
                        <button
                            onClick={onCancel}
                            type="button"
                            className="icon-button text-white/80 hover:text-white p-2 rounded-lg hover:bg-white/10"
                        >
                            <i className="fas fa-times text-xl"></i>
                        </button>
                    </div>
                </div>
                <input
                    ref={dateInputRef}
                    type="date"
                    value={formData.date}
                    onChange={(e) => updateFormPath('date', e.target.value)}
                    className="absolute w-0 h-0 opacity-0 pointer-events-none"
                    tabIndex={-1}
                    aria-hidden="true"
                />

                <form onSubmit={handleSubmit} className="px-8 py-8 space-y-8">
                    <div className="flex flex-col lg:flex-row gap-8">
                        <div className="flex-1 space-y-8">
                            {activePage === 'overview' && (
                                <>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-1">
                            <label className="text-sm uppercase tracking-wide text-slate-400 flex items-center gap-2">
                                Start Time
                                  <button type="button" onClick={() => setActivePage('timings')} className="text-slate-500 hover:text-cyan-300">
                                    <i className="fas fa-clock"></i>
                                </button>
                            </label>
                    <div className="mt-2 space-y-1">
                        <input
                            type="text"
                            inputMode="numeric"
                            value={getTimeDraftValue('time.base.start')}
                            onChange={(e) => handleTimeDraftChange('time.base.start', e.target.value)}
                            onBlur={(e) => commitTimeValue('time.base.start', e.target.value, { mode: 'start' })}
                            onFocus={(e) => e.target.select()}
                            className="w-full px-5 py-5 bg-slate-900/60 border border-slate-700 rounded-2xl text-2xl tracking-wide focus:outline-none focus:ring-2 focus:ring-cyan-500"
                            placeholder="e.g. 10"
                            required
                        />
                        {timeErrors['time.base.start'] && (
                            <p className="text-xs text-amber-400">{timeErrors['time.base.start']}</p>
                        )}
                    </div>
                        </div>
                        <div className="md:col-span-1">
                            <label className="text-sm uppercase tracking-wide text-slate-400 flex items-center gap-2">
                                End Time
                                  <button type="button" onClick={() => setActivePage('timings')} className="text-slate-500 hover:text-cyan-300">
                                    <i className="fas fa-business-time"></i>
                                </button>
                            </label>
                    <div className="mt-2 space-y-1">
                        <input
                            type="text"
                            inputMode="numeric"
                            value={getTimeDraftValue('time.base.end')}
                            onChange={(e) => handleTimeDraftChange('time.base.end', e.target.value)}
                            onBlur={(e) =>
                                commitTimeValue('time.base.end', e.target.value, {
                                    mode: 'end',
                                    referenceStart: formData.time?.base?.start,
                                })
                            }
                            onFocus={(e) => e.target.select()}
                            className="w-full px-5 py-5 bg-slate-900/60 border border-slate-700 rounded-2xl text-2xl tracking-wide focus:outline-none focus:ring-2 focus:ring-cyan-500"
                            placeholder="e.g. 630"
                            required
                        />
                        {timeErrors['time.base.end'] && (
                            <p className="text-xs text-amber-400">{timeErrors['time.base.end']}</p>
                        )}
                    </div>
                        </div>
                        <div className="md:col-span-1">
                            <label className="text-sm uppercase tracking-wide text-slate-400 flex items-center gap-2">
                                <span>Tips</span>
                                <button
                                    type="button"
                                    onClick={() => updateFormPath('meta.tipsPending', !formData.meta?.tipsPending)}
                                    className={`text-xs px-2 py-1 rounded-lg border ${formData.meta?.tipsPending ? 'border-amber-400 text-amber-200 bg-amber-400/10' : 'border-slate-600 text-slate-400 hover:border-slate-400'}`}
                                >
                                    {formData.meta?.tipsPending ? 'Mark Received' : 'Mark Pending'}
                                </button>
                                <button
                                    type="button"
                                      onClick={() => setActivePage('cuts')}
                                    className="icon-button text-slate-500 hover:text-cyan-300"
                                    title="Open cuts"
                                >
                                    <i className="fas fa-layer-group"></i>
                                </button>
                            </label>
                                <div className="mt-2 relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-2xl">$</span>
                                    <input
                                        type="text"
                                        inputMode="decimal"
                                        pattern="[0-9]*[.,]?[0-9]*"
                                        value={formData.tips._total ?? ''}
                                        onChange={(e) => handleTipsChange(e.target.value)}
                                        onWheel={(e) => e.currentTarget.blur()}
                                        className="w-full pl-12 pr-4 py-5 bg-slate-900/60 border border-slate-700 rounded-2xl text-3xl font-semibold focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                        placeholder="0.00"
                                    />
                                </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                        <div className="glass rounded-2xl p-4 border border-slate-800/60">
                            <p className="text-xs uppercase tracking-widest text-slate-500">Total Earnings</p>
                            <p className="mt-2 text-3xl font-semibold text-cyan-300">${displayedEarnings.toFixed(2)}</p>
                            <p className="text-xs text-slate-500 mt-1">Includes tips, wage, adjustments</p>
                        </div>
                        <div className="glass rounded-2xl p-4 border border-slate-800/60">
                            <p className="text-xs uppercase tracking-widest text-slate-500">Hours</p>
                            <p className="mt-2 text-3xl font-semibold text-emerald-300">{(calculatedHours || 0).toFixed(1)}h</p>
                            <p className="text-xs text-slate-500 mt-1">{formData.time.base.start || '--:--'} &rarr; {formData.time.base.end || '--:--'}</p>
                        </div>
                        <div className="glass rounded-2xl p-4 border border-slate-800/60">
                            <p className="text-xs uppercase tracking-widest text-slate-500">Hourly</p>
                            <p className="mt-2 text-3xl font-semibold text-indigo-300">${displayedHourly.toFixed(2)}</p>
                            <p className="text-xs text-slate-500 mt-1">Tips/hr ${tipsPerHour.toFixed(2)}</p>
                        </div>
                        <div className="glass rounded-2xl p-4 border border-slate-800/60 flex flex-col gap-3">
                            <div className="flex items-center gap-2">
                                <i className="fas fa-dice text-sm text-slate-400"></i>
                                <span className="text-xs uppercase tracking-widest text-slate-500">Chump</span>
                                <span className={`badge-pill ${
                                    chumpStatus === 'recorded'
                                        ? 'bg-emerald-400/20 text-emerald-200 border border-emerald-400/40'
                                        : chumpStatus === 'pending'
                                            ? 'bg-amber-400/20 text-amber-200 border border-amber-400/40'
                                            : 'bg-slate-800 text-slate-400 border border-slate-700'
                                }`}>
                                    {chumpStatus === 'recorded' ? 'Logged' : chumpStatus === 'pending' ? 'Result Pending' : 'Not Played'}
                                </span>
                            </div>
                              <button
                                  type="button"
                                  onClick={() => setActivePage('enhancements')}
                                  className="text-sm text-cyan-200 hover:text-white flex items-center gap-2"
                              >
                                  Manage Enhancements
                                  <i className="fas fa-arrow-right"></i>
                              </button>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-3">
                        {quickPanels.map((panel) => (
                        <button
                            key={panel.key}
                            type="button"
                            onClick={() => setActivePage(panel.page)}
                            className={`icon-button glass px-4 py-3 rounded-2xl flex items-center gap-3 border border-slate-800/60 ${
                                activePage === panel.page ? 'ring-2 ring-cyan-500/40' : ''
                            }`}
                        >
                                <div className="relative">
                                    <span className="w-8 h-8 rounded-xl bg-slate-900/70 flex items-center justify-center text-cyan-300">
                                        <i className={`fas ${panel.icon}`}></i>
                                    </span>
                                <span className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full shadow ${statusBadgeClass(panel.status)}`}></span>
                                </div>
                                <div className="text-left">
                                    <p className="text-xs uppercase tracking-wider text-slate-400">{panel.label}</p>
                                    <p className="text-sm font-semibold text-slate-200">{panel.metric || '—'}</p>
                                </div>
                            <i
                                className={`fas ${
                                    activePage === panel.page ? 'fa-circle-dot text-cyan-200' : 'fa-arrow-right text-slate-600'
                                }`}
                            ></i>
                            </button>
                        ))}
                        <button
                            type="button"
                        onClick={() => {
                            handleAddParty();
                            setActivePage('parties');
                        }}
                            className="icon-button glass px-4 py-3 rounded-2xl flex items-center gap-2 text-slate-200 border border-slate-800/60 hover:border-cyan-500/50"
                        >
                            <i className="fas fa-plus"></i>
                            Quick Add Party
                        </button>
                    </div>

                </>
            )}
                            {activePage === 'timings' && (
                                <div className="glass rounded-2xl p-6 border border-slate-800/60 space-y-4">
                                    <h3 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
                                        <i className="fas fa-clock text-slate-400"></i>
                                        Timing Buckets
                                    </h3>
                              {['present', 'clock', 'tips', 'working'].map((bucket) => (
                                  <div key={bucket} className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
                                      <div className="md:col-span-1">
                                          <p className="text-xs uppercase tracking-wider text-slate-500">{bucket.toUpperCase()}</p>
                                      </div>
                                      <div className="md:col-span-1">
                                          <label className="text-xs text-slate-500">Start</label>
                                          <div className="mt-1 space-y-1">
                                              <input
                                                  type="text"
                                                  inputMode="numeric"
                                                  value={getTimeDraftValue(`time.${bucket}.start`)}
                                                  onChange={(e) => handleTimeDraftChange(`time.${bucket}.start`, e.target.value)}
                                                  onBlur={(e) => commitTimeValue(`time.${bucket}.start`, e.target.value, { mode: 'start' })}
                                                  onFocus={(e) => e.target.select()}
                                                  className="w-full px-4 py-2 bg-slate-900/60 border border-slate-700 rounded-xl"
                                                  placeholder="e.g. 4p"
                                              />
                                              {timeErrors[`time.${bucket}.start`] && (
                                                  <p className="text-xs text-amber-400">{timeErrors[`time.${bucket}.start`]}</p>
                                              )}
                                          </div>
                                      </div>
                                      <div className="md:col-span-1">
                                          <label className="text-xs text-slate-500">End</label>
                                          <div className="mt-1 space-y-1">
                                              <input
                                                  type="text"
                                                  inputMode="numeric"
                                                  value={getTimeDraftValue(`time.${bucket}.end`)}
                                                  onChange={(e) => handleTimeDraftChange(`time.${bucket}.end`, e.target.value)}
                                                  onBlur={(e) =>
                                                      commitTimeValue(`time.${bucket}.end`, e.target.value, {
                                                          mode: 'end',
                                                          referenceStart: formData.time?.[bucket]?.start,
                                                      })
                                                  }
                                                  onFocus={(e) => e.target.select()}
                                                  className="w-full px-4 py-2 bg-slate-900/60 border border-slate-700 rounded-xl"
                                                  placeholder="e.g. 1230"
                                              />
                                              {timeErrors[`time.${bucket}.end`] && (
                                                  <p className="text-xs text-amber-400">{timeErrors[`time.${bucket}.end`]}</p>
                                              )}
                                          </div>
                                      </div>
                                      <div className="md:col-span-1">
                                          <label className="text-xs text-slate-500">Hours</label>
                                          <input
                                              type="number"
                                              step="0.25"
                                              value={formData.time[bucket]?.hours || ''}
                                              onChange={(e) => updateFormPath(`time.${bucket}.hours`, e.target.value === '' ? '' : parseFloat(e.target.value))}
                                              className="mt-1 w-full px-4 py-2 bg-slate-900/60 border border-slate-700 rounded-xl"
                                          />
                                      </div>
                                  </div>
                              ))}
                          </div>
                      )}

                {activePage === 'cuts' && (
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
                        </div>
                    )}

                {activePage === 'parties' && (
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
                                    const defaultCutType = formData.type === 'day' ? 'day' : 'night';
                                    return (
                                        <div key={id} className="border border-slate-800/60 rounded-2xl p-4 bg-slate-900/40 space-y-4">
                                            <div className="flex flex-col md:flex-row md:items-center gap-3 justify-between">
                                                <button
                                                    type="button"
                                                    onClick={() => togglePartyDetails(id)}
                                                    className="flex items-center gap-3 text-left text-slate-100 hover:text-cyan-200 transition"
                                                >
                                                    <span className="badge-pill bg-slate-800 text-slate-300 border border-slate-700">
                                                        {`Party ${index + 1}`}
                                                    </span>
                                                    <span>{partyLabel}</span>
                                                    <i className={`fas fa-chevron-${expanded ? 'up' : 'down'} text-xs text-slate-500`}></i>
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
                                                        onClick={() => handleDeleteParty(id)}
                                                        className="text-xs text-rose-300 hover:text-rose-100 px-3 py-1 border border-rose-500/40 rounded-lg"
                                                    >
                                                        <i className="fas fa-trash"></i>
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
                                                                    onBlur={(e) =>
                                                                        commitTimeValue(`parties.${id}.time.start`, e.target.value, {
                                                                            mode: 'start',
                                                                        })
                                                                    }
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
                    )}

                {activePage === 'crew' && (
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
                            <th scope="col" className="px-3 py-3 text-left font-semibold">Crew Member</th>
                            <th scope="col" className="px-3 py-3 text-left font-semibold">Tip Start</th>
                            <th scope="col" className="px-3 py-3 text-left font-semibold">Tip End</th>
                            <th scope="col" className="px-3 py-3 text-left font-semibold">Location</th>
                            <th scope="col" className="px-3 py-3 text-right font-semibold">Actions</th>
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
                                                {timeErrors[startPath] && (
                                                    <p className="text-xs text-amber-400 mt-1">{timeErrors[startPath]}</p>
                                                )}
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
                                                {timeErrors[endPath] && (
                                                    <p className="text-xs text-amber-400 mt-1">{timeErrors[endPath]}</p>
                                                )}
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

            <div className="space-y-6 hidden">
                                <div className="space-y-3">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <h4 className="text-sm font-semibold text-slate-200">Night Crew · Bartenders</h4>
                                        <span className="text-xs text-slate-400">{(formData.coworkers?.bartenders || []).length} logged</span>
                                    </div>
                                    {(formData.coworkers?.bartenders || []).length === 0 ? (
                                        <p className="text-sm text-slate-500">No bartenders logged yet. Add the teammates scheduled with you for this shift.</p>
                                    ) : (
                                        (formData.coworkers?.bartenders || []).map((member, index) => (
                                            <div
                                                key={`bartender-${index}`}
                                                className={`border border-slate-800/60 rounded-2xl bg-slate-900/40 p-4 space-y-3 ${
                                                    member.isSelf ? 'border-cyan-500/50 bg-cyan-500/10' : ''
                                                }`}
                                            >
                                                <div className="flex flex-wrap items-start gap-3">
                                                    <div className="flex-1 min-w-[180px]">
                                                        <label className="text-xs uppercase text-slate-500 block mb-1">Name</label>
                                                        <input
                                                            type="text"
                                                            list="bartender-name-options"
                                                            value={member.name || ''}
                                                            onChange={(e) => handleBartenderNameChange(index, e.target.value)}
                                                            className="w-full px-3 py-2 bg-slate-900/70 border border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
                                                            placeholder="Start typing..."
                                                        />
                                                        <div className="flex flex-wrap gap-2 mt-2">
                                                            {member.isSelf && (
                                                                <span className="badge-pill bg-cyan-500/30 text-cyan-100 border border-cyan-400/40">You</span>
                                                            )}
                                                            {member.isManager && (
                                                                <span className="badge-pill bg-amber-500/20 text-amber-100 border border-amber-400/40">Manager</span>
                                                            )}
                                                            {member.positions && member.positions.length > 0 && (
                                                                <span className="badge-pill bg-slate-800 text-slate-300 border border-slate-700">
                                                                    {member.positions.join(', ')}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="w-32">
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
                                                    <div className="w-40">
                                                        <label className="text-xs uppercase text-slate-500 block mb-1">Location</label>
                                                        <select
                                                            value={member.location || ''}
                                                            onChange={(e) => updateFormPath(`coworkers.bartenders.${index}.location`, e.target.value)}
                                                            className="w-full px-3 py-2 bg-slate-900/70 border border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
                                                        >
                                                            {BARTENDER_LOCATION_OPTIONS.map((option) => (
                                                                <option key={option.value || 'na'} value={option.value}>
                                                                    {option.label}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        disabled={member.isSelf}
                                                        onClick={() => removeBartenderRow(index)}
                                                        className={`text-xs px-3 py-2 border rounded-xl ${
                                                            member.isSelf
                                                                ? 'border-slate-700 text-slate-600 cursor-not-allowed'
                                                                : 'border-rose-500/40 text-rose-200 hover:bg-rose-500/20'
                                                        }`}
                                                    >
                                                        <i className="fas fa-trash"></i>
                                                    </button>
                                                </div>
                                                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                                    <div>
                                                        <label className="text-xs uppercase text-slate-500 block mb-1">Scheduled Start</label>
                                                        <input
                                                            type="text"
                                                            inputMode="numeric"
                                                            value={getTimeDraftValue(`coworkers.bartenders.${index}.start`)}
                                                            onChange={(e) => handleTimeDraftChange(`coworkers.bartenders.${index}.start`, e.target.value)}
                                                            onBlur={(e) =>
                                                                commitTimeValue(`coworkers.bartenders.${index}.start`, e.target.value, { mode: 'start' })
                                                            }
                                                            onFocus={(e) => e.target.select()}
                                                            className="w-full px-3 py-2 bg-slate-900/70 border border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
                                                            placeholder="5"
                                                        />
                                                        {timeErrors[`coworkers.bartenders.${index}.start`] && (
                                                            <p className="text-xs text-amber-400">{timeErrors[`coworkers.bartenders.${index}.start`]}</p>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <label className="text-xs uppercase text-slate-500 block mb-1">Scheduled End</label>
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
                                                            placeholder="2"
                                                        />
                                                        {timeErrors[`coworkers.bartenders.${index}.end`] && (
                                                            <p className="text-xs text-amber-400">{timeErrors[`coworkers.bartenders.${index}.end`]}</p>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <label className="text-xs uppercase text-slate-500 block mb-1">Actual Start</label>
                                                        <input
                                                            type="text"
                                                            inputMode="numeric"
                                                            value={getTimeDraftValue(`coworkers.bartenders.${index}.actualStart`)}
                                                            onChange={(e) => handleTimeDraftChange(`coworkers.bartenders.${index}.actualStart`, e.target.value)}
                                                            onBlur={(e) =>
                                                                commitTimeValue(`coworkers.bartenders.${index}.actualStart`, e.target.value, { mode: 'start' })
                                                            }
                                                            onFocus={(e) => e.target.select()}
                                                            className="w-full px-3 py-2 bg-slate-900/70 border border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
                                                            placeholder="5"
                                                        />
                                                        {timeErrors[`coworkers.bartenders.${index}.actualStart`] && (
                                                            <p className="text-xs text-amber-400">{timeErrors[`coworkers.bartenders.${index}.actualStart`]}</p>
                                                        )}
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
                                                        {timeErrors[`coworkers.bartenders.${index}.actualEnd`] && (
                                                            <p className="text-xs text-amber-400">{timeErrors[`coworkers.bartenders.${index}.actualEnd`]}</p>
                                                        )}
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
                                        ))
                                    )}
                                </div>

                                <div className="space-y-3">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <h4 className="text-sm font-semibold text-slate-200">Servers</h4>
                                        <span className="text-xs text-slate-400">{(formData.coworkers?.servers || []).length} logged</span>
                                    </div>
                                    {(formData.coworkers?.servers || []).length === 0 ? (
                                        <p className="text-sm text-slate-500">Log the servers you coordinated with, their start times, and cut order for easier recap later.</p>
                                    ) : (
                                        (formData.coworkers?.servers || []).map((member, index) => (
                                            <div
                                                key={`server-${index}`}
                                                className="border border-slate-800/60 rounded-2xl bg-slate-900/40 p-4 space-y-3"
                                            >
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
                                                        className="text-xs px-3 py-2 border border-rose-500/40 text-rose-200 rounded-xl hover:bg-rose-500/20"
                                                    >
                                                        <i className="fas fa-trash"></i>
                                                    </button>
                                                </div>
                                                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                                    <div>
                                                        <label className="text-xs uppercase text-slate-500 block mb-1">Scheduled Start</label>
                                                        <input
                                                            type="text"
                                                            inputMode="numeric"
                                                            value={getTimeDraftValue(`coworkers.servers.${index}.start`)}
                                                            onChange={(e) => handleTimeDraftChange(`coworkers.servers.${index}.start`, e.target.value)}
                                                            onBlur={(e) =>
                                                                commitTimeValue(`coworkers.servers.${index}.start`, e.target.value, { mode: 'start' })
                                                            }
                                                            onFocus={(e) => e.target.select()}
                                                            className="w-full px-3 py-2 bg-slate-900/70 border border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
                                                            placeholder="4"
                                                        />
                                                        {timeErrors[`coworkers.servers.${index}.start`] && (
                                                            <p className="text-xs text-amber-400">{timeErrors[`coworkers.servers.${index}.start`]}</p>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <label className="text-xs uppercase text-slate-500 block mb-1">Scheduled End</label>
                                                        <input
                                                            type="text"
                                                            inputMode="numeric"
                                                            value={getTimeDraftValue(`coworkers.servers.${index}.end`)}
                                                            onChange={(e) => handleTimeDraftChange(`coworkers.servers.${index}.end`, e.target.value)}
                                                            onBlur={(e) =>
                                                                commitTimeValue(`coworkers.servers.${index}.end`, e.target.value, {
                                                                    mode: 'end',
                                                                    referenceStart: member.start || formData.time?.base?.start,
                                                                })
                                                            }
                                                            onFocus={(e) => e.target.select()}
                                                            className="w-full px-3 py-2 bg-slate-900/70 border border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
                                                            placeholder="11"
                                                        />
                                                        {timeErrors[`coworkers.servers.${index}.end`] && (
                                                            <p className="text-xs text-amber-400">{timeErrors[`coworkers.servers.${index}.end`]}</p>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <label className="text-xs uppercase text-slate-500 block mb-1">Actual Start</label>
                                                        <input
                                                            type="text"
                                                            inputMode="numeric"
                                                            value={getTimeDraftValue(`coworkers.servers.${index}.actualStart`)}
                                                            onChange={(e) => handleTimeDraftChange(`coworkers.servers.${index}.actualStart`, e.target.value)}
                                                            onBlur={(e) =>
                                                                commitTimeValue(`coworkers.servers.${index}.actualStart`, e.target.value, { mode: 'start' })
                                                            }
                                                            onFocus={(e) => e.target.select()}
                                                            className="w-full px-3 py-2 bg-slate-900/70 border border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
                                                            placeholder="4"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="text-xs uppercase text-slate-500 block mb-1">Actual End</label>
                                                        <input
                                                            type="text"
                                                            inputMode="numeric"
                                                            value={getTimeDraftValue(`coworkers.servers.${index}.actualEnd`)}
                                                            onChange={(e) => handleTimeDraftChange(`coworkers.servers.${index}.actualEnd`, e.target.value)}
                                                            onBlur={(e) =>
                                                                commitTimeValue(`coworkers.servers.${index}.actualEnd`, e.target.value, {
                                                                    mode: 'end',
                                                                    referenceStart: member.actualStart || member.start || formData.time?.base?.start,
                                                                })
                                                            }
                                                            onFocus={(e) => e.target.select()}
                                                            className="w-full px-3 py-2 bg-slate-900/70 border border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
                                                            placeholder="11"
                                                        />
                                                    </div>
                                                </div>
                                                <textarea
                                                    value={member.notes || ''}
                                                    onChange={(e) => updateFormPath(`coworkers.servers.${index}.notes`, e.target.value)}
                                                    className="w-full px-3 py-2 bg-slate-900/70 border border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
                                                    placeholder="Cut flow, sections, or anything notable."
                                                ></textarea>
                                            </div>
                                        ))
                                    )}
                                </div>

                                <div className="space-y-3">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <h4 className="text-sm font-semibold text-slate-200">Support Roles</h4>
                                        <span className="text-xs text-slate-400">{(formData.coworkers?.support || []).length} logged</span>
                                    </div>
                                    {(formData.coworkers?.support || []).length === 0 ? (
                                        <p className="text-sm text-slate-500">Capture host, busser, door, or expo coverage if it helps your recap.</p>
                                    ) : (
                                        (formData.coworkers?.support || []).map((member, index) => (
                                            <div
                                                key={`support-${index}`}
                                                className="border border-slate-800/60 rounded-2xl bg-slate-900/40 p-4 space-y-3"
                                            >
                                                <div className="flex flex-wrap items-start gap-3">
                                                    <div className="w-36">
                                                        <label className="text-xs uppercase text-slate-500 block mb-1">Role</label>
                                                        <select
                                                            value={member.role || 'Host'}
                                                            onChange={(e) => updateFormPath(`coworkers.support.${index}.role`, e.target.value)}
                                                            className="w-full px-3 py-2 bg-slate-900/70 border border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
                                                        >
                                                            {SUPPORT_ROLE_OPTIONS.map((role) => (
                                                                <option key={role} value={role}>
                                                                    {role}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                    <div className="flex-1 min-w-[160px]">
                                                        <label className="text-xs uppercase text-slate-500 block mb-1">Name</label>
                                                        <input
                                                            type="text"
                                                            list="support-name-options"
                                                            value={member.name || ''}
                                                            onChange={(e) => handleSupportNameChange(index, e.target.value)}
                                                            className="w-full px-3 py-2 bg-slate-900/70 border border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
                                                            placeholder="Support teammate"
                                                        />
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => removeSupportRow(index)}
                                                        className="text-xs px-3 py-2 border border-rose-500/40 text-rose-200 rounded-xl hover:bg-rose-500/20"
                                                    >
                                                        <i className="fas fa-trash"></i>
                                                    </button>
                                                </div>
                                                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                                    <div>
                                                        <label className="text-xs uppercase text-slate-500 block mb-1">Start</label>
                                                        <input
                                                            type="text"
                                                            inputMode="numeric"
                                                            value={getTimeDraftValue(`coworkers.support.${index}.start`)}
                                                            onChange={(e) => handleTimeDraftChange(`coworkers.support.${index}.start`, e.target.value)}
                                                            onBlur={(e) =>
                                                                commitTimeValue(`coworkers.support.${index}.start`, e.target.value, { mode: 'start' })
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
                                                            value={getTimeDraftValue(`coworkers.support.${index}.end`)}
                                                            onChange={(e) => handleTimeDraftChange(`coworkers.support.${index}.end`, e.target.value)}
                                                            onBlur={(e) =>
                                                                commitTimeValue(`coworkers.support.${index}.end`, e.target.value, {
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
                                                            value={getTimeDraftValue(`coworkers.support.${index}.actualStart`)}
                                                            onChange={(e) => handleTimeDraftChange(`coworkers.support.${index}.actualStart`, e.target.value)}
                                                            onBlur={(e) =>
                                                                commitTimeValue(`coworkers.support.${index}.actualStart`, e.target.value, { mode: 'start' })
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
                    )}

                {activePage === 'enhancements' && (
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
                                                    {timeErrors['wage.clock.start'] && (
                                                        <p className="text-xs text-amber-400">{timeErrors['wage.clock.start']}</p>
                                                    )}
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
                                                    {timeErrors['wage.clock.end'] && (
                                                        <p className="text-xs text-amber-400">{timeErrors['wage.clock.end']}</p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        {wageClockHours != null && (
                                            <p className="text-xs text-slate-500">
                                                Clocked {wageClockHours.toFixed(2)} hours
                                            </p>
                                        )}
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
                        </div>
                    )}

                {activePage === 'drinking' && (
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
                        </div>
                    )}

                </div>
                <aside className="w-full lg:w-64 space-y-3">
                    {SHIFT_FORM_PAGE_DEFS.map((page) => {
                        const isActive = activePage === page.key;
                        return (
                            <button
                                key={page.key}
                                type="button"
                                onClick={() => setActivePage(page.key)}
                                className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl border transition ${
                                    isActive
                                        ? 'border-cyan-500/60 bg-cyan-500/10 text-cyan-100'
                                        : 'border-slate-800/60 bg-slate-900/60 text-slate-300 hover:border-slate-700'
                                }`}
                            >
                                <span className="flex items-center gap-3">
                                    <span
                                        className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                                            isActive ? 'bg-cyan-500/30 text-cyan-100' : 'bg-slate-900/80 text-slate-500'
                                        }`}
                                    >
                                        <i className={`fas ${page.icon}`}></i>
                                    </span>
                                    <span className="font-medium">{page.label}</span>
                                </span>
                                <i className={`fas fa-chevron-right text-xs ${isActive ? 'text-cyan-300' : 'text-slate-500'}`}></i>
                            </button>
                        );
                    })}
                </aside>
            </div>

            {activePage === 'overview' && (
                <div className="glass rounded-2xl p-6 border border-slate-800/60 space-y-3">
                    <label className="text-xs uppercase tracking-widest text-slate-500">Shift Notes</label>
                    <textarea
                        value={formData.meta?.notes || ''}
                        onChange={(e) => updateFormPath('meta.notes', e.target.value)}
                        className="w-full min-h-[120px] px-4 py-3 bg-slate-900/60 border border-slate-700 rounded-2xl text-sm"
                        placeholder="Context, observations, weather, promotions..."
                    ></textarea>
                </div>
            )}

            <div className="flex flex-wrap gap-4 justify-end">
                <button
                    type="submit"
                    className="flex-1 min-w-[180px] bg-gradient-to-r from-cyan-500 to-fuchsia-500 text-white px-8 py-4 rounded-2xl font-semibold text-lg shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/40 transition"
                >
                    <i className="fas fa-save mr-3"></i>
                    Save Shift
                </button>
                <button
                    type="button"
                    onClick={onCancel}
                    className="px-6 py-4 rounded-2xl border border-slate-700 text-slate-300 hover:border-slate-500"
                >
                    Cancel
                </button>
            </div>
                </form>
            </div>
        </div>
    );
}

export default ShiftForm;
