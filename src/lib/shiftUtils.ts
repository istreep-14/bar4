// @ts-nocheck

export const DEFAULT_SHIFT_TEMPLATE = {
  id: '',
  date: new Date().toISOString().split('T')[0],
  type: '',
  myName: '',
  time: {
    base: { start: '', end: '', hours: 0 },
    present: { start: '', end: '', hours: 0 },
    clock: null,
    tips: null,
    working: null,
  },
  wage: {
    base: 5.0,
    hours: '',
    total: '',
    autoTotal: true,
    clock: { start: '', end: '', manualStart: false, manualEnd: false },
  },
  tips: { _total: '' },
  cuts: {},
  coworkers: {
    bartenders: [],
    servers: [],
    support: [],
    estimates: {
      fallbackEnd: '',
      fallbackActualEnd: '',
      notes: '',
    },
  },
  parties: {},
  chump: {
    played: false,
    outcome: null,
    winner: '',
    notes: '',
    amount: { total: '', cash: '', coins: '', manualTotal: false },
    players: [],
    playerCountOverride: '',
  },
  overtime: '',
  consideration: { items: [], net: 0 },
  swindle: { total: 0, movements: [], net: {} },
  drinking: { items: [], totalSBE: 0 },
  earnings: {
    tips: 0,
    wage: 0,
    overtime: 0,
    chump: 0,
    consideration: 0,
    swindle: 0,
    total: 0,
  },
  summary: {
    earnings: 0,
    hours: 0,
    hourly: 0,
    tips: {
      actual: { total: 0, perHour: 0 },
    },
  },
  meta: {
    tipsPending: true,
    chumpLogged: false,
    notes: '',
  },
};

export function serializeShiftForRow(shift) {
  const totalEarnings = parseFloat(shift?.earnings?.total ?? 0) || 0;
  const hours = parseFloat(shift?.summary?.hours ?? 0) || 0;
  return [
    shift.id || `shift_${Date.now()}`,
    shift.date || '',
    shift.type || '',
    hours.toFixed(2),
    totalEarnings.toFixed(2),
    JSON.stringify(shift),
  ];
}

export function deserializeShiftRow(rowIndex, rowValues) {
  if (!rowValues || rowValues.length === 0) return null;
  const normalized = Array.isArray(rowValues) ? rowValues : [];

  if (normalized.length <= 2) {
    const [id, rawJson] = normalized;
    if (!id && !rawJson) return null;
    let legacyData = null;
    if (rawJson) {
      try {
        legacyData = JSON.parse(rawJson);
      } catch (error) {
        console.warn('Failed to parse legacy shift JSON', error, rowValues);
      }
    }
    legacyData = normalizeShiftPayload(legacyData || { id });
    if (!legacyData) return null;
    if (!legacyData.id) legacyData.id = id || `shift_${Date.now()}`;
    return {
      rowIndex,
      id: legacyData.id,
      data: legacyData,
    };
  }

  const [id, date, type, hoursStr, totalStr, json] = normalized;
  if (!id && !json) return null;
  let data = null;
  try {
    data = json ? JSON.parse(json) : null;
  } catch (error) {
    console.warn('Failed to parse shift JSON from sheet', error, rowValues);
  }
  if (!data) {
    data = {
      id,
      date,
      type,
      summary: { hours: parseFloat(hoursStr) || 0, hourly: 0 },
      earnings: { total: parseFloat(totalStr) || 0 },
    };
  }
  data = normalizeShiftPayload(data);
  if (!data.id) data.id = id || `shift_${Date.now()}`;
  return {
    rowIndex,
    id: data.id,
    data,
  };
}

export function applyLocalShift(records, shiftRecord) {
  const next = Array.isArray(records) ? [...records] : [];
  const index = next.findIndex((item) => item.id === shiftRecord.id);
  if (index >= 0) {
    next[index] = shiftRecord;
  } else {
    next.push(shiftRecord);
  }
  return next;
}

export function removeLocalShift(records, shiftId) {
  return (records || []).filter((item) => item.id !== shiftId);
}

export function estimateRowIndex(records, shiftId) {
  const record = (records || []).find((item) => item.id === shiftId);
  return record?.rowIndex || null;
}

