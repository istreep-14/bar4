// @ts-nocheck
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Chart from 'chart.js/auto';
import { APP_SERVER_PORT, CONTROL_SERVER_ORIGIN, ensureAppServerRunning } from './lib/serverControl';
import { sheetsAPI, SCOPES } from './lib/googleSheets';
import {
    loadStoredAuthToken,
    storeAuthToken,
    clearStoredAuthToken,
    loadCachedShifts,
    storeCachedShifts,
    loadPendingQueue,
    storePendingQueue,
    CONFIG_STORAGE_KEY,
    REMOTE_CONFIG_PATH,
    isOnline,
} from './lib/storage';
import TipsPage from './components/shift-entry/pages/TipsPage';
import WagePage from './components/shift-entry/pages/WagePage';
import SupplementPage from './components/shift-entry/pages/SupplementPage';

const VIEW_MODES = Object.freeze({
  DASHBOARD: 'dashboard',
  SHIFT_CREATE: 'shift-create',
  SHIFT_EDIT: 'shift-edit',
  SHIFT_VIEW: 'shift-view',
  COWORKERS: 'coworkers',
});

const CREW_POSITION_OPTIONS = ['Bartender', 'Server', 'Expo', 'Busser', 'Hostess', 'Door'];
const COWORKER_SHEET_NAME = 'Coworkers';

const getSheetsErrorMessage = (error, fallback = 'Google Sheets request failed.') => {
  if (!error) return fallback;
  if (typeof error === 'string') return error;
  if (error?.result?.error?.message) return error.result.error.message;
  if (error?.message) return error.message;
  return fallback;
};

