// @ts-nocheck
import { useState, useRef, useCallback } from 'react';
import { sheetsAPI } from '../lib/googleSheets';
import {
  loadCachedShifts,
  storeCachedShifts,
  loadPendingQueue,
  storePendingQueue,
  isOnline,
} from '../lib/storage';
import {
  serializeShiftForRow,
  deserializeShiftRow,
  applyLocalShift,
  removeLocalShift,
  estimateRowIndex,
  DEFAULT_SHIFT_TEMPLATE,
  deepMergeShift,
  normalizeShiftPayload,
} from '../pages/ShiftEntryPage';
import { COWORKER_SHEET_NAME, getSheetsErrorMessage } from '../lib/sheetsHelpers';

declare const gapi: any;

type AppConfig = {
  clientId: string;
  apiKey: string;
  spreadsheetId: string;
  sheetName: string;
};

type UseShiftManagerOptions = {
  config: AppConfig;
  isAuthenticated: boolean;
  setLoading: (value: boolean) => void;
  setError: (value: any) => void;
};

const coworkerRowRange = (rowIndex: number) => `${COWORKER_SHEET_NAME}!A${rowIndex}:F${rowIndex}`;

const formatCoworkerForSheet = (draft: any) => {
  if (!draft) return null;
  const firstName = (draft.firstName || '').trim();
  const lastName = (draft.lastName || '').trim();
  const displayName = (draft.name || `${firstName} ${lastName}` || '').trim();
  const positions = Array.isArray(draft.positions) ? draft.positions.filter(Boolean) : [];
  return {
    rowIndex: draft.rowIndex || null,
    id: (draft.id || '').trim(),
    name: displayName,
    firstName,
    lastName,
    positions,
    isManager: !!draft.isManager,
  };
};

