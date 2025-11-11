// @ts-nocheck
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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
import {
  DEFAULT_SHIFT_TEMPLATE,
  serializeShiftForRow,
  deserializeShiftRow,
  applyLocalShift,
  removeLocalShift,
  estimateRowIndex,
  deepMergeShift,
  setNestedValue,
  getNestedValue,
  buildInitialTimeDrafts,
  calculateHoursBetween,
  formatTimeDisplay,
  parseFlexibleTime,
  inferShiftTypeFromTimes,
  ensureCutSkeleton,
  normalizeCrewData,
  normalizeShiftPayload,
  upsertSelfCrew,
  parseShiftDate,
  formatShiftDate,
} from './lib/shiftUtils';
import { VIEW_MODES, CREW_POSITION_OPTIONS } from './lib/constants';
import CoworkerDatabase from './components/Coworkers/CoworkerDatabase';
import ShiftForm from './components/ShiftForm/ShiftForm';
import Layout from './components/Layout/Layout';
import DashboardView from './components/Dashboard/Dashboard';
const COWORKER_SHEET_NAME = 'Coworkers';

const getSheetsErrorMessage = (error, fallback = 'Google Sheets request failed.') => {
  if (!error) return fallback;
  if (typeof error === 'string') return error;
  if (error?.result?.error?.message) return error.result.error.message;
  if (error?.message) return error.message;
  return fallback;
};

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
            const [notice, setNotice] = useState(null);

            useEffect(() => {
                if (view === VIEW_MODES.SHIFT_CREATE || view === VIEW_MODES.SHIFT_EDIT) {
                    setSidebarCollapsed(true);
                } else if (view === VIEW_MODES.DASHBOARD || view === VIEW_MODES.SHIFT_VIEW) {
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
            setNotice(null);
            try {
                const range = `${config.sheetName}!A2:F`;
                const response = await sheetsAPI.readData(config.spreadsheetId, range);
                const values = response || [];
                const loadedShifts = values
                    .map((row, index) => deserializeShiftRow(index + 2, row))
                    .filter(Boolean);
                setShifts(loadedShifts);
                storeCachedShifts(loadedShifts);
                setNotice(null);
            } catch (error) {
                console.warn('Failed to fetch shifts from Sheets', error);
                const cached = loadCachedShifts();
                if (cached && cached.length) {
                    setShifts(cached);
                    setNotice(
                        getSheetsErrorMessage(
                            error,
                            'Unable to reach Google Sheets. Showing cached shifts.'
                        )
                    );
                } else {
                    setError(getSheetsErrorMessage(error, 'Failed to load shifts.'));
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
                    setShowConfig(false);
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
                setShowConfig(false);
            };

            const viewShift = (shift) => {
                setCurrentShift(shift.data);
                setView(VIEW_MODES.SHIFT_VIEW);
                setShowConfig(false);
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
                setShowConfig(false);
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
                <Layout
                    navItems={navItems}
                    activeNavKey={activeNavKey}
                    onSelectNav={handleNavSelect}
                    sidebarCollapsed={sidebarCollapsed}
                    onToggleSidebar={() => setSidebarCollapsed((prev) => !prev)}
                    serverStatus={serverStatus}
                    notice={notice}
                    onDismissNotice={() => setNotice(null)}
                    error={error}
                    onDismissError={() => setError(null)}
                    showConfig={showConfig}
                    onToggleConfig={() => setShowConfig((prev) => !prev)}
                    config={config}
                    setConfig={setConfig}
                    saveConfig={saveConfig}
                    isAuthenticated={isAuthenticated}
                    handleAuthenticate={handleAuthenticate}
                    loading={loading}
                    onStartNewShift={() => startNewShift({ date: new Date().toISOString().split('T')[0] })}
                >
                    {showConfig ? null : (
                        <>
                            {!isAuthenticated && (
                                <div className="glass rounded-xl p-4 mb-6 border border-amber-400/30 bg-amber-500/10 animate-slide-in">
                                    <div className="flex items-center gap-3">
                                        <i className="fas fa-plug-circle-xmark text-amber-300 text-xl"></i>
                                        <div className="flex-1">
                                            <p className="text-amber-200 font-medium">Working Offline</p>
                                            <p className="text-amber-100/80 text-sm">
                                                You can keep logging shifts locally. Connect to Google Sheets to sync when you’re ready.
                                            </p>
                                        </div>
                                        <button
                                            onClick={handleAuthenticate}
                                            disabled={loading}
                                            className="px-3 py-1.5 rounded-lg border border-amber-400/40 text-amber-100 hover:border-amber-300 hover:bg-amber-500/20 text-sm transition disabled:opacity-60"
                                        >
                                            {loading ? 'Connecting…' : 'Connect'}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {view === VIEW_MODES.DASHBOARD && (
                                <DashboardView
                                    shifts={shifts}
                                    onEdit={editShift}
                                    onDelete={deleteShift}
                                    onView={viewShift}
                                    onStartNew={startNewShiftForDate}
                                    loading={loading}
                                    onRefresh={loadShifts}
                                />
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
                </Layout>
            );
        }

        // Shift Detail Component
        function ShiftDetail({ shift, onEdit, onClose }) {
            return (
                <div className="glass rounded-2xl shadow-xl p-6 animate-slide-in border border-slate-800/40">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-2xl font-bold text-slate-100">
                            Shift Details - {formatShiftDate(shift.date) || shift.date || '—'}
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
                                      <span className="font-semibold text-slate-100">
                                          {formatShiftDate(shift.date, {
                                              weekday: 'long',
                                              month: 'long',
                                              day: 'numeric',
                                              year: 'numeric',
                                          }) || shift.date || '—'}
                                      </span>
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
                                  <div className="flex justify-between">
                                      <span>Tips:</span>
                                      <span className="font-semibold text-cyan-300">${Number(shift.earnings?.tips ?? 0).toFixed(2)}</span>
                                  </div>
                                  <div className="flex justify-between">
                                      <span>Wage:</span>
                                      <span className="font-semibold text-emerald-300">${Number(shift.earnings?.wage ?? 0).toFixed(2)}</span>
                                  </div>
                                  {Number(shift.earnings?.overtime ?? 0) > 0 && (
                                      <div className="flex justify-between">
                                          <span>Overtime:</span>
                                          <span className="font-semibold text-amber-300">${Number(shift.earnings?.overtime ?? 0).toFixed(2)}</span>
                                      </div>
                                  )}
                                  <div className="flex justify-between pt-2 border-t border-slate-800/60 text-slate-100">
                                      <span className="font-semibold">Total:</span>
                                      <span className="font-bold text-xl text-emerald-300">${Number(shift.earnings?.total ?? 0).toFixed(2)}</span>
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