function serializeShiftForRow(shift) {
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

        function deserializeShiftRow(rowIndex, rowValues) {
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

        function applyLocalShift(records, shiftRecord) {
            const next = Array.isArray(records) ? [...records] : [];
            const index = next.findIndex((item) => item.id === shiftRecord.id);
            if (index >= 0) {
                next[index] = shiftRecord;
            } else {
                next.push(shiftRecord);
            }
            return next;
        }

        function removeLocalShift(records, shiftId) {
            return (records || []).filter((item) => item.id !== shiftId);
        }

        function estimateRowIndex(records, shiftId) {
            const record = (records || []).find((item) => item.id === shiftId);
            return record?.rowIndex || null;
        }

        // Main App Component
        function App() {
            const [view, setView] = useState(VIEW_MODES.DASHBOARD);
            const [shifts, setShifts] = useState(() => loadCachedShifts() || []);
            const [currentShift, setCurrentShift] = useState(null);
            const [isAuthenticated, setIsAuthenticated] = useState(false);
            const [authSession, setAuthSession] = useState(() => loadStoredAuthToken());
            const authSessionRef = useRef(authSession);
            const coworkerSheetMetaRef = useRef({ ensured: false, sheetId: null });
            const [config, setConfig] = useState({
                clientId: '',
                apiKey: '',
                spreadsheetId: '',
                sheetName: 'Shifts',
            });
            const [showConfig, setShowConfig] = useState(true);
              const [loading, setLoading] = useState(false);
              const [error, setError] = useState(null);
              const [serverStatus, setServerStatus] = useState({
                  state: 'checking',
                  message: `Ensuring local server is running on port ${APP_SERVER_PORT}...`,
              });
            const [coworkerDirectory, setCoworkerDirectory] = useState([]);
            const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

            useEffect(() => {
                if (view === VIEW_MODES.SHIFT_CREATE || view === VIEW_MODES.SHIFT_EDIT) {
                    setSidebarCollapsed(true);
                } else if (view === VIEW_MODES.DASHBOARD || view === VIEW_MODES.SHIFT_DETAIL) {
                    setSidebarCollapsed(false);
                }
            }, [view]);

            useEffect(() => {
                authSessionRef.current = authSession;
            }, [authSession]);

            const handleTokenEvent = useCallback(
                (tokenInfo) => {
                    if (!tokenInfo || !tokenInfo.access_token) return;
                    const expiresIn = Number(tokenInfo.expires_in || tokenInfo.expiresIn || 3600);
                    const computedExpiry = Number.isFinite(expiresIn)
                        ? Date.now() + expiresIn * 1000
                        : Date.now() + 3600 * 1000;
                    const expiresAt = tokenInfo.expires_at || computedExpiry;
                    const session = {
                        accessToken: tokenInfo.access_token,
                        expiresAt,
                        scope: tokenInfo.scope || SCOPES,
                    };
                    storeAuthToken(session);
                    setAuthSession(session);
                    setIsAuthenticated(true);
                },
                [setAuthSession, setIsAuthenticated]
            );

            useEffect(() => {
                sheetsAPI.setTokenListener(handleTokenEvent);
                return () => sheetsAPI.setTokenListener(null);
            }, [handleTokenEvent]);

            const refreshToken = useCallback(
                async (mode = 'silent') => {
                    if (!sheetsAPI || !sheetsAPI.tokenClient) {
                        return false;
                    }
                    if (mode === 'silent' && !isOnline()) {
                        return false;
                    }
                    try {
                        const success = await sheetsAPI.requestAccessToken({
                            prompt: mode === 'consent' ? 'consent' : '',
                        });
                        if (!success && mode === 'consent') {
                            clearStoredAuthToken();
                            setAuthSession(null);
                            setIsAuthenticated(false);
                        }
                        return success;
                    } catch (refreshError) {
                        console.warn('Token refresh failed', refreshError);
                        if (mode === 'consent') {
                            clearStoredAuthToken();
                            setAuthSession(null);
                            setIsAuthenticated(false);
                        }
                        return false;
                    }
                },
                [setAuthSession, setIsAuthenticated]
            );

          useEffect(() => {
                  let cancelled = false;

                  const bootServer = async () => {
                      if (typeof fetch === 'undefined') {
                          if (!cancelled) {
                              setServerStatus({
                                  state: 'error',
                                  message: 'Fetch API is unavailable; cannot communicate with the local control server.',
                              });
                          }
                          return;
                      }

                      setServerStatus((prev) => ({
                          state: 'checking',
                          message: prev.message || `Ensuring local server is running on port ${APP_SERVER_PORT}...`,
                      }));

                      const result = await ensureAppServerRunning();
                      if (cancelled) return;

                      if (result.ok) {
                          setServerStatus({ state: 'ready', message: '' });
                      } else {
                          const reason = result.error?.message || 'Control server is not reachable';
                            setServerStatus({
                                state: 'error',
                                message: `Could not auto-start the local server on port ${APP_SERVER_PORT}. ${reason}. Try running "node control-server.js" or "./start-server.sh ${APP_SERVER_PORT}" in a terminal, then refresh.`,
                            });
                      }
                  };

                  bootServer();

                  return () => {
                      cancelled = true;
                  };
              }, []);

            const initializeGoogleAPI = useCallback(
                async (cfg) => {
                    if (!cfg || !cfg.clientId || !cfg.apiKey) return;
                    try {
                        await sheetsAPI.initialize(cfg.clientId, cfg.apiKey);
                        console.log('Google API initialized');

                        const session = authSessionRef.current;
                        if (session?.accessToken) {
                            const stillValid =
                                !session.expiresAt || session.expiresAt > Date.now() + 30 * 1000;
                            if (stillValid) {
                                sheetsAPI.applySavedToken(session);
                                setIsAuthenticated(true);
                            } else if (isOnline()) {
                                await refreshToken('silent');
                            }
                        } else if (typeof gapi !== 'undefined' && gapi?.client?.getToken) {
                            const token = gapi.client.getToken();
                            if (token?.access_token) {
                                handleTokenEvent({
                                    access_token: token.access_token,
                                    expires_in: token.expires_in,
                                    scope: token.scope,
                                });
                            }
                        }
                    } catch (error) {
                        setError('Failed to initialize Google API: ' + error.message);
                    }
                },
                [refreshToken, handleTokenEvent]
            );

            // Load configuration from localStorage
            useEffect(() => {
                const savedConfig = localStorage.getItem(CONFIG_STORAGE_KEY);
                if (savedConfig) {
                    const parsed = JSON.parse(savedConfig);
                    setConfig(parsed);
                    if (parsed.clientId && parsed.apiKey) {
                        setShowConfig(false);
                        initializeGoogleAPI(parsed);
                    }
                }
            }, [initializeGoogleAPI]);

            const handleAuthenticate = async () => {
                setLoading(true);
                setError(null);
                try {
                    const success = await refreshToken('consent');
                    if (!success) {
                        setError('Authentication failed or was cancelled.');
                    }
                } catch (error) {
                    setError('Authentication error: ' + (error?.message || error));
                } finally {
                    setLoading(false);
                }
            };

            const saveConfig = () => {
                localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
                setShowConfig(false);
                initializeGoogleAPI(config);
            };

            // Attempt to load config from bundled config.json on first run
            useEffect(() => {
                if (localStorage.getItem(CONFIG_STORAGE_KEY)) return;
                if (typeof fetch === 'undefined') return;

                let cancelled = false;

                const fetchRemoteConfig = async () => {
                    try {
                        const response = await fetch(REMOTE_CONFIG_PATH, { cache: 'no-store' });
                        if (!response.ok) return;
                        const remote = await response.json();
                        if (cancelled || !remote) return;

                        let nextConfig = null;
                        setConfig((prev) => {
                            nextConfig = { ...prev, ...remote };
                            return nextConfig;
                        });

                        if (nextConfig) {
                            localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(nextConfig));
                        }

                        if (!cancelled && remote.clientId && remote.apiKey && nextConfig) {
                            setShowConfig(false);
                            initializeGoogleAPI(nextConfig);
                        }
                    } catch (error) {
                        console.warn('Optional config.json not loaded', error);
                    }
                };

                fetchRemoteConfig();

                return () => {
                    cancelled = true;
                };
            }, [initializeGoogleAPI]);

            useEffect(() => {
                if (!authSession?.accessToken) {
                    sheetsAPI.clearToken();
                    clearStoredAuthToken();
                    if (isAuthenticated) {
                        setIsAuthenticated(false);
                    }
                    return;
                }
            }, [authSession, isAuthenticated]);

            useEffect(() => {
                if (!authSession?.accessToken) return;
                if (authSession.expiresAt && authSession.expiresAt <= Date.now()) {
                    refreshToken('silent');
                    return;
                }
                if (!authSession.expiresAt) return;
                const msUntilExpiry = authSession.expiresAt - Date.now();
                if (msUntilExpiry <= 0) {
                    refreshToken('silent');
                    return;
                }
                const refreshDelay = Math.max(msUntilExpiry - 15 * 1000, 5 * 1000);
                const timer = setTimeout(() => {
                    refreshToken('silent');
                }, refreshDelay);
                return () => clearTimeout(timer);
            }, [authSession, refreshToken]);

            const loadShifts = useCallback(async () => {
                if (!config.spreadsheetId || !isAuthenticated) return;
                
                setLoading(true);
                setError(null);
                try {
                    const range = `${config.sheetName}!A2:F`;
                    const response = await sheetsAPI.readData(config.spreadsheetId, range);
                    const values = response || [];
                    const loadedShifts = values
                        .map((row, index) => deserializeShiftRow(index + 2, row))
                        .filter(Boolean);
                    setShifts(loadedShifts);
                    storeCachedShifts(loadedShifts);
                } catch (error) {
                    console.warn('Failed to fetch shifts from Sheets', error);
                    const cached = loadCachedShifts();
                    if (cached && cached.length) {
                        setShifts(cached);
                        setError('Offline mode: showing cached shifts.');
                    } else {
                        setError('Failed to load shifts: ' + error.message);
                    }
                } finally {
                    setLoading(false);
                }
            }, [config.sheetName, config.spreadsheetId, isAuthenticated]);

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
                        (sheet) => sheet.properties?.title === COWORKER_SHEET_NAME
                    );
                    if (existing) {
                        const sheetId = existing.properties?.sheetId ?? null;
                        coworkerSheetMetaRef.current = { ensured: true, sheetId };
                        return sheetId;
                    }
                } catch (error) {
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
                    const newSheetId =
                        addResponse.result?.replies?.[0]?.addSheet?.properties?.sheetId ?? null;
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
                } catch (error) {
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
                        .map((row, index) => {
                            const [
                                trappeId = '',
                                name = '',
                                firstName = '',
                                lastName = '',
                                positionsRaw = '',
                                managerRaw = '',
                            ] = row || [];
                            const rowIndex = index + 2;
                            const fallbackName = [firstName, lastName].filter(Boolean).join(' ');
                            const normalizedName = (name || fallbackName || '').trim();
                            if (!normalizedName) return null;
                            const positions = (positionsRaw || '')
                                .split(/[,/]/)
                                .map((token) => token.trim())
                                .filter(Boolean);
                            const positionsNormalized = positions.map((p) => p.toLowerCase());
                            const managerFlag = String(managerRaw || '').trim().toLowerCase();
                            const isManager = managerFlag === 'true' || managerFlag === 'yes' || managerFlag === '1';
                            const isSelf =
                                normalizedName.toLowerCase() === 'ian' ||
                                (firstName || '').trim().toLowerCase() === 'ian';
                            return {
                                rowIndex,
                                id: trappeId || `coworker_${index}`,
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
                    setError((prev) =>
                        prev && prev.toLowerCase().includes('coworker') ? null : prev
                    );
                } catch (directoryError) {
                    console.warn('Failed to load coworker directory', directoryError);
                    setCoworkerDirectory([]);
                    setError(getSheetsErrorMessage(directoryError, 'Failed to load coworker directory.'));
                }
            }, [config.spreadsheetId, ensureCoworkerSheetExists, isAuthenticated]);

            const coworkerRowRange = (rowIndex) => `${COWORKER_SHEET_NAME}!A${rowIndex}:F${rowIndex}`;

            const formatCoworkerForSheet = (draft) => {
                if (!draft) return null;
                const firstName = (draft.firstName || '').trim();
                const lastName = (draft.lastName || '').trim();
                const displayName = (draft.name || `${firstName} ${lastName}` || '').trim();
                const positions = Array.isArray(draft.positions)
                    ? draft.positions.filter(Boolean)
                    : [];
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

            const upsertCoworkerRecord = useCallback(
                async (draft) => {
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
                    } catch (error) {
                        throw new Error(getSheetsErrorMessage(error, 'Unable to save coworker.'));
                    }

                    await loadCoworkerDirectory();
                    return payload;
                },
                [config.spreadsheetId, ensureCoworkerSheetExists, isAuthenticated, loadCoworkerDirectory]
            );

            const deleteCoworkerRecord = useCallback(
                async (record) => {
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
                    } catch (error) {
                        throw new Error(getSheetsErrorMessage(error, 'Unable to delete coworker.'));
                    }

                    await loadCoworkerDirectory();
                },
                [config.spreadsheetId, ensureCoworkerSheetExists, isAuthenticated, loadCoworkerDirectory]
            );

            const syncingRef = useRef(false);

            const syncPendingShifts = useCallback(async () => {
                if (syncingRef.current) return;
                if (!config.spreadsheetId || !isAuthenticated || !isOnline()) return;
                const queue = loadPendingQueue();
                if (!queue.length) return;
                syncingRef.current = true;

                const sheetName = config.sheetName || 'Shifts';
                const updates = [];
                const clears = [];
                const inserts = [];

                queue.forEach((op) => {
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
                    const dataRequests = [];
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
            }, [config.sheetName, config.spreadsheetId, isAuthenticated, loadShifts]);

            useEffect(() => {
                if (!isAuthenticated || !config.spreadsheetId) return;
                loadShifts();
            }, [isAuthenticated, config.spreadsheetId, loadShifts]);

            useEffect(() => {
                if (!isAuthenticated || !config.spreadsheetId) return;
                loadCoworkerDirectory();
            }, [isAuthenticated, config.spreadsheetId, loadCoworkerDirectory]);

            useEffect(() => {
                syncPendingShifts();
            }, [syncPendingShifts]);

            useEffect(() => {
                const handleOnline = () => {
                    syncPendingShifts();
                    refreshToken('silent');
                };
                window.addEventListener('online', handleOnline);
                return () => {
                    window.removeEventListener('online', handleOnline);
                };
            }, [syncPendingShifts, refreshToken]);

            const saveShift = async (shiftData) => {
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
                setView(VIEW_MODES.DASHBOARD);

                if (!config.spreadsheetId || !isAuthenticated) return;

                setLoading(true);
                setError(null);
                try {
                    await syncPendingShifts();
                } finally {
                    setLoading(false);
                }
            };

            const deleteShift = async (shiftId) => {
                if (!confirm('Are you sure you want to delete this shift?')) return;
                
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
            };

            const startNewShift = useCallback(
                (seed = {}) => {
                    const normalizedSeed = normalizeShiftPayload(seed) || seed;
                    const draft = deepMergeShift(DEFAULT_SHIFT_TEMPLATE, normalizedSeed);
                    setCurrentShift(draft);
                    setView(VIEW_MODES.SHIFT_CREATE);
                },
                []
            );

            const startNewShiftForDate = useCallback(
                (dateKey) => {
                    if (!dateKey) {
                        startNewShift();
                        return;
                    }
                    startNewShift({ date: dateKey });
                },
                [startNewShift]
            );

            const editShift = (shift) => {
                setCurrentShift(shift.data);
                setView(VIEW_MODES.SHIFT_EDIT);
            };

            const viewShift = (shift) => {
                setCurrentShift(shift.data);
                setView(VIEW_MODES.SHIFT_VIEW);
            };

            const navItems = [
                { key: VIEW_MODES.DASHBOARD, label: 'Dashboard', icon: 'fa-chart-line' },
                { key: 'shift-new', label: 'Shift Entry', icon: 'fa-pen-to-square' },
                { key: VIEW_MODES.COWORKERS, label: 'Crew Database', icon: 'fa-users' },
            ];

            const activeNavKey = (() => {
                if (view === VIEW_MODES.COWORKERS) return VIEW_MODES.COWORKERS;
                if (view === VIEW_MODES.SHIFT_CREATE || view === VIEW_MODES.SHIFT_EDIT) return 'shift-new';
                if (view === VIEW_MODES.SHIFT_VIEW) return VIEW_MODES.DASHBOARD;
                return VIEW_MODES.DASHBOARD;
            })();

            const handleNavSelect = (key) => {
                if (key === 'shift-new') {
                    startNewShift({ date: new Date().toISOString().split('T')[0] });
                    return;
                }
                if (key === VIEW_MODES.DASHBOARD) {
                    setView(VIEW_MODES.DASHBOARD);
                    return;
                }
                if (key === VIEW_MODES.COWORKERS) {
                    setCurrentShift(null);
                    setView(VIEW_MODES.COWORKERS);
                }
            };

            return (
                <div className="min-h-screen flex">
                    <SidebarNav
                        items={navItems}
                        activeKey={activeNavKey}
                        onSelect={handleNavSelect}
                        collapsed={sidebarCollapsed}
                        onToggle={() => setSidebarCollapsed((prev) => !prev)}
                    />
                    <div className="flex-1 flex flex-col">
                        <MobileNav items={navItems} activeKey={activeNavKey} onSelect={handleNavSelect} />
                        <main className="flex-1 p-4 md:p-8">
                            <div className="max-w-7xl mx-auto">
                        {/* Header */}
                        <header className="glass rounded-2xl shadow-xl p-6 mb-6 animate-slide-in border border-slate-800/40">
                            <div className="flex items-center justify-between flex-wrap gap-4">
                                <div className="flex items-center gap-3">
                                    <div className="bg-gradient-to-br from-cyan-500 to-fuchsia-500 p-3 rounded-xl text-white text-2xl">
                                        <i className="fas fa-coins"></i>
                                    </div>
                                    <div>
                                        <h1 className="text-3xl font-bold text-slate-100">
                                            Bar Tracker
                                        </h1>
                                        <p className="text-slate-400 text-sm">Track your shifts, tips, and earnings</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                      {isAuthenticated && (
                                          <button
                                              onClick={() => startNewShift({ date: new Date().toISOString().split('T')[0] })}
                                              className="bg-gradient-to-r from-cyan-500 to-fuchsia-500 text-white px-6 py-2.5 rounded-xl hover:shadow-lg hover:shadow-cyan-500/30 transition-all duration-300 flex items-center gap-2"
                                          >
                                              <i className="fas fa-plus"></i>
                                              New Shift
                                          </button>
                                      )}
                                    <button
                                        onClick={() => setShowConfig(!showConfig)}
                                        className="bg-slate-900/70 text-slate-200 px-4 py-2.5 rounded-xl hover:bg-slate-800 transition-all duration-300 border border-slate-700"
                                    >
                                        <i className="fas fa-cog"></i>
                                    </button>
                                </div>
                            </div>
                        </header>

                        {serverStatus.state !== 'ready' && (
                            <div
                                className={`glass rounded-xl shadow-lg p-4 mb-6 border ${
                                    serverStatus.state === 'error'
                                        ? 'border-red-500/40 bg-red-500/10'
                                        : 'border-cyan-500/40 bg-cyan-500/10'
                                } animate-slide-in`}
                            >
                                <div className="flex items-start gap-3">
                                    <div
                                        className={`text-xl ${
                                            serverStatus.state === 'error'
                                                ? 'text-red-300'
                                                : 'text-cyan-300'
                                        }`}
                                    >
                                        <i
                                            className={`fas ${
                                                serverStatus.state === 'error'
                                                    ? 'fa-exclamation-triangle'
                                                    : 'fa-rocket'
                                            }`}
                                        ></i>
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm font-semibold text-slate-100">
                                            {serverStatus.state === 'error'
                                                ? 'Server Not Ready'
                                                : 'Starting Local Server'}
                                        </p>
                                        <p className="text-sm text-slate-300 mt-1">
                                            {serverStatus.message}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Error Alert */}
                        {error && (
                            <div className="glass rounded-xl p-4 mb-6 border border-red-500/30 bg-red-500/10 animate-slide-in">
                                <div className="flex items-center gap-3">
                                    <i className="fas fa-exclamation-triangle text-red-300 text-xl"></i>
                                    <div className="flex-1">
                                        <p className="text-red-200 font-medium">Error</p>
                                        <p className="text-red-300 text-sm">{error}</p>
                                    </div>
                                    <button onClick={() => setError(null)} className="text-red-300 hover:text-red-100">
                                        <i className="fas fa-times"></i>
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Configuration Panel */}
                        {showConfig && (
                            <ConfigPanel
                                config={config}
                                setConfig={setConfig}
                                saveConfig={saveConfig}
                                isAuthenticated={isAuthenticated}
                                handleAuthenticate={handleAuthenticate}
                                loading={loading}
                            />
                        )}

                        {/* Main Content */}
                        {!showConfig && isAuthenticated && (
                            <>
                                {view === VIEW_MODES.DASHBOARD && (
                                    <div className="space-y-6">
                                        <ShiftList
                                            shifts={shifts}
                                            onEdit={editShift}
                                            onDelete={deleteShift}
                                            onView={viewShift}
                                            onStartNew={startNewShiftForDate}
                                            loading={loading}
                                            onRefresh={loadShifts}
                                        />
                                        <ChartsPanel shifts={shifts} />
                                    </div>
                                )}
                                {view === VIEW_MODES.SHIFT_CREATE && (
                                    <ShiftForm
                                        shift={currentShift}
                                        onSave={saveShift}
                                        onCancel={() => setView(VIEW_MODES.DASHBOARD)}
                                        coworkerDirectory={coworkerDirectory}
                                    />
                                )}
                                {view === VIEW_MODES.SHIFT_EDIT && currentShift && (
                                    <ShiftForm
                                        shift={currentShift}
                                        onSave={saveShift}
                                        onCancel={() => setView(VIEW_MODES.DASHBOARD)}
                                        coworkerDirectory={coworkerDirectory}
                                    />
                                )}
                                {view === VIEW_MODES.SHIFT_VIEW && currentShift && (
                                    <ShiftDetail
                                        shift={currentShift}
                                        onEdit={() => setView(VIEW_MODES.SHIFT_EDIT)}
                                        onClose={() => setView(VIEW_MODES.DASHBOARD)}
                                    />
                                )}
                                {view === VIEW_MODES.COWORKERS && (
                                    <CoworkerDatabase
                                        records={coworkerDirectory}
                                        onCreate={upsertCoworkerRecord}
                                        onUpdate={upsertCoworkerRecord}
                                        onDelete={deleteCoworkerRecord}
                                        onRefresh={loadCoworkerDirectory}
                                        positions={CREW_POSITION_OPTIONS}
                                    />
                                )}
                            </>
                        )}

                        {/* Not Authenticated */}
                        {!showConfig && !isAuthenticated && (
                            <div className="glass rounded-2xl shadow-xl p-12 text-center animate-slide-in border border-slate-800/40">
                                <div className="bg-slate-900/70 w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center">
                                    <i className="fas fa-lock text-4xl text-slate-200"></i>
                                </div>
                                <h2 className="text-2xl font-bold text-slate-100 mb-3">Authentication Required</h2>
                                <p className="text-slate-400 mb-6">Connect to Google Sheets to start tracking your shifts</p>
                                <button
                                    onClick={handleAuthenticate}
                                    disabled={loading}
                                    className="bg-gradient-to-r from-cyan-500 to-fuchsia-500 text-white px-8 py-3 rounded-xl hover:shadow-lg hover:shadow-cyan-500/30 transition-all duration-300 disabled:opacity-50"
                                >
                                    {loading ? 'Connecting...' : 'Connect Google Sheets'}
                                </button>
                            </div>
                        )}
                            </div>
                        </main>
                    </div>
                </div>
            );
        }

        function SidebarNav({ items, activeKey, onSelect, collapsed = false, onToggle }) {
            if (!items?.length) return null;
            const widthClass = collapsed ? 'lg:w-20' : 'lg:w-64';
            const headerPadding = collapsed ? 'px-4' : 'px-6';
            const navPadding = collapsed ? 'px-2' : 'px-4';
            return (
                <aside
                    className={`hidden lg:flex ${widthClass} flex-col bg-slate-950/80 border-r border-slate-800/60 transition-all duration-300`}
                >
                    <div
                        className={`${headerPadding} py-6 border-b border-slate-800/60 flex items-center justify-between gap-3`}
                    >
                        <div className={`flex items-center ${collapsed ? 'justify-center w-full' : 'gap-3'} transition-all duration-300`}>
                            <div className="bg-gradient-to-br from-cyan-500 to-fuchsia-500 p-3 rounded-xl text-white text-2xl">
                                <i className="fas fa-coins"></i>
                            </div>
                            {!collapsed && (
                                <div>
                                    <p className="text-sm uppercase tracking-widest text-slate-500">Bar Tracker</p>
                                    <h2 className="text-xl font-semibold text-slate-100">Tracker</h2>
                                </div>
                            )}
                        </div>
                        <button
                            type="button"
                            onClick={() => onToggle && onToggle()}
                            className="text-slate-400 hover:text-white bg-slate-900/60 hover:bg-slate-900 border border-slate-700 rounded-lg p-2 transition"
                            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                        >
                            <i className={`fas ${collapsed ? 'fa-angles-right' : 'fa-angles-left'}`}></i>
                        </button>
                    </div>
                    <nav className={`flex-1 ${navPadding} py-6 space-y-2 overflow-y-auto`}>
                        {items.map((item) => {
                            const isActive = item.key === activeKey;
                            return (
                                <button
                                    key={item.key}
                                    onClick={() => onSelect(item.key)}
                                    title={item.label}
                                    className={`w-full flex items-center ${
                                        collapsed ? 'justify-center px-0' : 'justify-start px-4 gap-3'
                                    } py-3 rounded-xl text-sm transition ${
                                        isActive
                                            ? 'bg-gradient-to-r from-cyan-500/70 via-fuchsia-500/60 to-fuchsia-500/80 text-white shadow-lg shadow-cyan-500/20'
                                            : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                                    }`}
                                >
                                    <i className={`fas ${item.icon}`}></i>
                                    <span className={collapsed ? 'sr-only' : ''}>{item.label}</span>
                                </button>
                            );
                        })}
                    </nav>
                </aside>
            );
        }

        function MobileNav({ items, activeKey, onSelect }) {
            if (!items?.length) return null;
            return (
                <div className="lg:hidden px-4 pt-4">
                    <div className="glass rounded-2xl border border-slate-800/40 p-4 shadow-lg shadow-slate-950/30">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-slate-100">
                                <div className="bg-gradient-to-br from-cyan-500 to-fuchsia-500 p-2 rounded-lg text-white">
                                    <i className="fas fa-coins"></i>
                                </div>
                                <div>
                                    <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Bar Tracker</p>
                                    <p className="font-semibold">Tracker</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {items.map((item) => {
                                    const isActive = item.key === activeKey;
                                    return (
                                        <button
                                            key={item.key}
                                            onClick={() => onSelect(item.key)}
                                            className={`px-3 py-2 rounded-xl text-xs font-medium tracking-wide transition ${
                                                isActive
                                                    ? 'bg-gradient-to-r from-cyan-500 to-fuchsia-500 text-white shadow-sm shadow-cyan-500/30'
                                                    : 'bg-slate-900/70 text-slate-300 border border-slate-800 hover:text-white'
                                            }`}
                                        >
                                            {item.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            );
        }

        // Configuration Panel Component
        function ConfigPanel({ config, setConfig, saveConfig, isAuthenticated, handleAuthenticate, loading }) {
            return (
                <div className="glass rounded-2xl shadow-xl p-6 mb-6 animate-slide-in border border-slate-800/40">
                    <h2 className="text-2xl font-bold text-slate-100 mb-4 flex items-center gap-2">
                        <i className="fas fa-cog text-cyan-300"></i>
                        Configuration
                    </h2>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                Google Client ID
                            </label>
                            <input
                                type="text"
                                value={config.clientId}
                                onChange={(e) => setConfig({ ...config, clientId: e.target.value })}
                                className="w-full px-4 py-2 bg-slate-900/70 border border-slate-700 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-slate-100"
                                placeholder="Your Google OAuth Client ID"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                Google API Key
                            </label>
                            <input
                                type="text"
                                value={config.apiKey}
                                onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
                                className="w-full px-4 py-2 bg-slate-900/70 border border-slate-700 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-slate-100"
                                placeholder="Your Google API Key"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                Spreadsheet ID
                            </label>
                            <input
                                type="text"
                                value={config.spreadsheetId}
                                onChange={(e) => setConfig({ ...config, spreadsheetId: e.target.value })}
                                className="w-full px-4 py-2 bg-slate-900/70 border border-slate-700 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-slate-100"
                                placeholder="Google Sheets ID from URL"
                            />
                            <p className="text-xs text-slate-500 mt-1">
                                Found in the URL: docs.google.com/spreadsheets/d/<span className="font-mono">SPREADSHEET_ID</span>/edit
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                Sheet Name
                            </label>
                            <input
                                type="text"
                                value={config.sheetName}
                                onChange={(e) => setConfig({ ...config, sheetName: e.target.value })}
                                className="w-full px-4 py-2 bg-slate-900/70 border border-slate-700 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-slate-100"
                                placeholder="Shifts"
                            />
                        </div>

                        <div className="flex gap-3 pt-4">
                            <button
                                onClick={saveConfig}
                                className="flex-1 bg-gradient-to-r from-cyan-500 to-fuchsia-500 text-white px-6 py-2.5 rounded-xl hover:shadow-lg hover:shadow-cyan-500/30 transition-all duration-300"
                            >
                                Save Configuration
                            </button>
                            {!isAuthenticated && config.clientId && config.apiKey && (
                                <button
                                    onClick={handleAuthenticate}
                                    disabled={loading}
                                    className="flex-1 bg-emerald-500 text-white px-6 py-2.5 rounded-xl hover:bg-emerald-600 transition-all duration-300 disabled:opacity-50"
                                >
                                    {loading ? 'Connecting...' : 'Authenticate'}
                                </button>
                            )}
                        </div>

                        <div className="bg-slate-900/70 border border-slate-700 rounded-xl p-4 mt-4">
                            <h3 className="font-semibold text-slate-100 mb-2 flex items-center gap-2">
                                <i className="fas fa-info-circle text-cyan-300"></i>
                                Setup Instructions
                            </h3>
                            <ol className="text-sm text-slate-400 space-y-1 list-decimal list-inside">
                                <li>Create a Google Cloud Project</li>
                                <li>Enable Google Sheets API</li>
                                <li>Create OAuth 2.0 credentials (Web application)</li>
                                <li>Add authorized JavaScript origin: your domain</li>
                                <li>Create an API Key with Sheets API access</li>
                                <li>Create a Google Sheet with columns: ID, JSON Data</li>
                                <li>Copy the Spreadsheet ID from the URL</li>
                            </ol>
                        </div>
                    </div>
                </div>
            );
        }

        function CoworkerDatabase({ records = [], onCreate, onUpdate, onDelete, onRefresh, positions = [] }) {
            const [filter, setFilter] = useState('');
            const [editingKey, setEditingKey] = useState(null);
            const [draft, setDraft] = useState({
                rowIndex: null,
                id: '',
                name: '',
                firstName: '',
                lastName: '',
                positions: [],
                isManager: false,
            });
            const [saving, setSaving] = useState(false);
            const [message, setMessage] = useState(null);

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

            const positionsList = positions.length ? positions : CREW_POSITION_OPTIONS;

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

            const handleStartEdit = (record) => {
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

            const handleDraftChange = (field, value) => {
                setDraft((prev) => ({
                    ...prev,
                    [field]: value,
                }));
            };

            const togglePosition = (position) => {
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
                } catch (error) {
                    setMessage({ type: 'error', text: error?.message || 'Unable to save coworker.' });
                } finally {
                    setSaving(false);
                }
            };

            const handleDelete = async (record) => {
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
                } catch (error) {
                    setMessage({ type: 'error', text: error?.message || 'Unable to delete coworker.' });
                } finally {
                    setSaving(false);
                }
            };

            const renderPositionsBadges = (record) => {
                const list = Array.isArray(record.positions) ? record.positions : [];
                if (!list.length) {
                    return <span className="text-xs text-slate-500">—</span>;
                }
                return (
                    <div className="flex flex-wrap gap-2">
                        {list.map((pos) => (
                            <span
                                key={pos}
                                className="badge-pill bg-slate-800 text-slate-200 border border-slate-700"
                            >
                                {pos}
                            </span>
                        ))}
                    </div>
                );
            };

            const renderEditRow = (isNew) => (
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
                        <input
                            type="text"
                            value={draft.firstName}
                            onChange={(e) => handleDraftChange('firstName', e.target.value)}
                            className="w-full px-3 py-2 bg-slate-900/70 border border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
                            placeholder="First"
                            disabled={saving}
                        />
                    </td>
                    <td className="px-3 py-3 align-top">
                        <input
                            type="text"
                            value={draft.lastName}
                            onChange={(e) => handleDraftChange('lastName', e.target.value)}
                            className="w-full px-3 py-2 bg-slate-900/70 border border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
                            placeholder="Last"
                            disabled={saving}
                        />
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
                                Manage the roster synced to the <code>Coworkers</code> sheet. This tab will be created automatically if it is missing.
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
                                    <th className="px-3 py-2 font-medium">Display Name</th>
                                    <th className="px-3 py-2 font-medium">First</th>
                                    <th className="px-3 py-2 font-medium">Last</th>
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
                                        return (
                                            <React.Fragment key={key}>
                                                {renderEditRow(false)}
                                            </React.Fragment>
                                        );
                                    }
                                    return (
                                        <tr key={key} className="hover:bg-slate-900/40 transition">
                                            <td className="px-3 py-3 text-slate-300">{record.id || <span className="text-xs text-slate-500">—</span>}</td>
                                            <td className="px-3 py-3 text-slate-100 font-medium flex items-center gap-2">
                                                {record.name || <span className="text-xs text-slate-500">Unnamed</span>}
                                                {record.isSelf && (
                                                    <span className="badge-pill bg-cyan-500/30 text-cyan-100 border border-cyan-400/40">You</span>
                                                )}
                                            </td>
                                            <td className="px-3 py-3 text-slate-300">{record.firstName || <span className="text-xs text-slate-500">—</span>}</td>
                                            <td className="px-3 py-3 text-slate-300">{record.lastName || <span className="text-xs text-slate-500">—</span>}</td>
                                            <td className="px-3 py-3">{renderPositionsBadges(record)}</td>
                                            <td className="px-3 py-3 text-center">
                                                {record.isManager ? (
                                                    <span className="badge-pill bg-amber-500/20 text-amber-100 border border-amber-400/40">Manager</span>
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
                                        <td colSpan={7} className="px-3 py-6 text-center text-slate-500">
                                            No coworkers match your search.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            );
        }

        function MonthlyCalendar({ shifts, onSelectDay }) {
            const [activeMonth, setActiveMonth] = useState(() => {
                const now = new Date();
                return new Date(now.getFullYear(), now.getMonth(), 1);
            });

            const shiftByDate = useMemo(() => {
                const map = new Map();
                shifts.forEach((shift) => {
                    const dateKey = shift.data?.date;
                    if (!dateKey) return;
                    if (!map.has(dateKey)) {
                        map.set(dateKey, []);
                    }
                    map.get(dateKey).push(shift);
                });
                return map;
            }, [shifts]);

            const monthLabel = activeMonth.toLocaleDateString('en-US', {
                month: 'long',
                year: 'numeric',
            });

            const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

            const calendarCells = useMemo(() => {
                const cells = [];
                const year = activeMonth.getFullYear();
                const month = activeMonth.getMonth();
                const firstDay = new Date(year, month, 1);
                const lastDay = new Date(year, month + 1, 0);

                const leadingPad = firstDay.getDay();
                const totalDays = lastDay.getDate();
                const totalCells = Math.ceil((leadingPad + totalDays) / 7) * 7;

                for (let i = 0; i < leadingPad; i += 1) {
                    const date = new Date(year, month, i - leadingPad + 1);
                    cells.push({ type: 'pad', date });
                }

                for (let day = 1; day <= totalDays; day += 1) {
                    const date = new Date(year, month, day);
                    const dateKey = date.toISOString().split('T')[0];
                    const shiftsForDay = shiftByDate.get(dateKey) || [];
                    cells.push({
                        type: 'day',
                        date,
                        dateKey,
                        shifts: shiftsForDay,
                    });
                }

                const trailingNeeded = totalCells - cells.length;
                for (let i = 1; i <= trailingNeeded; i += 1) {
                    const date = new Date(year, month + 1, i);
                    cells.push({ type: 'pad', date });
                }

                return cells;
            }, [activeMonth, shiftByDate]);

            const goToMonth = (offset) => {
                setActiveMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + offset, 1));
            };

            const isToday = (date) => {
                const today = new Date();
                return (
                    date.getFullYear() === today.getFullYear() &&
                    date.getMonth() === today.getMonth() &&
                    date.getDate() === today.getDate()
                );
            };

            const formatCurrencyCompact = (amount) => {
                const value = Number(amount || 0);
                if (Math.abs(value) >= 1000) {
                    return `$${(value / 1000).toFixed(1)}k`;
                }
                if (Math.abs(value) >= 100) {
                    return `$${value.toFixed(0)}`;
                }
                return `$${value.toFixed(2)}`;
            };

            return (
                <div className="glass rounded-xl shadow-lg p-4 border border-slate-800/40">
                    <div className="flex items-center justify-between mb-3">
                        <div>
                            <h3 className="text-sm font-semibold text-slate-100">Shift Calendar</h3>
                            <p className="text-xs text-slate-400">{monthLabel}</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => goToMonth(-1)}
                                className="px-2 py-1 rounded-lg border border-slate-700 text-slate-300 hover:border-cyan-500 text-xs"
                                aria-label="Previous month"
                            >
                                <i className="fas fa-chevron-left"></i>
                            </button>
                            <button
                                type="button"
                                onClick={() => goToMonth(1)}
                                className="px-2 py-1 rounded-lg border border-slate-700 text-slate-300 hover:border-cyan-500 text-xs"
                                aria-label="Next month"
                            >
                                <i className="fas fa-chevron-right"></i>
                            </button>
                        </div>
                    </div>
                    <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-slate-400 mb-2">
                        {daysOfWeek.map((day) => (
                            <div key={day} className="uppercase tracking-wide">
                                {day}
                            </div>
                        ))}
                    </div>
                    <div className="grid grid-cols-7 gap-2 text-center">
                        {calendarCells.map((cell, index) => {
                            if (cell.type === 'pad') {
                                return <div key={`pad-${index}`} className="aspect-square rounded-xl bg-slate-900/40 border border-slate-900/60"></div>;
                            }
                            const shift = cell.shifts[0];
                            const hasShift = !!shift;
                            const earnings = Number(shift?.data?.earnings?.total ?? 0);
                            const hours = Number(shift?.data?.summary?.hours ?? 0);
                            const hourly = hours > 0 ? earnings / hours : 0;
                            const dateLabel = cell.date.toLocaleDateString('en-US', {
                                weekday: 'long',
                                month: 'long',
                                day: 'numeric',
                                year: 'numeric',
                            });
                            const tooltip = hasShift
                                ? `${dateLabel}\nEarnings: $${earnings.toFixed(2)}\nHours: ${hours.toFixed(2)}`
                                : `${dateLabel}\nClick to add a shift`;

                            return (
                                <button
                                    key={cell.dateKey}
                                    type="button"
                                    onClick={() => onSelectDay && onSelectDay(cell.dateKey, shift || null)}
                                    title={tooltip}
                                    className={`aspect-square rounded-xl border text-left text-xs transition relative overflow-hidden group p-2
                                        ${
                                            hasShift
                                                ? 'bg-cyan-500/15 border-cyan-400/40 text-cyan-100 hover:bg-cyan-500/25'
                                                : 'bg-slate-900/50 border-slate-800/60 text-slate-300 hover:border-cyan-500/30'
                                        }
                                        ${isToday(cell.date) ? 'ring-1 ring-cyan-400/60' : ''}`}
                                >
                                    <div className="text-[11px] uppercase tracking-wide text-slate-400">
                                        {cell.date.getDate()}
                                    </div>
                                    <div className="mt-2 space-y-1">
                                        <div className="text-base font-semibold text-slate-100">
                                            {hasShift ? formatCurrencyCompact(earnings) : <span className="text-slate-500">—</span>}
                                        </div>
                                        <div className="text-[11px] text-slate-400 leading-tight">
                                            {hasShift ? `${hours.toFixed(1)}h · $${hourly.toFixed(2)}/h` : 'Tap to add'}
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            );
        }

        // Shift List Component
        function ShiftList({ shifts, onEdit, onDelete, onView, onStartNew, loading, onRefresh }) {
            const [valueMode, setValueMode] = useState('tips'); // tips | earnings

            const sortedShifts = useMemo(() => {
                return [...shifts].sort((a, b) => new Date(b.data.date) - new Date(a.data.date)).slice(0, 20);
            }, [shifts]);

            const handleCalendarSelect = useCallback(
                (dateKey, shiftForDay) => {
                    if (shiftForDay && onEdit) {
                        onEdit(shiftForDay);
                    } else if (onStartNew) {
                        onStartNew(dateKey);
                    }
                },
                [onEdit, onStartNew]
            );

            const formatDisplayDate = (dateString) => {
                if (!dateString) return { label: '—', sublabel: '' };
                const date = new Date(dateString);
                if (Number.isNaN(date.getTime())) {
                    return { label: dateString, sublabel: '' };
                }
                const label = date.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                });
                const sublabel = date.toLocaleDateString('en-US', {
                    weekday: 'long',
                });
                const full = date.toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                });
                return { label: label.toUpperCase(), sublabel, full };
            };

            const shiftTypeIcons = {
                day: 'fa-sun',
                night: 'fa-moon',
                double: 'fa-circle-half-stroke',
            };

            const formatCurrency = (value) => {
                const amount = Number(value || 0);
                return `$${amount.toFixed(2)}`;
            };

            const summarizeEarnings = (earnings) => {
                if (!earnings || typeof earnings !== 'object') return 'Tips';
                const toNumber = (value) => {
                    const numeric = Number(value || 0);
                    return Number.isNaN(numeric) ? 0 : numeric;
                };
                const parts = [];
                const tipsTotal = toNumber(earnings?.tips?.total ?? earnings?.tips?.tipOut ?? earnings.tipOut);
                const wageTotal = toNumber(earnings?.wage?.total ?? earnings?.wage);
                const wageOvertime = toNumber(earnings?.wage?.overtime ?? earnings?.overtime);
                const wageDifferential = toNumber(earnings?.wage?.differential?.total);
                const supplementTotal = toNumber(earnings?.supplement?.total ?? earnings?.supplement);

                if (tipsTotal > 0) parts.push('Tips');
                if (wageTotal > 0) parts.push('Wage');
                if (wageDifferential > 0) parts.push('Differential');
                if (wageOvertime > 0) parts.push('Overtime');
                if (supplementTotal > 0) parts.push('Supplement');

                return parts.length ? parts.join(' + ') : 'Earnings';
            };

            const getPartySummary = (shift) => {
                const parties = Object.values(shift.data.parties || {});
                if (!parties.length) return { label: 'Parties', tooltip: 'No parties logged' };
                const tooltip = parties
                    .map((party) => {
                        const name = party.name || 'Party';
                        const start = formatTimeDisplay(party.time?.start) || '--';
                        const end = formatTimeDisplay(party.time?.end) || '--';
                        return `${name} (${start} – ${end})`;
                    })
                    .join('\n');
                return { label: `${parties.length} party${parties.length > 1 ? 'ies' : ''}`, tooltip };
            };

            return (
                <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] gap-6 animate-slide-in">
                    <MonthlyCalendar shifts={shifts} onSelectDay={handleCalendarSelect} />

                    <div className="glass rounded-xl shadow-lg border border-slate-800/40">
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/50 px-4 py-3">
                            <div>
                                <h3 className="text-sm font-semibold text-slate-100">Recent Shifts</h3>
                                <p className="text-xs text-slate-400">Last 20 entries</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="flex items-center gap-1 bg-slate-900/60 border border-slate-700 rounded-lg p-1">
                                    {['tips', 'earnings'].map((mode) => (
                                        <button
                                            key={mode}
                                            type="button"
                                            onClick={() => setValueMode(mode)}
                                            className={`px-2.5 py-1 text-xs rounded-md transition ${
                                                valueMode === mode
                                                    ? 'bg-cyan-500/30 text-cyan-100 border border-cyan-400/40'
                                                    : 'text-slate-400 hover:text-slate-200'
                                            }`}
                                        >
                                            {mode === 'tips' ? 'Tips' : 'Earnings'}
                                        </button>
                                    ))}
                                </div>
                                <button
                                    type="button"
                                    onClick={onRefresh}
                                    disabled={loading}
                                    className="h-8 w-8 flex items-center justify-center rounded-lg border border-slate-700 text-slate-300 hover:border-cyan-500/40 disabled:opacity-50"
                                    title="Refresh shifts"
                                >
                                      <i className={`fas ${loading ? 'fa-spinner fa-spin' : 'fa-rotate-right'}`}></i>
                                </button>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-slate-800/70 text-sm">
                                <thead className="bg-slate-900/60 text-slate-400 uppercase tracking-widest text-[11px]">
                                    <tr>
                                        <th className="px-4 py-3 text-left font-semibold">Date</th>
                                        <th className="px-4 py-3 text-left font-semibold">Hours</th>
                                        <th className="px-4 py-3 text-left font-semibold">Parties</th>
                                        <th className="px-4 py-3 text-left font-semibold">{valueMode === 'tips' ? 'Tips' : 'Earnings'}</th>
                                        <th className="px-4 py-3 text-left font-semibold">{valueMode === 'tips' ? 'Tips / Hour' : 'Rate'}</th>
                                        <th className="px-4 py-3 text-right font-semibold">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/70">
                                    {sortedShifts.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                                                No shifts recorded yet.
                                            </td>
                                        </tr>
                                    ) : (
                                        sortedShifts.map((shift) => {
                                            const dateInfo = formatDisplayDate(shift.data.date);
                                            const hours = Number(shift.data.summary?.hours ?? 0);
                                            const baseStart = formatTimeDisplay(shift.data.time?.base?.start) || '--';
                                            const baseEnd = formatTimeDisplay(shift.data.time?.base?.end) || '--';
                                            const clockStart = formatTimeDisplay(shift.data.wage?.clock?.start) || '--';
                                            const clockEnd = formatTimeDisplay(shift.data.wage?.clock?.end) || '--';
                                            const tipHours = Number(shift.data.time?.tips?.hours ?? shift.data.summary?.hours ?? 0);
                                            const earningsTotal = Number(shift.data.earnings?.total ?? 0);
                                            const rawTips = shift.data.tips?._total;
                                            const tipsTotal = Number(
                                                rawTips !== undefined && rawTips !== '' ? rawTips : shift.data.earnings?.tips ?? 0
                                            );
                                            const value = valueMode === 'tips' ? tipsTotal : earningsTotal;
                                            const rate = hours > 0 ? value / hours : 0;
                                            const shiftType = shift.data.type || 'unknown';
                                            const shiftIcon = shiftTypeIcons[shiftType] || 'fa-circle';
                                            const partySummary = getPartySummary(shift);
                                            const hoursTooltip = [
                                                `Shift: ${hours.toFixed(2)}h (${baseStart} → ${baseEnd})`,
                                                `Clock: ${clockStart} → ${clockEnd}`,
                                                `Tip hours: ${tipHours.toFixed(2)}h`,
                                            ].join('\n');
                                            const breakdown = valueMode === 'tips' ? 'Reported tips' : summarizeEarnings(shift.data.earnings);

                                            return (
                                                <tr
                                                    key={shift.id}
                                                    className="hover:bg-slate-900/40 transition cursor-pointer"
                                                    onClick={() => onView && onView(shift)}
                                                >
                                                    <td className="px-4 py-3 whitespace-nowrap">
                                                        <div className="text-[10px] text-slate-500">
                                                            {dateInfo.full || shift.data.date || '—'}
                                                        </div>
                                                        <div className="mt-1 text-sm font-semibold text-slate-100 flex items-center gap-2">
                                                            {dateInfo.label}
                                                            <span
                                                                className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-900/70 border border-slate-700 text-[11px] text-slate-300"
                                                                title={shift.data.type ? `${shift.data.type} shift` : 'Shift type not set'}
                                                            >
                                                                <i className={`fas ${shiftIcon}`}></i>
                                                            </span>
                                                        </div>
                                                        <div className="text-xs text-slate-500">{dateInfo.sublabel}</div>
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap">
                                                        <div className="text-sm font-semibold text-slate-100" title={hoursTooltip}>
                                                            {hours.toFixed(1)}h
                                                        </div>
                                                        <div className="text-xs text-slate-500">{`${baseStart} → ${baseEnd}`}</div>
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap">
                                                        <div className="text-xs uppercase tracking-wide text-slate-500">Parties</div>
                                                        <div
                                                            className="mt-1 inline-flex items-center gap-1 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-2 py-0.5 text-xs text-cyan-100"
                                                            title={partySummary.tooltip}
                                                        >
                                                            <i className="fas fa-champagne-glasses"></i>
                                                            {partySummary.label}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap">
                                                        <div className="text-xs uppercase tracking-wide text-slate-500">{breakdown}</div>
                                                        <div className="text-sm font-semibold text-slate-100">
                                                            {formatCurrency(value)}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap">
                                                        <div className="text-xs uppercase tracking-wide text-slate-500">
                                                            {valueMode === 'tips' ? 'Tips ÷ Hours' : 'Value ÷ Hours'}
                                                        </div>
                                                        <div className="text-sm font-semibold text-slate-100">
                                                            {hours > 0 ? formatCurrency(rate) : '$0.00'}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap">
                                                        <div className="flex justify-end items-center gap-2 text-slate-300">
                                                            <button
                                                                type="button"
                                                                className="h-8 w-8 flex items-center justify-center rounded-lg border border-slate-700 hover:border-cyan-500/40"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    onView && onView(shift);
                                                                }}
                                                                title={`View ${dateInfo.full || shift.data.date}`}
                                                            >
                                                                <i className="fas fa-eye text-xs"></i>
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className="h-8 w-8 flex items-center justify-center rounded-lg border border-slate-700 hover:border-cyan-500/40"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    onEdit && onEdit(shift);
                                                                }}
                                                                title="Edit shift"
                                                            >
                                                                <i className="fas fa-pen text-xs"></i>
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className="h-8 w-8 flex items-center justify-center rounded-lg border border-rose-500/40 text-rose-300 hover:bg-rose-500/20"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    onDelete && onDelete(shift.id);
                                                                }}
                                                                title="Delete shift"
                                                            >
                                                                <i className="fas fa-trash text-xs"></i>
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
                </div>
            );
        }

        function ChartsPanel({ shifts }) {
            const lineRef = useRef(null);
            const lineChartRef = useRef(null);
            const barRef = useRef(null);
            const barChartRef = useRef(null);
            const [chartSpan, setChartSpan] = useState(14);

            const spanOptions = [7, 14, 30, 60];

            const recentShifts = useMemo(() => {
                const sorted = [...shifts].sort((a, b) => new Date(a.data.date) - new Date(b.data.date));
                return sorted.slice(-chartSpan);
            }, [shifts, chartSpan]);

            useEffect(() => {
                if (!lineRef.current) return;

                const labels = recentShifts.map((shift) => new Date(shift.data.date).toLocaleDateString());
                const hourlySeries = recentShifts.map((shift) => shift.data.summary?.hourly || 0);
                const tipsPerHourSeries = recentShifts.map((shift) => shift.data.summary?.tips?.actual?.perHour || 0);

                const ctx = lineRef.current.getContext('2d');
                if (lineChartRef.current) {
                    lineChartRef.current.destroy();
                }
                lineChartRef.current = new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels,
                        datasets: [
                            {
                                label: 'Hourly Earnings',
                                data: hourlySeries,
                                borderColor: '#22d3ee',
                                backgroundColor: 'rgba(34, 211, 238, 0.15)',
                                tension: 0.35,
                                fill: true,
                            },
                            {
                                label: 'Tips per Hour',
                                data: tipsPerHourSeries,
                                borderColor: '#c084fc',
                                backgroundColor: 'rgba(192, 132, 252, 0.15)',
                                tension: 0.35,
                                fill: true,
                            },
                        ],
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: {
                            x: {
                                ticks: { color: '#94a3b8' },
                                grid: { color: 'rgba(148, 163, 184, 0.2)' },
                            },
                            y: {
                                ticks: { color: '#94a3b8' },
                                grid: { color: 'rgba(148, 163, 184, 0.2)' },
                                beginAtZero: true,
                            },
                        },
                        plugins: {
                            legend: {
                                labels: { color: '#e2e8f0' },
                            },
                            tooltip: {
                                backgroundColor: '#0f172a',
                                borderColor: '#22d3ee',
                                borderWidth: 1,
                            },
                        },
                    },
                });

                return () => {
                    if (lineChartRef.current) {
                        lineChartRef.current.destroy();
                        lineChartRef.current = null;
                    }
                };
            }, [recentShifts]);

            useEffect(() => {
                if (!barRef.current) return;

                const ctx = barRef.current.getContext('2d');
                if (barChartRef.current) {
                    barChartRef.current.destroy();
                }

                const extractTotals = (earnings = {}) => {
                    const toNumber = (value) => {
                        const numeric = Number(value || 0);
                        return Number.isNaN(numeric) ? 0 : numeric;
                    };
                    const tips =
                        toNumber(earnings?.tips?.total) ||
                        toNumber(earnings?.tips?.tipOut) + toNumber(earnings?.tips?.chumpChange) ||
                        toNumber(earnings.tips);
                    const wage =
                        toNumber(earnings?.wage?.total) ||
                        toNumber(earnings?.wage) ||
                        toNumber(earnings.wageBase);
                    const supplement =
                        toNumber(earnings?.supplement?.total) ||
                        toNumber(earnings?.supplement) ||
                        (toNumber(earnings?.supplement?.consideration) + toNumber(earnings?.supplement?.retention));

                    return {
                        tips,
                        wage,
                        supplement,
                    };
                };

                const recent = shifts.slice(-8);
                const earningsBars = recent.map((shift) => extractTotals(shift.data.earnings || {}));
                const barLabels = recent.map((shift) =>
                    new Date(shift.data.date).toLocaleDateString()
                );

                barChartRef.current = new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels: barLabels,
                        datasets: [
                            {
                                label: 'Tips',
                                data: earningsBars.map((earn) => earn.tips),
                                backgroundColor: 'rgba(34, 211, 238, 0.6)',
                            },
                            {
                                label: 'Wage',
                                data: earningsBars.map((earn) => earn.wage),
                                backgroundColor: 'rgba(192, 132, 252, 0.6)',
                            },
                            {
                                label: 'Supplement',
                                data: earningsBars.map((earn) => earn.supplement),
                                backgroundColor: 'rgba(74, 222, 128, 0.6)',
                            },
                        ],
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: {
                            x: {
                                stacked: true,
                                ticks: { color: '#94a3b8' },
                                grid: { color: 'rgba(148, 163, 184, 0.15)' },
                            },
                            y: {
                                stacked: true,
                                ticks: { color: '#94a3b8' },
                                grid: { color: 'rgba(148, 163, 184, 0.15)' },
                                beginAtZero: true,
                            },
                        },
                        plugins: {
                            legend: {
                                labels: { color: '#e2e8f0' },
                            },
                            tooltip: {
                                backgroundColor: '#0f172a',
                                borderColor: '#38bdf8',
                                borderWidth: 1,
                            },
                        },
                    },
                });

                return () => {
                    if (barChartRef.current) {
                        barChartRef.current.destroy();
                        barChartRef.current = null;
                    }
                };
            }, [shifts]);

            return (
                <div className="glass rounded-2xl shadow-xl p-6 border border-slate-800/40 space-y-6">
                    <div className="flex items-center justify-between flex-wrap gap-3">
                        <div>
                            <h3 className="text-lg font-semibold text-slate-100">Shift Analytics</h3>
                            <span className="text-xs uppercase tracking-widest text-slate-500">Last {recentShifts.length} Shifts</span>
                        </div>
                        <div className="flex items-center gap-2">
                            {spanOptions.map((option) => (
                                <button
                                    key={option}
                                    type="button"
                                    onClick={() => setChartSpan(option)}
                                    className={`text-xs px-3 py-1.5 rounded-lg border transition ${
                                        chartSpan === option
                                            ? 'border-cyan-400 bg-cyan-500/20 text-cyan-100'
                                            : 'border-slate-700 bg-slate-900/60 text-slate-400 hover:border-slate-500'
                                    }`}
                                >
                                    {option}d
                                </button>
                            ))}
                        </div>
                    </div>

                    {recentShifts.length === 0 ? (
                        <p className="text-sm text-slate-500">Add a few shifts to unlock charts.</p>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="bg-slate-900/60 border border-slate-800/60 rounded-2xl p-4 h-72">
                                <h4 className="text-sm text-slate-300 mb-3">Hourly Earnings vs Tips</h4>
                                <canvas ref={lineRef}></canvas>
                            </div>
                            <div className="bg-slate-900/60 border border-slate-800/60 rounded-2xl p-4 h-72">
                                <h4 className="text-sm text-slate-300 mb-3">Recent Earnings Breakdown</h4>
                                <canvas ref={barRef}></canvas>
                            </div>
                        </div>
                    )}
                </div>
            );
        }

        // Stat Card Component
        function StatCard({ icon, label, value, gradient }) {
            return (
                <div className="glass rounded-xl shadow-lg p-6 card-hover border border-slate-800/40">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">{label}</p>
                            <p className="text-2xl font-bold text-slate-100">{value}</p>
                        </div>
                        <div className={`bg-gradient-to-br ${gradient} p-3 rounded-lg text-white text-xl`}>
                            <i className={`fas ${icon}`}></i>
                        </div>
                    </div>
                </div>
            );
        }

        // Shift Card Component
        function ShiftCard({ shift, onView, onEdit, onDelete }) {
            const data = shift.data;

            const toNumber = (value) => {
                if (typeof value === 'number') return value;
                const num = parseFloat(value);
                return Number.isNaN(num) ? 0 : num;
            };

            const shiftLabel = data.type ? `${data.type.charAt(0).toUpperCase() + data.type.slice(1)} Shift` : 'Unassigned Shift';
            const typeMeta = SHIFT_TYPE_META[data.type] || SHIFT_TYPE_META.default;

            const handleHeaderClick = () => {
                if (onView) onView();
            };

            const hoverSummary = [
                `Total: $${toNumber(data.earnings?.total || 0).toFixed(2)}`,
                `Hours: ${toNumber(data.summary?.hours || 0).toFixed(1)}h`,
                `Tips: $${toNumber(data.tips?._total || 0).toFixed(2)}`,
            ].join(' • ');

            return (
                <div className="glass rounded-2xl shadow-sm overflow-hidden border border-slate-800/40 transition-all hover:shadow-lg hover:border-cyan-500/40">
                    <button
                        type="button"
                        onClick={handleHeaderClick}
                        title={hoverSummary}
                        className="w-full text-left px-4 py-3 bg-slate-900/70 border-b border-slate-800/60 flex items-center justify-between gap-3 hover:bg-slate-900/90"
                    >
                        <div>
                            <p className="text-xs uppercase tracking-wide text-slate-400">
                                {new Date(data.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                            </p>
                            <p className="text-base font-semibold text-slate-100 truncate">{data.myName || 'Unnamed Shift'}</p>
                        </div>
                        <span className="badge-pill bg-slate-800 text-slate-200 border border-slate-700 flex items-center gap-1">
                            <i className={`fas ${typeMeta.icon || 'fa-circle-half-stroke'}`}></i>
                            {shiftLabel}
                        </span>
                    </button>
                    <div className="px-4 py-3 space-y-2 text-xs text-slate-300">
                        <div className="flex justify-between">
                            <span>Total</span>
                            <span className="font-semibold text-emerald-300">${toNumber(data.earnings?.total || 0).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Hours</span>
                            <span className="font-semibold text-slate-100">{toNumber(data.summary?.hours || 0).toFixed(1)}h</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Hourly</span>
                            <span className="font-semibold text-indigo-300">${toNumber(data.summary?.hourly || 0).toFixed(2)}/hr</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Tips</span>
                            <span className="font-semibold text-cyan-300">${toNumber(data.tips?._total || 0).toFixed(2)}</span>
                        </div>
                    </div>
                    <div className="flex gap-2 px-4 pb-4">
                        <button
                            onClick={onView}
                            className="flex-1 bg-slate-900/80 border border-slate-800 text-slate-200 px-3 py-2 rounded-xl hover:border-cyan-500 transition-all duration-200 text-xs"
                        >
                            <i className="fas fa-eye mr-1.5"></i>View
                        </button>
                        <button
                            onClick={onEdit}
                            className="flex-1 bg-slate-900/80 border border-slate-800 text-slate-200 px-3 py-2 rounded-xl hover:border-fuchsia-500 transition-all duration-200 text-xs"
                        >
                            <i className="fas fa-edit mr-1.5"></i>Edit
                        </button>
                        <button
                            onClick={onDelete}
                            className="flex-1 bg-red-500/80 text-white px-3 py-2 rounded-xl hover:bg-red-500 transition-all duration-200 text-xs"
                        >
                            <i className="fas fa-trash mr-1.5"></i>Delete
                        </button>
                    </div>
                </div>
            );
        }

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
            { key: 'tips', label: 'Tips', icon: 'fa-coins' },
            { key: 'wage', label: 'Wage', icon: 'fa-money-bill-wave' },
            { key: 'supplement', label: 'Supplement', icon: 'fa-gift' },
            { key: 'timings', label: 'Timings', icon: 'fa-clock' },
            { key: 'cuts', label: 'Cuts', icon: 'fa-layer-group' },
            { key: 'crew', label: 'Crew', icon: 'fa-people-group' },
            { key: 'parties', label: 'Parties', icon: 'fa-martini-glass-citrus' },
            { key: 'drinking', label: 'Drinks', icon: 'fa-wine-glass' },
        ];

        const DEFAULT_SHIFT_TEMPLATE = {
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
            consideration: { items: [], net: 0 },
            supplement: { retention: '' },
            drinking: { items: [], totalSBE: 0 },
            earnings: {
                tips: {
                    tipOut: '',
                    chumpChange: '',
                    total: '',
                },
                wage: {
                    base: '',
                    differential: {
                        managerDifferential: '',
                        shiftDifferential: '',
                        trainingDifferential: '',
                        total: '',
                    },
                    overtime: '',
                    total: '',
                },
                supplement: {
                    consideration: '',
                    retention: '',
                    total: '',
                },
                total: '',
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

        function deepMergeShift(template, override) {
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

        function setNestedValue(target, path, value) {
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

        function getNestedValue(target, path) {
            const keys = path.split('.');
            let cursor = target;
            for (let i = 0; i < keys.length; i += 1) {
                if (!cursor) return undefined;
                cursor = cursor[keys[i]];
            }
            return cursor;
        }

        function buildInitialTimeDrafts(data = {}) {
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

        function calculateHoursBetween(start, end) {
            if (!start || !end) return 0;
            const [startHour, startMin] = start.split(':').map(Number);
            const [endHour, endMin] = end.split(':').map(Number);
            let hours = endHour - startHour + (endMin - startMin) / 60;
            if (hours < 0) hours += 24;
            return Math.round(hours * 100) / 100;
        }

        const MINUTES_IN_DAY = 24 * 60;

        function timeStringToMinutes(time) {
            if (!time || typeof time !== 'string' || !time.includes(':')) return null;
            const [hourStr, minuteStr] = time.split(':');
            const hour = parseInt(hourStr, 10);
            const minutes = parseInt(minuteStr, 10);
            if (Number.isNaN(hour) || Number.isNaN(minutes)) return null;
            return (hour % 24) * 60 + minutes;
        }

        function normalizeMinutesDiff(startMinutes, endMinutes) {
            if (startMinutes == null || endMinutes == null) return null;
            let diff = endMinutes - startMinutes;
            if (diff <= 0) diff += MINUTES_IN_DAY;
            return diff;
        }

        function formatTimeDisplay(time24) {
            if (!time24 || typeof time24 !== 'string' || !time24.includes(':')) return '';
            const [hourStr, minuteStr] = time24.split(':');
            const hour = parseInt(hourStr, 10);
            const minute = parseInt(minuteStr, 10);
            if (Number.isNaN(hour) || Number.isNaN(minute)) return '';
            const period = hour >= 12 ? 'PM' : 'AM';
            const displayHour = hour % 12 === 0 ? 12 : hour % 12;
            return `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`;
        }

        function parseFlexibleTime(rawInput, { mode = 'general', referenceStart = null, defaultPeriod = null } = {}) {
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

                // fall back to closest positive duration when all candidates exceed 12 hours
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

        function inferShiftTypeFromTimes(startTime, endTime) {
            if (!startTime) return '';
            const startMinutes = timeStringToMinutes(startTime);
            if (startMinutes == null) return '';
            const endMinutes = timeStringToMinutes(endTime);
            const duration = endMinutes != null ? normalizeMinutesDiff(startMinutes, endMinutes) : null;

            const dayStartMin = 10 * 60;
            const dayEndMax = 19 * 60 + 30; // 7:30 PM safety net
            const nightThreshold = 16 * 60; // 4:00 PM

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

        function ensureCutSkeleton(type, parties, existingCuts) {
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

        function sanitizeBartenderEntry(entry = {}) {
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

        function sanitizeServerEntry(entry = {}) {
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

        function sanitizeSupportEntry(entry = {}) {
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

        function sanitizeChumpPlayer(entry = {}) {
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

        function normalizeCrewData(raw) {
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
                        })
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
                        })
                    );
                });
            }

            if (Array.isArray(raw.support)) {
                result.support = raw.support.map((entry) => sanitizeSupportEntry(entry));
            }

            return result;
        }

        const toInputString = (value) => {
            if (value === null || value === undefined) return '';
            if (typeof value === 'string') return value;
            if (typeof value === 'number') {
                if (Number.isNaN(value)) return '';
                return value.toString();
            }
            if (typeof value === 'boolean') return value ? '1' : '0';
            return '';
        };

        function normalizeEarningsState(rawEarnings = {}) {
            const template = JSON.parse(JSON.stringify(DEFAULT_SHIFT_TEMPLATE.earnings));

            const tipsSource =
                rawEarnings && typeof rawEarnings.tips === 'object' && !Array.isArray(rawEarnings.tips)
                    ? rawEarnings.tips
                    : rawEarnings;

            template.tips.tipOut = toInputString(
                tipsSource.tipOut ??
                    tipsSource.base ??
                    tipsSource.total ??
                    tipsSource.amount ??
                    rawEarnings.tips ??
                    rawEarnings.tipOut ??
                    ''
            );
            template.tips.chumpChange = toInputString(
                tipsSource.chumpChange ?? tipsSource.chump ?? rawEarnings.chump ?? ''
            );
            template.tips.total = toInputString(tipsSource.total ?? rawEarnings.totalTips ?? rawEarnings.tipsTotal ?? '');

            const wageSource =
                rawEarnings && typeof rawEarnings.wage === 'object' && !Array.isArray(rawEarnings.wage)
                    ? rawEarnings.wage
                    : rawEarnings;

            template.wage.base = toInputString(wageSource.base ?? rawEarnings.wage ?? '');
            template.wage.total = toInputString(wageSource.total ?? rawEarnings.wageTotal ?? rawEarnings.wage ?? '');

            const differentialSource =
                wageSource && typeof wageSource.differential === 'object'
                    ? wageSource.differential
                    : wageSource.differentials || {};

            template.wage.differential.managerDifferential = toInputString(
                differentialSource.managerDifferential ??
                    differentialSource.manager ??
                    rawEarnings.managerDifferential ??
                    ''
            );
            template.wage.differential.shiftDifferential = toInputString(
                differentialSource.shiftDifferential ??
                    differentialSource.shift ??
                    rawEarnings.shiftDifferential ??
                    ''
            );
            template.wage.differential.trainingDifferential = toInputString(
                differentialSource.trainingDifferential ??
                    differentialSource.training ??
                    rawEarnings.trainingDifferential ??
                    ''
            );
            template.wage.differential.total = toInputString(
                differentialSource.total ?? rawEarnings.wageDifferentialTotal ?? ''
            );
            template.wage.overtime = toInputString(wageSource.overtime ?? rawEarnings.overtime ?? '');

            const supplementSource =
                rawEarnings && typeof rawEarnings.supplement === 'object' && !Array.isArray(rawEarnings.supplement)
                    ? rawEarnings.supplement
                    : rawEarnings;

            template.supplement.consideration = toInputString(
                supplementSource.consideration ?? rawEarnings.consideration ?? ''
            );
            template.supplement.retention = toInputString(
                supplementSource.retention ?? rawEarnings.retention ?? ''
            );
            template.supplement.total = toInputString(supplementSource.total ?? rawEarnings.supplementTotal ?? '');

            template.total = toInputString(rawEarnings.total ?? rawEarnings.grandTotal ?? '');

            return template;
        }

        function normalizeShiftPayload(shift) {
            if (!shift) return null;
            const cloned = JSON.parse(JSON.stringify(shift));
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
            cloned.wage.differential = cloned.wage.differential || {};
            cloned.wage.differential.managerDifferential = toInputString(cloned.wage.differential.managerDifferential);
            cloned.wage.differential.shiftDifferential = toInputString(cloned.wage.differential.shiftDifferential);
            cloned.wage.differential.trainingDifferential = toInputString(cloned.wage.differential.trainingDifferential);
            cloned.wage.differential.total = toInputString(cloned.wage.differential.total);

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

            cloned.consideration = cloned.consideration || { items: [], net: 0 };
            cloned.consideration.net =
                cloned.consideration.net !== undefined && cloned.consideration.net !== null
                    ? parseFloat(cloned.consideration.net) || 0
                    : 0;
            cloned.supplement = cloned.supplement || { retention: '' };
            cloned.supplement.retention = toInputString(cloned.supplement.retention);
            cloned.earnings = normalizeEarningsState(cloned.earnings || {});

            if (!Array.isArray(cloned.drinking?.items)) {
                cloned.drinking = cloned.drinking || {};
                cloned.drinking.items = [];
            }

            return cloned;
        }

        function upsertSelfCrew(data, directory) {
            if (!data) return data;
            const coworkers = data.coworkers || normalizeCrewData();
            const bartenders = coworkers.bartenders || [];
            const selfMember = directory.find((member) => member.isSelf);
            const expectedName = (selfMember?.name || 'Ian').trim().toLowerCase();

            let index = bartenders.findIndex(
                (entry) =>
                    entry.isSelf ||
                    (entry.name || '').trim().toLowerCase() === expectedName
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

            const computeConsiderationFromItems = (draft) => {
                if (!Array.isArray(draft?.consideration?.items)) return 0;
                return draft.consideration.items.reduce((sum, item) => {
                    return sum + parseAmount(item?.amount, 0);
                }, 0);
            };

            const computeEarningsBreakdown = (
                draft,
                {
                    presetHours = null,
                    presetWageTotal = null,
                    presetTipsTotal = null,
                } = {}
            ) => {
                if (!draft) {
                    return JSON.parse(JSON.stringify(DEFAULT_SHIFT_TEMPLATE.earnings));
                }

                const hours =
                    presetHours ??
                    draft.time?.base?.hours ??
                    calculateHoursBetween(draft.time?.base?.start, draft.time?.base?.end) ??
                    0;

                const tipOut = parseAmount(
                    presetTipsTotal !== null ? presetTipsTotal : draft.tips?._total,
                    0
                );
                const chumpChange = parseAmount(draft.earnings?.tips?.chumpChange, 0);
                const tipsTotal = parseFloat((tipOut + chumpChange).toFixed(2));

                const wageTotalInput =
                    draft.wage?.total !== undefined && draft.wage?.total !== ''
                        ? parseAmount(draft.wage.total, 0)
                        : null;
                const wageHours =
                    draft.wage?.hours !== undefined && draft.wage?.hours !== ''
                        ? parseAmount(draft.wage.hours, hours || 0)
                        : hours || 0;
                const wageBaseRate = parseAmount(draft.wage?.base, 0);
                const wageBase =
                    presetWageTotal !== null
                        ? presetWageTotal
                        : wageTotalInput !== null
                            ? wageTotalInput
                            : parseFloat((wageBaseRate * wageHours).toFixed(2));

                const managerDifferential = parseAmount(
                    draft.earnings?.wage?.differential?.managerDifferential,
                    0
                );
                const shiftDifferential = parseAmount(
                    draft.earnings?.wage?.differential?.shiftDifferential,
                    0
                );
                const trainingDifferential = parseAmount(
                    draft.earnings?.wage?.differential?.trainingDifferential,
                    0
                );
                const wageDifferentialTotal = parseFloat(
                    (managerDifferential + shiftDifferential + trainingDifferential).toFixed(2)
                );

                const overtime = parseAmount(
                    draft.earnings?.wage?.overtime ??
                        draft.earnings?.overtime ??
                        draft.overtime ??
                        0,
                    0
                );

                const wageTotal = parseFloat((wageBase + wageDifferentialTotal + overtime).toFixed(2));

                const considerationFromItems = computeConsiderationFromItems(draft);
                const considerationInput = draft.earnings?.wage?.consideration; // legacy safety
                const supplementConsiderationRaw =
                    draft.earnings?.supplement?.consideration ??
                    draft.earnings?.consideration ??
                    considerationInput;

                const supplementConsideration =
                    supplementConsiderationRaw === '' || supplementConsiderationRaw === null || supplementConsiderationRaw === undefined
                        ? considerationFromItems
                        : parseAmount(supplementConsiderationRaw, considerationFromItems);

                const retentionRaw =
                    draft.earnings?.supplement?.retention ??
                    draft.supplement?.retention ??
                    draft.retention ??
                    '';
                const supplementRetention = parseAmount(retentionRaw, 0);

                const supplementTotal = parseFloat(
                    (supplementConsideration + supplementRetention).toFixed(2)
                );

                const overallTotal = parseFloat(
                    (tipsTotal + wageTotal + supplementTotal).toFixed(2)
                );

                return {
                    tips: {
                        tipOut,
                        chumpChange,
                        total: tipsTotal,
                    },
                    wage: {
                        base: wageBase,
                        differential: {
                            managerDifferential,
                            shiftDifferential,
                            trainingDifferential,
                            total: wageDifferentialTotal,
                        },
                        overtime,
                        total: wageTotal,
                    },
                    supplement: {
                        consideration: supplementConsideration,
                        retention: supplementRetention,
                        total: supplementTotal,
                    },
                    total: overallTotal,
                };
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
                    next.earnings = next.earnings || {};
                    next.earnings.tips = next.earnings.tips || {};
                    next.earnings.tips.tipOut = normalized;
                    next.earnings.tips.total = next.earnings?.tips?.total || '';
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
                    const hours =
                        next.time.base.hours ||
                        calculateHoursBetween(next.time.base.start, next.time.base.end) ||
                        0;

                    const earningsBreakdown = computeEarningsBreakdown(next, {
                        presetHours: hours,
                    });

                    const hourlyRate =
                        hours > 0 ? parseFloat((earningsBreakdown.total / hours).toFixed(2)) : 0;

                    next.time.base.hours = hours;
                    next.wage.hours =
                        next.wage.hours !== undefined && next.wage.hours !== ''
                            ? next.wage.hours
                            : hours;
                    if (
                        next.wage.total === undefined ||
                        next.wage.total === '' ||
                        next.wage.autoTotal
                    ) {
                        next.wage.total = earningsBreakdown.wage.base.toFixed(2);
                    }
                    next.summary.hours = hours;
                    next.summary.earnings = earningsBreakdown.total;
                    next.summary.hourly = hourlyRate;
                    next.summary.tips.actual = {
                        total: earningsBreakdown.tips.total,
                        perHour:
                            hours > 0
                                ? parseFloat((earningsBreakdown.tips.total / hours).toFixed(2))
                                : 0,
                    };

                    next.consideration = next.consideration || { items: [], net: 0 };
                    next.consideration.net = earningsBreakdown.supplement.consideration;
                    next.supplement = next.supplement || {};
                    next.supplement.retention = earningsBreakdown.supplement.retention;

                    next.earnings = {
                        ...next.earnings,
                        tips: {
                            ...next.earnings?.tips,
                            tipOut: next.tips?._total ?? '',
                            chumpChange: next.earnings?.tips?.chumpChange ?? '',
                            total: earningsBreakdown.tips.total.toFixed(2),
                        },
                        wage: {
                            ...next.earnings?.wage,
                            base: earningsBreakdown.wage.base.toFixed(2),
                            differential: {
                                ...next.earnings?.wage?.differential,
                                managerDifferential:
                                    next.earnings?.wage?.differential?.managerDifferential ?? '',
                                shiftDifferential:
                                    next.earnings?.wage?.differential?.shiftDifferential ?? '',
                                trainingDifferential:
                                    next.earnings?.wage?.differential?.trainingDifferential ?? '',
                                total: earningsBreakdown.wage.differential.total.toFixed(2),
                            },
                            overtime:
                                next.earnings?.wage?.overtime ??
                                next.earnings?.overtime ??
                                earningsBreakdown.wage.overtime.toFixed(2),
                            total: earningsBreakdown.wage.total.toFixed(2),
                        },
                        supplement: {
                            ...next.earnings?.supplement,
                            consideration:
                                next.earnings?.supplement?.consideration ??
                                earningsBreakdown.supplement.consideration.toFixed(2),
                            retention:
                                next.earnings?.supplement?.retention ??
                                earningsBreakdown.supplement.retention.toFixed(2),
                            total: earningsBreakdown.supplement.total.toFixed(2),
                        },
                        total: earningsBreakdown.total.toFixed(2),
                    };

                    const payload = {
                        ...next,
                        earnings: earningsBreakdown,
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

            const calculatedHours =
                formData.time.base.hours ||
                calculateHoursBetween(formData.time.base.start, formData.time.base.end) ||
                0;
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

            const earningsSnapshot = computeEarningsBreakdown(formData, {
                presetHours: calculatedHours,
                presetWageTotal: wageTotal,
                presetTipsTotal: tipsTotalValue,
            });

            const displayedEarnings = earningsSnapshot.total;
            const displayedHourly =
                formData.summary.hourly !== undefined && formData.summary.hourly !== ''
                    ? parseAmount(formData.summary.hourly)
                    : calculatedHours > 0
                        ? parseFloat((displayedEarnings / calculatedHours).toFixed(2))
                        : 0;
            const tipsPerHour =
                formData.summary.tips?.actual?.perHour !== undefined &&
                formData.summary.tips.actual.perHour !== ''
                    ? parseAmount(formData.summary.tips.actual.perHour)
                    : calculatedHours > 0
                        ? parseFloat((earningsSnapshot.tips.total / calculatedHours).toFixed(2))
                        : 0;
            const wageClockHours =
                formData.wage?.clock?.start && formData.wage?.clock?.end
                    ? calculateHoursBetween(formData.wage.clock.start, formData.wage.clock.end)
                    : null;

            const chumpChangeValue = parseAmount(formData.earnings?.tips?.chumpChange);
            const managerDifferentialValue = parseAmount(
                formData.earnings?.wage?.differential?.managerDifferential
            );
            const shiftDifferentialValue = parseAmount(
                formData.earnings?.wage?.differential?.shiftDifferential
            );
            const trainingDifferentialValue = parseAmount(
                formData.earnings?.wage?.differential?.trainingDifferential
            );
            const overtimeInputValue = parseAmount(
                formData.earnings?.wage?.overtime ?? formData.earnings?.overtime
            );
            const considerationAuto = computeConsiderationFromItems(formData);
            const considerationOverrideRaw = formData.earnings?.supplement?.consideration;
            const considerationValue =
                considerationOverrideRaw === '' ||
                considerationOverrideRaw === null ||
                considerationOverrideRaw === undefined
                    ? considerationAuto
                    : parseAmount(considerationOverrideRaw, considerationAuto);
            const retentionValue = parseAmount(
                formData.earnings?.supplement?.retention ?? formData.supplement?.retention
            );
            const toFixed = (value) => {
                const amount = Number(value || 0);
                return Number.isFinite(amount) ? amount.toFixed(2) : '0.00';
            };

            const shiftTypeMeta = SHIFT_TYPE_META[formData.type] || SHIFT_TYPE_META.default;
            const headerIcon = shiftTypeMeta.icon || (shiftTypeMode === 'auto' ? 'fa-circle-half-stroke' : 'fa-circle-question');
            const headerGradient = 'from-slate-950 via-slate-900 to-slate-950';
            const shiftDateObject = useMemo(() => {
                if (!formData.date) return null;
                const parts = formData.date.split('-').map(Number);
                if (parts.length !== 3) return null;
                const [year, month, day] = parts;
                if (!year || !month || !day) return null;
                const parsed = new Date(year, month - 1, day);
                return Number.isNaN(parsed.getTime()) ? null : parsed;
            }, [formData.date]);
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

            const toCurrencyMetric = (value) => {
                const amount = Number(value || 0);
                if (!Number.isFinite(amount) || amount === 0) return '—';
                return `$${amount.toFixed(2)}`;
            };

            const quickPanels = [
                {
                    key: 'tips',
                    page: 'tips',
                    icon: 'fa-coins',
                    label: 'Tips',
                    metric: toCurrencyMetric(earningsSnapshot.tips.total),
                    status: earningsSnapshot.tips.total > 0 ? 'ok' : formData.meta?.tipsPending ? 'pending' : 'none',
                },
                {
                    key: 'wage',
                    page: 'wage',
                    icon: 'fa-money-bill-wave',
                    label: 'Wage',
                    metric: toCurrencyMetric(earningsSnapshot.wage.total),
                    status: earningsSnapshot.wage.total > 0 ? 'ok' : wageHoursValue > 0 ? 'pending' : 'none',
                },
                {
                    key: 'supplement',
                    page: 'supplement',
                    icon: 'fa-gift',
                    label: 'Supplement',
                    metric: toCurrencyMetric(earningsSnapshot.supplement.total),
                    status:
                        earningsSnapshot.supplement.total > 0 ||
                        formData.consideration?.items?.length ||
                        parseAmount(formData.earnings?.supplement?.retention)
                            ? 'ok'
                            : 'none',
                },
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
                                <p className="text-xs text-slate-500 mt-1">Includes tips, wage, supplements</p>
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
                                    onClick={() => setActivePage('tips')}
                                    className="text-sm text-cyan-200 hover:text-white flex items-center gap-2"
                                >
                                    Manage Tips
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

                        {activePage === 'tips' && (
                            <TipsPage
                                formData={formData}
                                tipsTotalValue={tipsTotalValue}
                                chumpChangeValue={chumpChangeValue}
                                earningsSnapshot={earningsSnapshot}
                                onNavigateOverview={() => setActivePage('overview')}
                                onUpdate={updateFormPath}
                                toFixed={toFixed}
                            />
                        )}

                        {activePage === 'wage' && (
                            <WagePage
                                formData={formData}
                                timeErrors={timeErrors}
                                getTimeDraftValue={getTimeDraftValue}
                                handleTimeDraftChange={handleTimeDraftChange}
                                commitTimeValue={commitTimeValue}
                                updateFormPath={updateFormPath}
                                wageClockHours={wageClockHours}
                                wageTotal={wageTotal}
                                earningsSnapshot={earningsSnapshot}
                                overtimeInputValue={overtimeInputValue}
                                toFixed={toFixed}
                            />
                        )}

                        {activePage === 'supplement' && (
                            <SupplementPage
                                formData={formData}
                                onUpdate={updateFormPath}
                                onAddConsideration={handleAddConsideration}
                                considerationAuto={considerationAuto}
                                considerationValue={considerationValue}
                                retentionValue={retentionValue}
                                toFixed={toFixed}
                            />
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

        // Shift Detail Component
        function ShiftDetail({ shift, onEdit, onClose }) {
            const toFixed = (value) => {
                const amount = Number(value || 0);
                return Number.isFinite(amount) ? amount.toFixed(2) : '0.00';
            };
            const tips = (shift.earnings && typeof shift.earnings.tips === 'object') ? shift.earnings.tips : {
                tipOut: shift.earnings?.tips ?? 0,
                chumpChange: shift.earnings?.chump ?? 0,
                total: shift.earnings?.tips ?? 0,
            };
            const wageRaw = shift.earnings?.wage;
            const wage =
                wageRaw && typeof wageRaw === 'object'
                    ? wageRaw
                    : {
                          base: Number(wageRaw || 0),
                          differential: { total: Number(shift.earnings?.wageDifferential ?? 0) },
                          overtime: Number(shift.earnings?.overtime ?? 0),
                          total: Number(shift.earnings?.wage || 0),
                      };
            const supplementRaw = shift.earnings?.supplement;
            const supplement =
                supplementRaw && typeof supplementRaw === 'object'
                    ? supplementRaw
                    : {
                          consideration: Number(shift.earnings?.consideration ?? 0),
                          retention: Number(shift.earnings?.retention ?? 0),
                          total: Number(shift.earnings?.supplement ?? 0),
                      };

            const tipsTotal = Number(
                tips.total ?? Number(tips.tipOut || 0) + Number(tips.chumpChange || 0)
            );
            const wageBase = Number(wage.base ?? wage.total ?? wage);
            const wageDifferential = Number(wage.differential?.total ?? 0);
            const wageOvertime = Number(wage.overtime ?? shift.earnings?.overtime ?? 0);
            const wageTotal = Number(
                wage.total ?? wageBase + wageDifferential + wageOvertime
            );
            const supplementTotal = Number(
                supplement.total ??
                    Number(supplement.consideration || 0) +
                        Number(supplement.retention || 0)
            );

            return (
                <div className="glass rounded-2xl shadow-xl p-6 animate-slide-in border border-slate-800/40">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-2xl font-bold text-slate-100">
                            Shift Details - {new Date(shift.date).toLocaleDateString()}
                        </h2>
                        <div className="flex gap-2">
                            <button
                                onClick={onEdit}
                                className="bg-gradient-to-r from-cyan-500 to-fuchsia-500 text-white px-4 py-2 rounded-xl hover:shadow-lg hover:shadow-cyan-500/30 transition-all duration-300"
                            >
                                <i className="fas fa-edit mr-2"></i>Edit
                            </button>
                            <button
                                onClick={onClose}
                                className="bg-slate-900/70 border border-slate-700 text-slate-200 px-4 py-2 rounded-xl hover:border-cyan-500 transition-all duration-300"
                            >
                                <i className="fas fa-times mr-2"></i>Close
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-slate-900/70 rounded-xl p-4 border border-slate-800/60">
                            <h3 className="font-semibold text-slate-100 mb-3">Basic Information</h3>
                            <div className="space-y-2 text-slate-300 text-sm">
                                <div className="flex justify-between">
                                    <span>Date:</span>
                                    <span className="font-semibold text-slate-100">{shift.date}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Type:</span>
                                    <span className="font-semibold text-slate-100 capitalize">{shift.type}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Name:</span>
                                    <span className="font-semibold text-slate-100">{shift.myName}</span>
                                </div>
                            </div>
                        </div>

                        <div className="bg-slate-900/70 rounded-xl p-4 border border-slate-800/60">
                            <h3 className="font-semibold text-slate-100 mb-3">Time</h3>
                            <div className="space-y-2 text-slate-300 text-sm">
                                <div className="flex justify-between">
                                    <span>Start:</span>
                                          <span className="font-semibold text-slate-100">{formatTimeDisplay(shift.time?.base?.start)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>End:</span>
                                          <span className="font-semibold text-slate-100">{formatTimeDisplay(shift.time?.base?.end)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Hours:</span>
                                    <span className="font-semibold text-slate-100">{shift.time?.base?.hours?.toFixed(1)}h</span>
                                </div>
                            </div>
                        </div>

                        <div className="bg-slate-900/70 rounded-xl p-4 border border-slate-800/60">
                            <h3 className="font-semibold text-slate-100 mb-3">Earnings Breakdown</h3>
                            <div className="space-y-2 text-sm text-slate-300">
                                <div>
                                    <div className="flex justify-between">
                                        <span>Tips:</span>
                                        <span className="font-semibold text-cyan-300">${toFixed(tipsTotal)}</span>
                                    </div>
                                    <div className="flex justify-between text-xs text-slate-500 pl-2">
                                        <span>Tip Out</span>
                                        <span>${toFixed(tips.tipOut)}</span>
                                    </div>
                                    <div className="flex justify-between text-xs text-slate-500 pl-2">
                                        <span>Chump Change</span>
                                        <span>${toFixed(tips.chumpChange)}</span>
                                    </div>
                                </div>
                                <div>
                                    <div className="flex justify-between pt-1">
                                        <span>Wage:</span>
                                        <span className="font-semibold text-emerald-300">${toFixed(wageTotal)}</span>
                                    </div>
                                    <div className="flex justify-between text-xs text-slate-500 pl-2">
                                        <span>Base</span>
                                        <span>${toFixed(wageBase)}</span>
                                    </div>
                                    <div className="flex justify-between text-xs text-slate-500 pl-2">
                                        <span>Differential</span>
                                        <span>${toFixed(wageDifferential)}</span>
                                    </div>
                                    <div className="flex justify-between text-xs text-slate-500 pl-2">
                                        <span>Overtime</span>
                                        <span>${toFixed(wageOvertime)}</span>
                                    </div>
                                </div>
                                <div>
                                    <div className="flex justify-between pt-1">
                                        <span>Supplement:</span>
                                        <span className="font-semibold text-fuchsia-300">${toFixed(supplementTotal)}</span>
                                    </div>
                                    <div className="flex justify-between text-xs text-slate-500 pl-2">
                                        <span>Consideration</span>
                                        <span>${toFixed(supplement.consideration)}</span>
                                    </div>
                                    <div className="flex justify-between text-xs text-slate-500 pl-2">
                                        <span>Retention</span>
                                        <span>${toFixed(supplement.retention)}</span>
                                    </div>
                                </div>
                                  <div className="flex justify-between pt-2 border-t border-slate-800/60 text-slate-100">
                                      <span className="font-semibold">Total:</span>
                                    <span className="font-bold text-xl text-emerald-300">${toFixed(shift.earnings?.total)}</span>
                                  </div>
                            </div>
                        </div>

                        <div className="bg-slate-900/70 rounded-xl p-4 border border-slate-800/60">
                            <h3 className="font-semibold text-slate-100 mb-3">Performance Summary</h3>
                            <div className="space-y-2 text-sm text-slate-300">
                                <div className="flex justify-between">
                                    <span>Hourly Rate:</span>
                                      <span className="font-bold text-lg text-indigo-300">${Number(shift.summary?.hourly ?? 0).toFixed(2)}/hr</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Tips/Hour:</span>
                                      <span className="font-semibold text-fuchsia-300">${Number(shift.summary?.tips?.actual?.perHour ?? 0).toFixed(2)}/hr</span>
                                </div>
                                  <div className="flex justify-between">
                                      <span>Total Hours:</span>
                                      <span className="font-semibold text-slate-100">{Number(shift.summary?.hours ?? 0).toFixed(1)}h</span>
                                  </div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-6 bg-slate-900/70 rounded-xl p-4 border border-slate-800/60">
                        <details>
                            <summary className="font-semibold text-slate-100 cursor-pointer hover:text-cyan-300">
                                View Raw JSON Data
                            </summary>
                            <pre className="mt-3 text-xs bg-slate-950 p-4 rounded border border-slate-800 overflow-x-auto scrollbar-thin text-slate-300">
{JSON.stringify(shift, null, 2)}
                            </pre>
                        </details>
                    </div>
                </div>
            );
        }
export default App;
