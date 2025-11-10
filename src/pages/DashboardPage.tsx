// @ts-nocheck
import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import Chart from 'chart.js/auto';
import { formatTimeDisplay } from './ShiftEntryPage';

type ShiftRecord = {
  id: string;
  data: any;
  rowIndex?: number;
};

type DashboardPageProps = {
  shifts: ShiftRecord[];
  loading: boolean;
  onRefresh: () => void;
  onEditShift: (shift: ShiftRecord) => void;
  onDeleteShift: (shiftId: string) => void;
  onViewShift: (shift: ShiftRecord) => void;
  onStartNewShift: (dateKey?: string) => void;
};

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

      <div className="grid grid-cols-7 gap-2 text-center text-[11px] uppercase tracking-wide text-slate-500">
        {daysOfWeek.map((day) => (
          <div key={day} className="py-2">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-2 mt-2">
        {calendarCells.map((cell, index) => {
          if (cell.type === 'pad') {
            return (
              <div
                key={`pad-${index}`}
                className="aspect-square rounded-xl border border-slate-900/40 bg-slate-950/40"
              />
            );
          }

          const shift = cell.shifts?.[0];
          const hasShift = !!shift;
          const earnings = hasShift ? Number(shift.data?.earnings?.total ?? 0) : 0;
          const hours = hasShift ? Number(shift.data?.summary?.hours ?? 0) : 0;
          const hourly = hours > 0 ? earnings / hours : 0;
          const tooltip = hasShift
            ? `${shift.data.date} • $${earnings.toFixed(2)} • ${hours.toFixed(1)}h`
            : cell.date.toDateString();

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
    [onEdit, onStartNew],
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
                <th className="px-4 py-3 text-left font-semibold">
                  {valueMode === 'tips' ? 'Tips' : 'Earnings'}
                </th>
                <th className="px-4 py-3 text-left font-semibold">
                  {valueMode === 'tips' ? 'Tips / Hour' : 'Rate'}
                </th>
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
                    rawTips !== undefined && rawTips !== '' ? rawTips : shift.data.earnings?.tips ?? 0,
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
                            onClick={(event) => {
                              event.stopPropagation();
                              onEdit?.(shift);
                            }}
                            className="px-3 py-2 rounded-xl border border-slate-700 hover:border-fuchsia-500/40 text-xs"
                          >
                            <i className="fas fa-pen mr-1.5"></i>
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              onDelete?.(shift.id);
                            }}
                            className="px-3 py-2 rounded-xl border border-rose-500/40 text-rose-300 hover:bg-rose-500/10 text-xs"
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
    </div>
  );
}

function ChartsPanel({ shifts }) {
  const lineChartRef = useRef(null);
  const barChartRef = useRef(null);
  const [chartSpan, setChartSpan] = useState(14);

  const timeline = useMemo(() => {
    const sorted = [...shifts]
      .sort((a, b) => new Date(a.data.date) - new Date(b.data.date))
      .slice(-Math.max(chartSpan, 14));

    return sorted.map((shift) => ({
      date: shift.data.date,
      tips: Number(shift.data.earnings?.tips ?? shift.data.tips?._total ?? 0),
      total: Number(shift.data.earnings?.total ?? 0),
      hourly: Number(shift.data.summary?.hourly ?? 0),
    }));
  }, [shifts, chartSpan]);

  const aggregateStats = useMemo(() => {
    const tipsTotal = shifts.reduce((sum, shift) => sum + Number(shift.data.earnings?.tips ?? 0), 0);
    const totalEarnings = shifts.reduce((sum, shift) => sum + Number(shift.data.earnings?.total ?? 0), 0);
    const hours = shifts.reduce((sum, shift) => sum + Number(shift.data.summary?.hours ?? 0), 0);

    return {
      tipsTotal,
      totalEarnings,
      averageHourly: hours > 0 ? totalEarnings / hours : 0,
      count: shifts.length,
    };
  }, [shifts]);

  useEffect(() => {
    if (!timeline.length) return undefined;
    const ctx = document.getElementById('earningsTrend');
    if (!ctx) return undefined;

    if (lineChartRef.current) {
      lineChartRef.current.destroy();
    }

    lineChartRef.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels: timeline.map((item) => item.date),
        datasets: [
          {
            label: 'Tips',
            data: timeline.map((item) => item.tips),
            borderColor: '#06b6d4',
            backgroundColor: 'rgba(6, 182, 212, 0.1)',
            tension: 0.4,
            borderWidth: 2,
            pointRadius: 2,
            fill: true,
          },
          {
            label: 'Total Earnings',
            data: timeline.map((item) => item.total),
            borderColor: '#a855f7',
            backgroundColor: 'rgba(168, 85, 247, 0.12)',
            tension: 0.4,
            borderWidth: 2,
            pointRadius: 2,
            fill: true,
          },
        ],
      },
      options: {
        maintainAspectRatio: false,
        scales: {
          y: {
            ticks: {
              color: '#94a3b8',
              callback: (value) => `$${value}`,
            },
            grid: {
              color: 'rgba(148, 163, 184, 0.1)',
            },
          },
          x: {
            ticks: {
              color: '#94a3b8',
              maxRotation: 0,
              callback: (value, index) => {
                const label = timeline[index]?.date;
                if (!label) return '';
                const date = new Date(label);
                return `${date.getMonth() + 1}/${date.getDate()}`;
              },
            },
            grid: {
              color: 'rgba(148, 163, 184, 0.05)',
            },
          },
        },
        plugins: {
          legend: {
            labels: {
              color: '#e2e8f0',
            },
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const raw = context.raw ?? 0;
                return `${context.dataset.label}: $${Number(raw).toFixed(2)}`;
              },
            },
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
  }, [timeline]);

  useEffect(() => {
    if (!timeline.length) return undefined;
    const ctx = document.getElementById('hourlySpread');
    if (!ctx) return undefined;
    if (barChartRef.current) {
      barChartRef.current.destroy();
    }

    const buckets = [
      { label: '< $20/hr', min: 0, max: 20 },
      { label: '$20-$30/hr', min: 20, max: 30 },
      { label: '$30-$40/hr', min: 30, max: 40 },
      { label: '$40-$50/hr', min: 40, max: 50 },
      { label: '$50+/hr', min: 50, max: Infinity },
    ];

    const counts = buckets.map((bucket) => {
      return shifts.filter((shift) => {
        const hourly = Number(shift.data.summary?.hourly ?? 0);
        return hourly >= bucket.min && hourly < bucket.max;
      }).length;
    });

    barChartRef.current = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: buckets.map((bucket) => bucket.label),
        datasets: [
          {
            label: 'Shifts',
            data: counts,
            backgroundColor: [
              'rgba(6, 182, 212, 0.6)',
              'rgba(59, 130, 246, 0.6)',
              'rgba(139, 92, 246, 0.6)',
              'rgba(236, 72, 153, 0.6)',
              'rgba(16, 185, 129, 0.6)',
            ],
            borderRadius: 10,
          },
        ],
      },
      options: {
        maintainAspectRatio: false,
        scales: {
          x: {
            ticks: {
              color: '#94a3b8',
            },
            grid: {
              display: false,
            },
          },
          y: {
            ticks: {
              color: '#94a3b8',
              precision: 0,
            },
            grid: {
              color: 'rgba(148, 163, 184, 0.1)',
            },
          },
        },
        plugins: {
          legend: {
            display: false,
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
  }, [timeline, shifts]);

  return (
    <div className="glass rounded-xl shadow-lg border border-slate-800/40 p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">Performance Overview</h3>
          <p className="text-xs text-slate-400">Rolling analytics for your recent shifts</p>
        </div>
        <div className="flex items-center gap-2">
          {[14, 30, 60].map((span) => (
            <button
              key={span}
              type="button"
              onClick={() => setChartSpan(span)}
              className={`px-3 py-1.5 text-xs rounded-lg border transition ${
                chartSpan === span
                  ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-100'
                  : 'border-slate-700 text-slate-300 hover:border-cyan-500/30'
              }`}
            >
              Last {span} days
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          icon="fa-coins"
          label="Total Tips"
          value={`$${aggregateStats.tipsTotal.toFixed(2)}`}
          gradient="from-cyan-500 to-blue-500"
        />
        <StatCard
          icon="fa-money-check-dollar"
          label="Total Earnings"
          value={`$${aggregateStats.totalEarnings.toFixed(2)}`}
          gradient="from-fuchsia-500 to-purple-500"
        />
        <StatCard
          icon="fa-clock"
          label="Average Hourly"
          value={`$${aggregateStats.averageHourly.toFixed(2)}/hr`}
          gradient="from-indigo-500 to-sky-500"
        />
        <StatCard
          icon="fa-briefcase"
          label="Shifts Tracked"
          value={`${aggregateStats.count}`}
          gradient="from-emerald-500 to-teal-500"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-900/60 rounded-2xl border border-slate-800/60 p-4">
          <h4 className="text-sm font-semibold text-slate-100 mb-3">Tips &amp; Earnings Trend</h4>
          <div className="h-64">
            <canvas id="earningsTrend"></canvas>
          </div>
        </div>
        <div className="bg-slate-900/60 rounded-2xl border border-slate-800/60 p-4">
          <h4 className="text-sm font-semibold text-slate-100 mb-3">Hourly Distribution</h4>
          <div className="h-64">
            <canvas id="hourlySpread"></canvas>
          </div>
        </div>
      </div>
    </div>
  );
}

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

export default function DashboardPage({
  shifts,
  loading,
  onRefresh,
  onEditShift,
  onDeleteShift,
  onViewShift,
  onStartNewShift,
}: DashboardPageProps) {
  return (
    <div className="space-y-6">
      <ShiftList
        shifts={shifts}
        onEdit={onEditShift}
        onDelete={(shiftId) => onDeleteShift?.(shiftId)}
        onView={onViewShift}
        onStartNew={onStartNewShift}
        loading={loading}
        onRefresh={onRefresh}
      />
      <ChartsPanel shifts={shifts} />
    </div>
  );
}