export function deepMergeShift(template, override) {
  const clone = JSON.parse(JSON.stringify(template));
  if (!override) return clone;

  const merge = (target, source) => {
    Object.entries(source || {}).forEach(([key, value]) => {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        target[key] = merge(target[key] ? { ...target[key] } : {}, value);
      } else {
        target[key] = value;
      }
    });
    return target;
  };

  return merge(clone, override);
}

export function setNestedValue(target, path, value) {
  const keys = path.split('.');
  let cursor = target;
  for (let i = 0; i < keys.length - 1; i += 1) {
    const key = keys[i];
    const isIndex = /^\d+$/.test(key);
    if (isIndex) {
      const index = Number(key);
      if (!Array.isArray(cursor)) {
        cursor[key] = cursor[key] || {};
        cursor = cursor[key];
      } else {
        if (!cursor[index]) {
          cursor[index] = {};
        }
        cursor = cursor[index];
      }
    } else {
      if (!cursor[key] || typeof cursor[key] !== 'object') {
        cursor[key] = {};
      }
      cursor = cursor[key];
    }
  }
  const lastKey = keys[keys.length - 1];
  if (/^\d+$/.test(lastKey) && Array.isArray(cursor)) {
    cursor[Number(lastKey)] = value;
  } else {
    cursor[lastKey] = value;
  }
}

export function getNestedValue(target, path) {
  const keys = path.split('.');
  let cursor = target;
  for (let i = 0; i < keys.length; i += 1) {
    if (!cursor) return undefined;
    cursor = cursor[keys[i]];
  }
  return cursor;
}

export function buildInitialTimeDrafts(data = {}) {
  const drafts = {
    base: {
      start: formatTimeDisplay(data?.time?.base?.start),
      end: formatTimeDisplay(data?.time?.base?.end),
    },
    buckets: {},
    parties: {},
    wage: {
      start: formatTimeDisplay(data?.wage?.clock?.start),
      end: formatTimeDisplay(data?.wage?.clock?.end),
    },
    crew: {
      bartenders: {},
      servers: {},
      support: {},
      estimates: {},
    },
  };

  ['present', 'clock', 'tips', 'working'].forEach((bucket) => {
    const bucketData = data?.time?.[bucket];
    drafts.buckets[bucket] = {
      start: formatTimeDisplay(bucketData?.start),
      end: formatTimeDisplay(bucketData?.end),
    };
  });

  Object.entries(data?.parties || {}).forEach(([id, party]) => {
    drafts.parties[id] = {
      start: formatTimeDisplay(party?.time?.start),
      end: formatTimeDisplay(party?.time?.end),
    };
  });

  (data?.coworkers?.bartenders || []).forEach((member, index) => {
    drafts.crew.bartenders[index] = {
      start: formatTimeDisplay(member?.start),
      end: formatTimeDisplay(member?.end),
      actualStart: formatTimeDisplay(member?.actualStart),
      actualEnd: formatTimeDisplay(member?.actualEnd),
    };
  });

  (data?.coworkers?.servers || []).forEach((member, index) => {
    drafts.crew.servers[index] = {
      start: formatTimeDisplay(member?.start),
      end: formatTimeDisplay(member?.end),
      actualStart: formatTimeDisplay(member?.actualStart),
      actualEnd: formatTimeDisplay(member?.actualEnd),
    };
  });

  (data?.coworkers?.support || []).forEach((member, index) => {
    drafts.crew.support[index] = {
      start: formatTimeDisplay(member?.start),
      end: formatTimeDisplay(member?.end),
      actualStart: formatTimeDisplay(member?.actualStart),
      actualEnd: formatTimeDisplay(member?.actualEnd),
    };
  });

  drafts.crew.estimates = {
    fallbackEnd: formatTimeDisplay(data?.coworkers?.estimates?.fallbackEnd),
    fallbackActualEnd: formatTimeDisplay(data?.coworkers?.estimates?.fallbackActualEnd),
  };

  return drafts;
}

