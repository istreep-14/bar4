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
import ShiftFormContext from './ShiftFormContext';
import OverviewPage from './pages/OverviewPage';
import TimingsPage from './pages/TimingsPage';
import CutsPage from './pages/CutsPage';
import PartiesPage from './pages/PartiesPage';
import CrewPage from './pages/CrewPage';
import EnhancementsPage from './pages/EnhancementsPage';
import DrinkingPage from './pages/DrinkingPage';
import ShiftSidebar from './pages/ShiftSidebar';
import { BARTENDER_LOCATION_OPTIONS, SUPPORT_ROLE_OPTIONS, BARTENDER_STATUS_OPTIONS } from './constants';


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

    const goToOverview = () => setActivePage('overview');

    const contextValue = {
        formData,
        setFormData,
        activePage,
        setActivePage,
        shiftPageDefs: SHIFT_FORM_PAGE_DEFS,
        getTimeDraftValue,
        handleTimeDraftChange,
        commitTimeValue,
        commitCrewTime,
        timeErrors,
        updateFormPath,
        handleTipsChange,
        calculatedHours,
        displayedEarnings,
        displayedHourly,
        tipsPerHour,
        chumpStatus,
        quickPanels,
        statusBadgeClass,
        handleAddParty,
        handleDeleteParty,
        partyCount,
        expandedParties,
        togglePartyDetails,
        cancelPartySection,
        savePartySection,
        handleAddCut,
        expandedCuts,
        toggleCutDetails,
        deleteCut,
        cancelCutSection,
        saveCutSection,
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
        syncBartenderActualTimes,
        applyFallbackToBartenders,
        crewLocationOptions,
        bartenderDirectory,
        serverDirectory,
        supportDirectory,
        handleAddConsideration,
        handleAddSwindleMovement,
        handleAddDrinkingItem,
        duplicateDrinkingItem,
        handleDeleteDrinkingItem,
        wageClockHours,
        wageTotal,
        shiftTypeMode,
        setShiftTypeMode,
        shiftTypeMenuOpen,
        setShiftTypeMenuOpen,
        selectShiftType,
        shiftTypeLabel,
        headerIcon,
        headerGradient,
        shiftTypeDropdownRef,
        formattedShiftDate,
        openDatePicker,
        weekdayLabel,
        dateInputRef,
        goToOverview,
    };

    const pageMap = {
        overview: OverviewPage,
        timings: TimingsPage,
        cuts: CutsPage,
        crew: CrewPage,
        parties: PartiesPage,
        enhancements: EnhancementsPage,
        drinking: DrinkingPage,
    };

    const ActivePageComponent = pageMap[activePage] || OverviewPage;

    const renderHeaderControls = () => (
        <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
                <div className="relative" ref={shiftTypeDropdownRef}>
                    <button
                        type="button"
                        onClick={() => setShiftTypeMenuOpen((prev) => !prev)}
                        className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl transition ${
                            shiftTypeMenuOpen ? 'bg-cyan-500/40 text-white' : 'bg-slate-900/80 text-cyan-200 hover:bg-slate-900'
                        }`}
                        title={shiftTypeLabel}
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
                    <p className="text-xs uppercase tracking-[0.4em] text-slate-500">{weekdayLabel}</p>
                    <button
                        type="button"
                        onClick={openDatePicker}
                        className="mt-1 text-2xl font-semibold text-slate-100 flex items-center gap-2 hover:text-cyan-200 transition"
                    >
                        {formattedShiftDate}
                        <i className="fas fa-calendar-alt text-base text-slate-500"></i>
                    </button>
                    <input
                        ref={dateInputRef}
                        type="date"
                        value={formData.date || ''}
                        onChange={(e) => updateFormPath('date', e.target.value)}
                        className="mt-2 px-3 py-2 bg-slate-900/70 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                    />
                </div>
            </div>
            <div className="flex items-center gap-2">
                {formData.meta?.tipsPending && (
                    <span className="badge-pill bg-amber-400/20 text-amber-200 border border-amber-300/20">Tips Pending</span>
                )}
                <button
                    type="button"
                    onClick={() => updateFormPath('meta.tipsPending', !formData.meta?.tipsPending)}
                    className="px-4 py-2 rounded-xl border border-slate-700 text-slate-200 hover:border-cyan-500/60 transition text-sm"
                >
                    {formData.meta?.tipsPending ? 'Mark Received' : 'Mark Pending'}
                </button>
            </div>
        </div>
    );

    return (
        <ShiftFormContext.Provider value={contextValue}>
            <form onSubmit={handleSubmit} className="space-y-6 relative">
                <div className="glass rounded-3xl border border-slate-800/40 shadow-xl bg-slate-950/80 p-6 space-y-6">
                    {renderHeaderControls()}
                    <div className="grid lg:grid-cols-[minmax(0,1fr)_280px] gap-6">
                        <div className="space-y-6">
                            <ActivePageComponent />
                            <div className="glass rounded-2xl p-4 border border-slate-800/60">
                                <label className="text-xs uppercase tracking-widest text-slate-500">Shift Notes</label>
                                <textarea
                                    value={formData.meta?.notes || ''}
                                    onChange={(e) => updateFormPath('meta.notes', e.target.value)}
                                    className="mt-2 w-full min-h-[120px] px-4 py-3 bg-slate-900/60 border border-slate-700 rounded-2xl text-sm"
                                    placeholder="Context, observations, weather, promotions..."
                                ></textarea>
                            </div>
                        </div>
                        <ShiftSidebar />
                    </div>
                </div>

                <div className="sticky bottom-2 flex flex-wrap gap-4 justify-end bg-slate-950/90 border border-slate-800/60 rounded-2xl px-6 py-4 shadow-lg shadow-slate-950/40">
                    <button
                        type="submit"
                        className="flex-1 min-w-[180px] bg-gradient-to-r from-cyan-500 to-fuchsia-500 text-white px-8 py-3.5 rounded-2xl font-semibold text-base shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/40 transition"
                    >
                        <i className="fas fa-save mr-3"></i>
                        Save Shift
                    </button>
                    <button
                        type="button"
                        onClick={onCancel}
                        className="px-6 py-3.5 rounded-2xl border border-slate-700 text-slate-300 hover:border-slate-500"
                    >
                        Cancel
                    </button>
                </div>
            </form>
        </ShiftFormContext.Provider>
    );

    
}

export default ShiftForm;