export const useShiftManager = ({
  config,
  isAuthenticated,
  setLoading,
  setError,
}: UseShiftManagerOptions) => {
  const [shifts, setShifts] = useState(() => loadCachedShifts() || []);
  const [currentShift, setCurrentShift] = useState<any>(null);
  const [coworkerDirectory, setCoworkerDirectory] = useState<any[]>([]);
  const coworkerSheetMetaRef = useRef<{ ensured: boolean; sheetId: number | null }>({
    ensured: false,
    sheetId: null,
  });
  const syncingRef = useRef(false);

  const loadShifts = useCallback(async () => {
    if (!config.spreadsheetId || !isAuthenticated) return;

    setLoading(true);
    setError(null);
    try {
      const range = `${config.sheetName}!A2:F`;
      const response = await sheetsAPI.readData(config.spreadsheetId, range);
      const values = response || [];
      const loadedShifts = values
        .map((row: any[], index: number) => deserializeShiftRow(index + 2, row))
        .filter(Boolean);
      setShifts(loadedShifts);
      storeCachedShifts(loadedShifts);
    } catch (error: any) {
      console.warn('Failed to fetch shifts from Sheets', error);
      const cached = loadCachedShifts();
      if (cached && cached.length) {
        setShifts(cached);
        setError('Offline mode: showing cached shifts.');
      } else if (error?.message) {
        setError('Failed to load shifts: ' + error.message);
      } else {
        setError('Failed to load shifts.');
      }
    } finally {
      setLoading(false);
    }
  }, [config.sheetName, config.spreadsheetId, isAuthenticated, setError, setLoading]);

  const ensureCoworkerSheetExists = useCallback(async () => {
    if (!config.spreadsheetId || !isAuthenticated) return null;
    if (typeof gapi === 'undefined' || !gapi?.client?.sheets) {
      throw new Error('Google Sheets client is not ready yet. Try reconnecting Google Sheets.');
    }

    const cache = coworkerSheetMetaRef.current || { ensured: false, sheetId: null };
    if (cache.ensured) {
      return cache.sheetId ?? null;
    }

    try {
      const spreadsheet = await gapi.client.sheets.spreadsheets.get({
        spreadsheetId: config.spreadsheetId,
        includeGridData: false,
      });
      const existing = spreadsheet.result?.sheets?.find(
        (sheet: any) => sheet.properties?.title === COWORKER_SHEET_NAME,
      );
      if (existing) {
        const sheetId = existing.properties?.sheetId ?? null;
        coworkerSheetMetaRef.current = { ensured: true, sheetId };
        return sheetId;
      }
    } catch (error: any) {
      throw new Error(getSheetsErrorMessage(error, 'Unable to inspect spreadsheet for coworker tab.'));
    }

    try {
      const addResponse = await gapi.client.sheets.spreadsheets.batchUpdate({
        spreadsheetId: config.spreadsheetId,
        resource: {
          requests: [
            {
              addSheet: {
                properties: {
                  title: COWORKER_SHEET_NAME,
                  tabColor: { red: 0.129, green: 0.231, blue: 0.541 },
                },
              },
            },
          ],
        },
      });
      const newSheetId = addResponse.result?.replies?.[0]?.addSheet?.properties?.sheetId ?? null;
      await gapi.client.sheets.spreadsheets.values.update({
        spreadsheetId: config.spreadsheetId,
        range: `${COWORKER_SHEET_NAME}!A1:F1`,
        valueInputOption: 'RAW',
        resource: {
          values: [['ID', 'Name', 'First', 'Last', 'Positions', 'Manager']],
        },
      });
      coworkerSheetMetaRef.current = { ensured: true, sheetId: newSheetId };
      return newSheetId;
    } catch (error: any) {
      coworkerSheetMetaRef.current = { ensured: false, sheetId: null };
      throw new Error(getSheetsErrorMessage(error, 'Unable to create Coworkers sheet.'));
    }
  }, [config.spreadsheetId, isAuthenticated]);

  const loadCoworkerDirectory = useCallback(async () => {
    if (!config.spreadsheetId || !isAuthenticated) return;
    try {
      await ensureCoworkerSheetExists();
      const rows = await sheetsAPI.readData(config.spreadsheetId, `${COWORKER_SHEET_NAME}!A2:F`);
      const directory = (rows || [])
        .map((row: any[], index: number) => {
          const [id = '', name = '', firstName = '', lastName = '', positionsRaw = '', managerRaw = ''] =
            row || [];
          const rowIndex = index + 2;
          const fallbackName = [firstName, lastName].filter(Boolean).join(' ');
          const normalizedName = (name || fallbackName || '').trim();
          if (!normalizedName) return null;
          const positions = (positionsRaw || '')
            .split(/[,/]/)
            .map((token: string) => token.trim())
            .filter(Boolean);
          const positionsNormalized = positions.map((p) => p.toLowerCase());
          const managerFlag = String(managerRaw || '').trim().toLowerCase();
          const isManager = managerFlag === 'true' || managerFlag === 'yes' || managerFlag === '1';
          const isSelf =
            normalizedName.toLowerCase() === 'ian' ||
            (firstName || '').trim().toLowerCase() === 'ian';
          return {
            rowIndex,
            id: id || `coworker_${index}`,
            name: normalizedName,
            firstName: firstName || '',
            lastName: lastName || '',
            positions,
            positionsNormalized,
            isManager,
            isSelf,
          };
        })
        .filter(Boolean);
      setCoworkerDirectory(directory);
      setError((prev: any) => (prev && prev.toLowerCase().includes('coworker') ? null : prev));
    } catch (directoryError: any) {
      console.warn('Failed to load coworker directory', directoryError);
      setCoworkerDirectory([]);
      setError(getSheetsErrorMessage(directoryError, 'Failed to load coworker directory.'));
    }
  }, [config.spreadsheetId, ensureCoworkerSheetExists, isAuthenticated, setError]);

  const upsertCoworkerRecord = useCallback(
    async (draft: any) => {
      if (!config.spreadsheetId || !isAuthenticated) {
        throw new Error('Connect Google Sheets to manage coworkers.');
      }
      if (typeof gapi === 'undefined' || !gapi?.client?.sheets) {
        throw new Error('Google Sheets client is not ready yet.');
      }
      await ensureCoworkerSheetExists();

      const payload = formatCoworkerForSheet(draft);
      if (!payload) {
        throw new Error('Invalid coworker details.');
      }
      if (!payload.name) {
        throw new Error('Name is required.');
      }
      const positionsValue = payload.positions.join(', ');
      const rowValues = [
        payload.id,
        payload.name,
        payload.firstName,
        payload.lastName,
        positionsValue,
        payload.isManager ? 'TRUE' : '',
      ];

      try {
        if (payload.rowIndex) {
          await gapi.client.sheets.spreadsheets.values.update({
            spreadsheetId: config.spreadsheetId,
            range: coworkerRowRange(payload.rowIndex),
            valueInputOption: 'RAW',
            resource: {
              values: [rowValues],
            },
          });
        } else {
          await gapi.client.sheets.spreadsheets.values.append({
            spreadsheetId: config.spreadsheetId,
            range: `${COWORKER_SHEET_NAME}!A:F`,
            valueInputOption: 'RAW',
            insertDataOption: 'INSERT_ROWS',
            resource: {
              values: [rowValues],
            },
          });
        }
      } catch (error: any) {
        throw new Error(getSheetsErrorMessage(error, 'Unable to save coworker.'));
      }

      await loadCoworkerDirectory();
      return payload;
    },
    [config.spreadsheetId, ensureCoworkerSheetExists, isAuthenticated, loadCoworkerDirectory],
  );

  const deleteCoworkerRecord = useCallback(
    async (record: any) => {
      if (!config.spreadsheetId || !isAuthenticated) {
        throw new Error('Connect Google Sheets to manage coworkers.');
      }
      if (typeof gapi === 'undefined' || !gapi?.client?.sheets) {
        throw new Error('Google Sheets client is not ready yet.');
      }
      if (!record?.rowIndex) {
        throw new Error('Missing row information for coworker.');
      }

      await ensureCoworkerSheetExists();

      try {
        await gapi.client.sheets.spreadsheets.values.update({
          spreadsheetId: config.spreadsheetId,
          range: coworkerRowRange(record.rowIndex),
          valueInputOption: 'RAW',
          resource: {
            values: [['', '', '', '', '', '']],
          },
        });
      } catch (error: any) {
        throw new Error(getSheetsErrorMessage(error, 'Unable to delete coworker.'));
      }

      await loadCoworkerDirectory();
    },
    [config.spreadsheetId, ensureCoworkerSheetExists, isAuthenticated, loadCoworkerDirectory],
  );

  const syncPendingShifts = useCallback(async () => {
    if (syncingRef.current) return;
    if (!config.spreadsheetId || !isAuthenticated || !isOnline()) return;
    const queue = loadPendingQueue();
    if (!queue.length) return;
    syncingRef.current = true;

    const sheetName = config.sheetName || 'Shifts';
    const updates: any[] = [];
    const clears: any[] = [];
    const inserts: any[] = [];

    queue.forEach((op: any) => {
      if (op.type === 'delete') {
        if (op.rowIndex) {
          clears.push(op);
        }
      } else if (op.type === 'upsert') {
        if (op.rowIndex) {
          updates.push(op);
        } else {
          inserts.push(op);
        }
      }
    });

    try {
      const dataRequests: any[] = [];
      updates.forEach((op) => {
        dataRequests.push({
          range: `${sheetName}!A${op.rowIndex}:F${op.rowIndex}`,
          values: [serializeShiftForRow(op.shift)],
        });
      });
      clears.forEach((op) => {
        dataRequests.push({
          range: `${sheetName}!A${op.rowIndex}:F${op.rowIndex}`,
          values: [['', '', '', '', '', '']],
        });
      });

      if (dataRequests.length) {
        await gapi.client.sheets.spreadsheets.values.batchUpdate({
          spreadsheetId: config.spreadsheetId,
          resource: {
            valueInputOption: 'USER_ENTERED',
            data: dataRequests,
          },
        });
      }

      if (inserts.length) {
        const insertValues = inserts.map((op) => serializeShiftForRow(op.shift));
        await gapi.client.sheets.spreadsheets.values.append({
          spreadsheetId: config.spreadsheetId,
          range: `${sheetName}!A:F`,
          valueInputOption: 'USER_ENTERED',
          insertDataOption: 'INSERT_ROWS',
          resource: {
            values: insertValues,
          },
        });
      }

      storePendingQueue([]);
      await loadShifts();
    } catch (error) {
      console.warn('Failed to sync pending shifts', error);
      setError('Unable to sync pending changes. They will retry when you are back online.');
    } finally {
      syncingRef.current = false;
    }
  }, [config.sheetName, config.spreadsheetId, isAuthenticated, loadShifts, setError]);

  const saveShift = useCallback(
    async (shiftData: any) => {
      const normalized = normalizeShiftPayload(shiftData) || shiftData;
      const rowIndex = estimateRowIndex(shifts, normalized.id);
      const queue = loadPendingQueue();
      queue.push({
        type: 'upsert',
        id: normalized.id,
        shift: normalized,
        rowIndex,
        timestamp: Date.now(),
      });
      storePendingQueue(queue);

      const nextRecords = applyLocalShift(shifts, {
        rowIndex: rowIndex || null,
        id: normalized.id,
        data: normalized,
      });
      setShifts(nextRecords);
      storeCachedShifts(nextRecords);

      if (!config.spreadsheetId || !isAuthenticated) return normalized;

      setLoading(true);
      setError(null);
      try {
        await syncPendingShifts();
      } finally {
        setLoading(false);
      }

      return normalized;
    },
    [config.spreadsheetId, isAuthenticated, setError, setLoading, shifts, syncPendingShifts],
  );

  const deleteShift = useCallback(
    async (shiftId: string) => {
      const rowIndex = estimateRowIndex(shifts, shiftId);
      const queue = loadPendingQueue();
      queue.push({
        type: 'delete',
        id: shiftId,
        rowIndex,
        timestamp: Date.now(),
      });
      storePendingQueue(queue);

      const nextRecords = removeLocalShift(shifts, shiftId);
      setShifts(nextRecords);
      storeCachedShifts(nextRecords);

      if (!config.spreadsheetId || !isAuthenticated) return;

      setLoading(true);
      setError(null);
      try {
        await syncPendingShifts();
      } finally {
        setLoading(false);
      }
    },
    [config.spreadsheetId, isAuthenticated, setError, setLoading, shifts, syncPendingShifts],
  );

  const createShiftDraft = useCallback((seed: any = {}) => {
    const normalizedSeed = normalizeShiftPayload(seed) || seed;
    const draft = deepMergeShift(DEFAULT_SHIFT_TEMPLATE, normalizedSeed);
    setCurrentShift(draft);
    return draft;
  }, []);

  const createShiftDraftForDate = useCallback(
    (dateKey?: string) => {
      if (!dateKey) {
        return createShiftDraft();
      }
      return createShiftDraft({ date: dateKey });
    },
    [createShiftDraft],
  );

  const getShiftById = useCallback(
    (shiftId?: string | null) => {
      if (!shiftId) return null;
      return shifts.find((item) => item.id === shiftId) || null;
    },
    [shifts],
  );

  return {
    shifts,
    currentShift,
    setCurrentShift,
    coworkerDirectory,
    loadShifts,
    loadCoworkerDirectory,
    upsertCoworkerRecord,
    deleteCoworkerRecord,
    syncPendingShifts,
    saveShift,
    deleteShift,
    createShiftDraft,
    createShiftDraftForDate,
    getShiftById,
  };
};