export function calculateHoursBetween(start, end) {
  if (!start || !end) return 0;
  const [startHour, startMin] = start.split(':').map(Number);
  const [endHour, endMin] = end.split(':').map(Number);
  let hours = endHour - startHour + (endMin - startMin) / 60;
  if (hours < 0) hours += 24;
  return Math.round(hours * 100) / 100;
}

const MINUTES_IN_DAY = 24 * 60;

export function timeStringToMinutes(time) {
  if (!time || typeof time !== 'string' || !time.includes(':')) return null;
  const [hourStr, minuteStr] = time.split(':');
  const hour = parseInt(hourStr, 10);
  const minutes = parseInt(minuteStr, 10);
  if (Number.isNaN(hour) || Number.isNaN(minutes)) return null;
  return (hour % 24) * 60 + minutes;
}

export function normalizeMinutesDiff(startMinutes, endMinutes) {
  if (startMinutes == null || endMinutes == null) return null;
  let diff = endMinutes - startMinutes;
  if (diff <= 0) diff += MINUTES_IN_DAY;
  return diff;
}

export function formatTimeDisplay(time24) {
  if (!time24 || typeof time24 !== 'string' || !time24.includes(':')) return '';
  const [hourStr, minuteStr] = time24.split(':');
  const hour = parseInt(hourStr, 10);
  const minute = parseInt(minuteStr, 10);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return '';
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`;
}

export function parseFlexibleTime(rawInput, { mode = 'general', referenceStart = null, defaultPeriod = null } = {}) {
  const raw = typeof rawInput === 'number' ? rawInput.toString() : (rawInput || '').toString();
  const trimmed = raw.trim();

  if (trimmed === '') {
    return { ok: true, normalized: '', display: '', period: null, raw: '' };
  }

  let working = trimmed.toLowerCase().replace(/\s+/g, '');
  let explicitPeriod = null;

  if (/(am|a)$/.test(working)) {
    explicitPeriod = 'am';
    working = working.replace(/(am|a)$/, '');
  } else if (/(pm|p)$/.test(working)) {
    explicitPeriod = 'pm';
    working = working.replace(/(pm|p)$/, '');
  }

  let hour = null;
  let minute = null;

  if (working.includes(':')) {
    const [hourPart, minutePartRaw] = working.split(':');
    hour = parseInt(hourPart, 10);
    const minutePart = (minutePartRaw || '').replace(/[^\d]/g, '').slice(0, 2);
    minute = minutePart ? parseInt(minutePart, 10) : 0;
  } else {
    const digits = working.replace(/[^\d]/g, '');
    if (!digits) {
      return { ok: false, reason: 'no-digits' };
    }
    if (digits.length <= 2) {
      hour = parseInt(digits, 10);
      minute = 0;
    } else if (digits.length === 3) {
      hour = parseInt(digits.slice(0, 1), 10);
      minute = parseInt(digits.slice(1), 10);
    } else {
      hour = parseInt(digits.slice(0, digits.length - 2), 10);
      minute = parseInt(digits.slice(-2), 10);
    }
  }

  if (
    Number.isNaN(hour) ||
    Number.isNaN(minute) ||
    hour < 0 ||
    minute < 0 ||
    minute >= 60 ||
    hour > 24
  ) {
    return { ok: false, reason: 'invalid-range' };
  }

  if (hour === 24) {
    hour = 0;
    explicitPeriod = 'am';
  }

  const periodFromExplicit = explicitPeriod ? explicitPeriod : null;

  const minuteComponent = minute;
  const isExplicitMilitary =
    hour >= 13 ||
    (working.includes(':') && working.startsWith('0')) ||
    (working.length === 4 && parseInt(working.slice(0, 2), 10) >= 13) ||
    (working.length === 4 && parseInt(working.slice(0, 2), 10) === 0);

  const evaluateEndCandidate = (candidates, referenceMinutes) => {
    if (!candidates.length) return null;
    if (referenceMinutes == null) return candidates[0].hour24;

    const maxDuration = 12 * 60;
    let best = null;
    candidates.forEach((candidate) => {
      const candidateMinutes = candidate.hour24 * 60 + minuteComponent;
      let diff = candidateMinutes - referenceMinutes;
      if (diff <= 0) diff += MINUTES_IN_DAY;
      const withinWindow = diff > 0 && diff <= maxDuration;
      if (withinWindow) {
        if (!best || diff < best.diff) {
          best = { hour24: candidate.hour24, diff };
        }
      }
    });
    if (best) return best.hour24;

    let fallback = null;
    candidates.forEach((candidate) => {
      const candidateMinutes = candidate.hour24 * 60 + minuteComponent;
      let diff = candidateMinutes - referenceMinutes;
      if (diff <= 0) diff += MINUTES_IN_DAY;
      if (!fallback || diff < fallback.diff) {
        fallback = { hour24: candidate.hour24, diff };
      }
    });
    return fallback ? fallback.hour24 : candidates[0].hour24;
  };

  let hour24 = 0;
  let resolvedPeriod = periodFromExplicit;

  if (mode === 'end') {
    const baseHour = hour % 12;
    const amHour = baseHour === 12 ? 0 : baseHour;
    const pmHour = baseHour === 12 ? 12 : baseHour + 12;
    const candidates = [];

    if (isExplicitMilitary) {
      candidates.push({ hour24: hour % 24 });
      resolvedPeriod = hour % 24 >= 12 ? 'pm' : 'am';
    } else if (resolvedPeriod === 'am') {
      candidates.push({ hour24: amHour });
    } else if (resolvedPeriod === 'pm') {
      candidates.push({ hour24: pmHour });
    } else {
      if (!candidates.some((c) => c.hour24 === pmHour)) {
        candidates.push({ hour24: pmHour });
      }
      if (!candidates.some((c) => c.hour24 === amHour)) {
        candidates.push({ hour24: amHour });
      }
    }

    const referenceMinutes = referenceStart ? timeStringToMinutes(referenceStart) : null;
    hour24 = evaluateEndCandidate(candidates, referenceMinutes);
    resolvedPeriod = hour24 >= 12 ? 'pm' : 'am';
  } else if (isExplicitMilitary) {
    hour24 = hour % 24;
    resolvedPeriod = hour24 >= 12 ? 'pm' : 'am';
  } else {
    if (!resolvedPeriod) {
      if (mode === 'start') {
        if (hour >= 10 && hour <= 11) {
          resolvedPeriod = 'am';
        } else {
          resolvedPeriod = 'pm';
        }
      } else if (defaultPeriod) {
        resolvedPeriod = defaultPeriod;
      } else if (hour >= 10 && hour <= 11) {
        resolvedPeriod = 'am';
      } else {
        resolvedPeriod = 'pm';
      }
    }

    const baseHour = hour % 12;
    hour24 = baseHour;
    if (resolvedPeriod === 'pm' && hour24 < 12) {
      hour24 += 12;
    }
    if (resolvedPeriod === 'am' && hour24 === 12) {
      hour24 = 0;
    }
  }

  const normalized = `${hour24.toString().padStart(2, '0')}:${minuteComponent
    .toString()
    .padStart(2, '0')}`;
  return {
    ok: true,
    normalized,
    display: formatTimeDisplay(normalized),
    period: resolvedPeriod,
    raw: trimmed,
  };
}

export function inferShiftTypeFromTimes(startTime, endTime) {
  if (!startTime) return '';
  const startMinutes = timeStringToMinutes(startTime);
  if (startMinutes == null) return '';
  const endMinutes = timeStringToMinutes(endTime);
  const duration = endMinutes != null ? normalizeMinutesDiff(startMinutes, endMinutes) : null;

  const dayStartMin = 10 * 60;
  const dayEndMax = 19 * 60 + 30;
  const nightThreshold = 16 * 60;

  if (startMinutes >= nightThreshold || startMinutes < dayStartMin) {
    return 'night';
  }

  if (startMinutes >= dayStartMin && startMinutes <= 13 * 60) {
    if (!duration || duration <= 9 * 60) {
      if (!endTime || timeStringToMinutes(endTime) <= dayEndMax) {
        return 'day';
      }
    }
  }

  if (startMinutes >= 13 * 60 && startMinutes <= nightThreshold) {
    if (endMinutes != null) {
      const endWithinDay = endMinutes <= dayEndMax;
      if (endWithinDay && (!duration || duration <= 8 * 60)) {
        return 'day';
      }
    }
  }

  return 'night';
}

export function ensureCutSkeleton(type, parties, existingCuts) {
  const normalizedParties = parties || {};
  const baseCutSet = new Set();
  if (type === 'day') {
    baseCutSet.add('day');
    baseCutSet.add('mid');
  } else if (type === 'night') {
    baseCutSet.add('night');
  } else if (type === 'double') {
    baseCutSet.add('day');
    baseCutSet.add('mid');
    baseCutSet.add('night');
  } else {
    baseCutSet.add('day');
    baseCutSet.add('mid');
  }

  const requiredPartyCuts = Object.entries(normalizedParties)
    .filter(([, party]) => (party?.cutType || type || 'night') !== 'night')
    .map(([id]) => id);

  const requiredKeys = [...baseCutSet, ...requiredPartyCuts];
  const cuts = { ...(existingCuts || {}) };
  let changed = false;

  Object.keys(cuts).forEach((key) => {
    const isPartyCut = key.startsWith('party_');
    if (isPartyCut && !requiredPartyCuts.includes(key)) {
      delete cuts[key];
      changed = true;
    }
  });

  requiredKeys.forEach((key) => {
    if (!cuts[key]) {
      changed = true;
      cuts[key] = {
        label: key.startsWith('party_')
          ? normalizedParties?.[key]?.name || 'Party Cut'
          : key.charAt(0).toUpperCase() + key.slice(1),
        me: { tips: '', hours: '' },
        total: { tips: '', hours: '' },
        share: { pct: '', people: '', notes: '' },
        status: 'pending',
      };
    }
  });

  return changed ? cuts : existingCuts;
}

export function sanitizeBartenderEntry(entry = {}) {
  return {
    id: entry.id || '',
    name: entry.name || '',
    start: entry.start || '',
    end: entry.end || '',
    actualStart: entry.actualStart || '',
    actualEnd: entry.actualEnd || '',
    location: entry.location || '',
    status: entry.status || 'tentative',
    notes: entry.notes || '',
    positions: Array.isArray(entry.positions) ? entry.positions : [],
    isManager: Boolean(entry.isManager),
    isSelf: Boolean(entry.isSelf),
  };
}

export function sanitizeServerEntry(entry = {}) {
  return {
    id: entry.id || '',
    name: entry.name || '',
    start: entry.start || '',
    end: entry.end || '',
    actualStart: entry.actualStart || '',
    actualEnd: entry.actualEnd || '',
    order: entry.order || '',
    tipOut: entry.tipOut || '',
    notes: entry.notes || '',
  };
}

export function sanitizeSupportEntry(entry = {}) {
  return {
    id: entry.id || '',
    name: entry.name || '',
    role: entry.role || 'Host',
    start: entry.start || '',
    end: entry.end || '',
    actualStart: entry.actualStart || '',
    actualEnd: entry.actualEnd || '',
    notes: entry.notes || '',
  };
}

export function sanitizeChumpPlayer(entry = {}) {
  const probability =
    entry.joinProbability !== undefined
      ? entry.joinProbability
      : entry.probability !== undefined
        ? entry.probability
        : entry.chance !== undefined
          ? entry.chance
          : 1;
  let normalizedProbability = String(probability);
  if (normalizedProbability === '') {
    normalizedProbability = '1';
  }
  const decision =
    entry.joinDecision !== undefined
      ? entry.joinDecision
      : entry.outcome && ['win', 'loss'].includes(entry.outcome)
        ? entry.outcome
        : null;
  return {
    name: entry.name || '',
    joinProbability: normalizedProbability,
    joinDecision: decision,
    notes: entry.notes || '',
  };
}

export function normalizeCrewData(raw) {
  const base = {
    bartenders: [],
    servers: [],
    support: [],
    estimates: {
      fallbackEnd: '',
      fallbackActualEnd: '',
      notes: '',
    },
  };

  if (!raw) return base;

  const result = {
    bartenders: [],
    servers: [],
    support: [],
    estimates: { ...base.estimates, ...(raw.estimates || {}) },
  };

  if (Array.isArray(raw.bartenders)) {
    result.bartenders = raw.bartenders.map((entry) => sanitizeBartenderEntry(entry));
  } else if (raw.bartenders && typeof raw.bartenders === 'object') {
    Object.entries(raw.bartenders).forEach(([name, details]) => {
      const detailArray = Array.isArray(details) ? details : [];
      const schedule = detailArray[1] || '';
      let start = '';
      let end = '';
      if (typeof schedule === 'string' && schedule.includes('-')) {
        const [schedStart, schedEnd] = schedule.split('-').map((token) => token.trim());
        start = schedStart || '';
        end = schedEnd || '';
      }
      result.bartenders.push(
        sanitizeBartenderEntry({
          name,
          location: detailArray[0] || '',
          start,
          end,
          notes: detailArray.slice(2).join(' • '),
        }),
      );
    });
  }

  if (Array.isArray(raw.servers)) {
    result.servers = raw.servers.map((entry) => sanitizeServerEntry(entry));
  } else if (raw.servers && typeof raw.servers === 'object') {
    Object.entries(raw.servers).forEach(([name, details]) => {
      const detailArray = Array.isArray(details) ? details : [];
      result.servers.push(
        sanitizeServerEntry({
          name,
          start: detailArray[0] || '',
          end: detailArray[1] || '',
          notes: detailArray.slice(2).join(' • '),
        }),
      );
    });
  }

  if (Array.isArray(raw.support)) {
    result.support = raw.support.map((entry) => sanitizeSupportEntry(entry));
  }

  return result;
}

export function normalizeShiftPayload(shift) {
  if (shift === null || shift === undefined) return null;

  let primitiveValue = null;
  let base = shift;

  if (typeof base !== 'object' || base === null) {
    primitiveValue = base;
    base = {};
  } else if (Array.isArray(base)) {
    primitiveValue = base;
    base = {};
  }

  const cloned = JSON.parse(JSON.stringify(base));

  if (primitiveValue !== null && primitiveValue !== undefined) {
    const numeric = Number(primitiveValue);
    cloned.tips = cloned.tips || {};
    if (cloned.tips._total === undefined || cloned.tips._total === null || cloned.tips._total === '') {
      cloned.tips._total = primitiveValue;
    }
    cloned.earnings = cloned.earnings || {};
    if (Number.isFinite(numeric)) {
      if (cloned.earnings.tips === undefined || cloned.earnings.tips === null) {
        cloned.earnings.tips = numeric;
      }
      if (cloned.earnings.total === undefined || cloned.earnings.total === null) {
        cloned.earnings.total = numeric;
      }
    }
  }

  cloned.coworkers = normalizeCrewData(cloned.coworkers);
  delete cloned.coworkerStats;

  cloned.wage = cloned.wage || {};
  cloned.wage.base = cloned.wage.base !== undefined ? cloned.wage.base : 5.0;
  cloned.wage.hours = cloned.wage.hours !== undefined ? cloned.wage.hours : '';
  cloned.wage.total = cloned.wage.total !== undefined ? cloned.wage.total : '';
  cloned.wage.clock = cloned.wage.clock || { start: '', end: '', manualStart: false, manualEnd: false };
  cloned.wage.clock.start = cloned.wage.clock.start || '';
  cloned.wage.clock.end = cloned.wage.clock.end || '';
  cloned.wage.clock.manualStart = Boolean(cloned.wage.clock.manualStart);
  cloned.wage.clock.manualEnd = Boolean(cloned.wage.clock.manualEnd);
  cloned.wage.autoTotal = cloned.wage.autoTotal === undefined ? true : Boolean(cloned.wage.autoTotal);

  if (!cloned.tips) cloned.tips = { _total: '' };
  if (cloned.tips._total === 0) cloned.tips._total = '';

  if (!cloned.chump) {
    cloned.chump = JSON.parse(JSON.stringify(DEFAULT_SHIFT_TEMPLATE.chump));
  } else {
    cloned.chump.played = Boolean(cloned.chump.played);
    cloned.chump.outcome = cloned.chump.outcome || null;
    cloned.chump.winner = cloned.chump.winner || '';
    cloned.chump.notes = cloned.chump.notes || '';
    const amount = cloned.chump.amount || {};
    cloned.chump.amount = {
      total: amount.total !== undefined ? String(amount.total) : '',
      cash: amount.cash !== undefined ? String(amount.cash) : (amount.bills !== undefined ? String(amount.bills) : ''),
      coins: amount.coins !== undefined ? String(amount.coins) : '',
      manualTotal: amount.manualTotal === undefined ? false : Boolean(amount.manualTotal),
    };
    cloned.chump.playerCountOverride =
      cloned.chump.playerCountOverride !== undefined ? String(cloned.chump.playerCountOverride) : '';
    cloned.chump.players = Array.isArray(cloned.chump.players)
      ? cloned.chump.players.map((player) => sanitizeChumpPlayer(player))
      : [];
  }

  cloned.overtime = cloned.overtime !== undefined ? String(cloned.overtime) : '';

  if (!Array.isArray(cloned.drinking?.items)) {
    cloned.drinking = cloned.drinking || {};
    cloned.drinking.items = [];
  }

  return cloned;
}

export function upsertSelfCrew(data, directory) {
  if (!data) return data;
  const coworkers = data.coworkers || normalizeCrewData();
  const bartenders = coworkers.bartenders || [];
  const selfMember = directory.find((member) => member.isSelf);
  const expectedName = (selfMember?.name || 'Ian').trim().toLowerCase();

  let index = bartenders.findIndex(
    (entry) =>
      entry.isSelf ||
      (entry.name || '').trim().toLowerCase() === expectedName,
  );

  const baseStart = data.time?.base?.start || '';
  const baseEnd = data.time?.base?.end || '';

  if (index === -1) {
    const next = JSON.parse(JSON.stringify(data));
    const entry = sanitizeBartenderEntry({
      id: selfMember?.id || '',
      name: selfMember?.name || 'Ian',
      start: baseStart,
      end: baseEnd,
      actualStart: baseStart,
      actualEnd: baseEnd,
      status: 'confirmed',
      positions: selfMember?.positions || [],
      isManager: !!selfMember?.isManager,
      isSelf: true,
    });
    next.coworkers = next.coworkers ? normalizeCrewData(next.coworkers) : normalizeCrewData();
    next.coworkers.bartenders = [entry, ...(next.coworkers.bartenders || [])];
    return next;
  }

  const candidate = bartenders[index];
  let changed = false;
  if (!candidate.isSelf) {
    changed = true;
  }
  if (selfMember) {
    if (!candidate.id && selfMember.id) changed = true;
    if ((!candidate.positions || candidate.positions.length === 0) && selfMember.positions?.length) changed = true;
    if (!candidate.isManager && selfMember.isManager) changed = true;
  }
  if (!candidate.start && baseStart) changed = true;
  if (!candidate.end && baseEnd) changed = true;
  if (!candidate.actualStart && baseStart) changed = true;
  if (!candidate.actualEnd && baseEnd) changed = true;

  if (!changed) return data;

  const next = JSON.parse(JSON.stringify(data));
  const target = next.coworkers.bartenders[index];
  target.isSelf = true;
  if (selfMember) {
    target.id = target.id || selfMember.id || '';
    if (!target.positions || target.positions.length === 0) {
      target.positions = selfMember.positions || [];
    }
    if (selfMember.isManager) {
      target.isManager = true;
    }
  }
  if (!target.start && baseStart) target.start = baseStart;
  if (!target.end && baseEnd) target.end = baseEnd;
  if (!target.actualStart && baseStart) target.actualStart = baseStart;
  if (!target.actualEnd && baseEnd) target.actualEnd = baseEnd;
  return next;
}

export function parseShiftDate(dateString) {
  if (!dateString || typeof dateString !== 'string') return null;
  const parts = dateString.trim().split('-');
  if (parts.length < 3) return null;
  const [yearStr, monthStr, dayStr] = parts;
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  if ([year, month, day].some((value) => !Number.isFinite(value))) return null;
  return new Date(year, month - 1, day);
}

export function formatShiftDate(dateString, options, locale = 'en-US') {
  const parsed = parseShiftDate(dateString);
  if (!parsed) return '';
  return parsed.toLocaleDateString(locale, options);
}
