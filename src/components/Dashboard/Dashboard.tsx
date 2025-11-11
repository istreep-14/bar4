// @ts-nocheck
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import Chart from 'chart.js/auto';
import { parseShiftDate, formatShiftDate, formatTimeDisplay } from '../../lib/shiftUtils';

const SHIFT_CARD_META = {
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
        return [...shifts]
            .sort((a, b) => {
                const aTime = parseShiftDate(a.data.date)?.getTime() ?? 0;
                const bTime = parseShiftDate(b.data.date)?.getTime() ?? 0;
                return bTime - aTime;
            })
            .slice(0, 20);
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
        const parsed = parseShiftDate(dateString);
        if (!parsed) {
            return { label: dateString, sublabel: '' };
        }
        const label = parsed.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
        });
        const sublabel = parsed.toLocaleDateString('en-US', {
            weekday: 'long',
        });
        const full = parsed.toLocaleDateString('en-US', {
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
        if (!earnings) return 'Tips';
        const parts = [];
        if (earnings.tips) parts.push('Tips');
        if (earnings.wage) parts.push('Wage');
        if (earnings.overtime) parts.push('Overtime');
        if (earnings.chump) parts.push('Chump');
        if (earnings.consideration) parts.push('Consideration');
        if (earnings.swindle) parts.push('Adjustments');
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
    const sorted = [...shifts].sort((a, b) => {
        const aTime = parseShiftDate(a.data.date)?.getTime() ?? 0;
        const bTime = parseShiftDate(b.data.date)?.getTime() ?? 0;
        return aTime - bTime;
    });
        return sorted.slice(-chartSpan);
    }, [shifts, chartSpan]);

    useEffect(() => {
        if (!lineRef.current) return;

        const labels = recentShifts.map((shift) =>
            formatShiftDate(shift.data.date) || shift.data.date || ''
        );
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

        const earningsBars = shifts.slice(-8).map((shift) => shift.data.earnings || {});
        const barLabels = shifts
            .slice(-8)
            .map((shift) => formatShiftDate(shift.data.date) || shift.data.date || '');

        barChartRef.current = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: barLabels,
                datasets: [
                    {
                        label: 'Tips',
                        data: earningsBars.map((earn) => earn.tips || 0),
                        backgroundColor: 'rgba(34, 211, 238, 0.6)',
                    },
                    {
                        label: 'Wage',
                        data: earningsBars.map((earn) => earn.wage || 0),
                        backgroundColor: 'rgba(192, 132, 252, 0.6)',
                    },
                    {
                        label: 'Other',
                        data: earningsBars.map((earn) => (earn.total || 0) - (earn.tips || 0) - (earn.wage || 0)),
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
    const typeMeta = SHIFT_CARD_META[data.type] || SHIFT_CARD_META.default;

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
                        {formatShiftDate(data.date, {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                        }) || data.date || '—'}
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

const DashboardView = ({ shifts, onEdit, onDelete, onView, onStartNew, loading, onRefresh }) => {
  return (
    <div className="space-y-6">
      <ShiftList
        shifts={shifts}
        onEdit={onEdit}
        onDelete={onDelete}
        onView={onView}
        onStartNew={onStartNew}
        loading={loading}
        onRefresh={onRefresh}
      />
      <ChartsPanel shifts={shifts} />
    </div>
  );
};

export { MonthlyCalendar, ShiftList, ChartsPanel, StatCard, ShiftCard };
export default DashboardView;
