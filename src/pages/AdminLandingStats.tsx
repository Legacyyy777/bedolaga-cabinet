import { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { adminLandingsApi, resolveLocaleDisplay } from '../api/landings';
import { useCurrency } from '../hooks/useCurrency';
import { useChartColors } from '../hooks/useChartColors';
import { CHART_COMMON } from '../constants/charts';
import { AdminBackButton } from '../components/admin';

// Icons
const ChartIcon = () => (
  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"
    />
  </svg>
);

const TARIFF_PALETTE = ['#818cf8', '#34d399', '#f59e0b', '#ec4899', '#06b6d4', '#8b5cf6'];
const GIFT_COLOR = '#a855f7';

export default function AdminLandingStats() {
  const { t, i18n } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const numericId = id ? Number(id) : NaN;
  const isValidId = !isNaN(numericId);
  const navigate = useNavigate();
  const { formatWithCurrency } = useCurrency();
  const colors = useChartColors();

  // Fetch stats
  const {
    data: stats,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['landing-stats', numericId],
    queryFn: () => adminLandingsApi.getStats(numericId),
    enabled: isValidId,
    staleTime: CHART_COMMON.STALE_TIME,
  });

  // Fetch landing detail for header
  const { data: landing } = useQuery({
    queryKey: ['admin-landing', numericId],
    queryFn: () => adminLandingsApi.get(numericId),
    enabled: isValidId,
    staleTime: CHART_COMMON.STALE_TIME,
  });

  // Prepare daily chart data
  const dailyData = useMemo(() => {
    if (!stats) return [];
    return stats.daily_stats.map((item) => ({
      label: new Date(item.date + 'T00:00:00').toLocaleDateString(i18n.language, {
        month: 'short',
        day: 'numeric',
      }),
      purchases: item.purchases,
      revenue: item.revenue_kopeks / CHART_COMMON.KOPEKS_DIVISOR,
      gifts: item.gifts,
    }));
  }, [stats, i18n.language]);

  // Prepare tariff chart data
  const tariffData = useMemo(() => {
    if (!stats) return [];
    return stats.tariff_stats.map((item) => ({
      name: item.tariff_name,
      purchases: item.purchases,
      revenue: item.revenue_kopeks / CHART_COMMON.KOPEKS_DIVISOR,
    }));
  }, [stats]);

  // Donut data for gift vs regular
  const donutData = useMemo(() => {
    if (!stats) return [];
    return [
      {
        name: t('admin.landings.stats.regular'),
        value: stats.total_regular,
        color: colors.referrals,
      },
      { name: t('admin.landings.stats.gifts'), value: stats.total_gifts, color: GIFT_COLOR },
    ];
  }, [stats, t, colors.referrals]);

  // Bar chart height based on tariff count
  const barChartHeight = useMemo(() => {
    const count = tariffData.length;
    return Math.max(220, count * 45 + 40);
  }, [tariffData.length]);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent-500 border-t-transparent" />
      </div>
    );
  }

  // Error state
  if (error || !stats) {
    return (
      <div className="animate-fade-in">
        <div className="mb-6 flex items-center gap-3">
          <AdminBackButton to="/admin/landings" />
          <h1 className="text-xl font-semibold text-dark-100">{t('admin.landings.stats.title')}</h1>
        </div>
        <div className="rounded-xl border border-error-500/30 bg-error-500/10 p-6 text-center">
          <p className="text-error-400">{t('admin.landings.stats.loadError')}</p>
          <button
            onClick={() => navigate('/admin/landings')}
            className="mt-4 text-sm text-dark-400 hover:text-dark-200"
          >
            {t('common.back')}
          </button>
        </div>
      </div>
    );
  }

  const landingTitle = landing ? resolveLocaleDisplay(landing.title) : `#${numericId}`;

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <AdminBackButton to="/admin/landings" />
          <div className="rounded-lg bg-accent-500/20 p-2 text-accent-400">
            <ChartIcon />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold text-dark-100">{landingTitle}</h1>
            <div className="mt-1 flex items-center gap-2">
              {landing?.is_active ? (
                <span className="rounded bg-success-500/20 px-2 py-0.5 text-xs text-success-400">
                  {t('admin.landings.active')}
                </span>
              ) : (
                <span className="rounded bg-dark-600 px-2 py-0.5 text-xs text-dark-400">
                  {t('admin.landings.inactive')}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-dark-700 bg-dark-800 p-4 text-center">
            <div className="text-xl font-bold text-accent-400 sm:text-2xl">
              {stats.total_purchases}
            </div>
            <div className="text-xs text-dark-500">{t('admin.landings.stats.totalPurchases')}</div>
          </div>
          <div className="rounded-xl border border-dark-700 bg-dark-800 p-4 text-center">
            <div className="truncate text-xl font-bold text-success-400 sm:text-2xl">
              {formatWithCurrency(stats.total_revenue_kopeks / CHART_COMMON.KOPEKS_DIVISOR)}
            </div>
            <div className="text-xs text-dark-500">{t('admin.landings.stats.revenue')}</div>
          </div>
          <div className="rounded-xl border border-dark-700 bg-dark-800 p-4 text-center">
            <div className="text-xl font-bold text-purple-400 sm:text-2xl">{stats.total_gifts}</div>
            <div className="text-xs text-dark-500">{t('admin.landings.stats.giftPurchases')}</div>
          </div>
          <div className="rounded-xl border border-dark-700 bg-dark-800 p-4 text-center">
            <div className="text-xl font-bold text-warning-400 sm:text-2xl">
              {stats.conversion_rate}%
            </div>
            <div className="text-xs text-dark-500">{t('admin.landings.stats.conversionRate')}</div>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Daily Purchases & Revenue */}
          <div className="rounded-xl border border-dark-700 bg-dark-800 p-4">
            <h3 className="mb-4 font-medium text-dark-200">
              {t('admin.landings.stats.dailyChart')}
            </h3>
            {dailyData.length === 0 ? (
              <div className="flex h-[220px] items-center justify-center text-sm text-dark-500">
                {t('admin.landings.stats.noPurchases')}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={dailyData} margin={CHART_COMMON.CHART.MARGIN}>
                  <defs>
                    <linearGradient
                      id={`landingPurchaseGrad-${numericId}`}
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset={CHART_COMMON.GRADIENT.START_OFFSET}
                        stopColor={colors.referrals}
                        stopOpacity={CHART_COMMON.GRADIENT.START_OPACITY}
                      />
                      <stop
                        offset={CHART_COMMON.GRADIENT.END_OFFSET}
                        stopColor={colors.referrals}
                        stopOpacity={CHART_COMMON.GRADIENT.END_OPACITY}
                      />
                    </linearGradient>
                    <linearGradient
                      id={`landingRevenueGrad-${numericId}`}
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset={CHART_COMMON.GRADIENT.START_OFFSET}
                        stopColor={colors.earnings}
                        stopOpacity={CHART_COMMON.GRADIENT.START_OPACITY}
                      />
                      <stop
                        offset={CHART_COMMON.GRADIENT.END_OFFSET}
                        stopColor={colors.earnings}
                        stopOpacity={CHART_COMMON.GRADIENT.END_OPACITY}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray={CHART_COMMON.GRID_DASH} stroke={colors.grid} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: CHART_COMMON.AXIS.TICK_FONT_SIZE, fill: colors.tick }}
                    stroke={colors.grid}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    yAxisId="left"
                    tick={{ fontSize: CHART_COMMON.AXIS.TICK_FONT_SIZE, fill: colors.tick }}
                    stroke={colors.grid}
                    allowDecimals={false}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fontSize: CHART_COMMON.AXIS.TICK_FONT_SIZE, fill: colors.tick }}
                    stroke={colors.grid}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: colors.tooltipBg,
                      border: `1px solid ${colors.tooltipBorder}`,
                      borderRadius: CHART_COMMON.TOOLTIP.BORDER_RADIUS,
                      fontSize: CHART_COMMON.TOOLTIP.FONT_SIZE,
                    }}
                    labelStyle={{ color: colors.label }}
                  />
                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="purchases"
                    name={t('admin.landings.stats.purchases')}
                    stroke={colors.referrals}
                    fill={`url(#landingPurchaseGrad-${numericId})`}
                    strokeWidth={CHART_COMMON.STROKE_WIDTH}
                  />
                  <Area
                    yAxisId="right"
                    type="monotone"
                    dataKey="revenue"
                    name={t('admin.landings.stats.revenueLabel')}
                    stroke={colors.earnings}
                    fill={`url(#landingRevenueGrad-${numericId})`}
                    strokeWidth={CHART_COMMON.STROKE_WIDTH}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Tariff Distribution */}
          <div className="rounded-xl border border-dark-700 bg-dark-800 p-4">
            <h3 className="mb-4 font-medium text-dark-200">
              {t('admin.landings.stats.tariffChart')}
            </h3>
            {tariffData.length === 0 ? (
              <div className="flex h-[220px] items-center justify-center text-sm text-dark-500">
                {t('admin.landings.stats.noPurchases')}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={barChartHeight}>
                <BarChart
                  data={tariffData}
                  layout="vertical"
                  margin={{ ...CHART_COMMON.CHART.MARGIN, left: 10 }}
                >
                  <CartesianGrid strokeDasharray={CHART_COMMON.GRID_DASH} stroke={colors.grid} />
                  <XAxis
                    type="number"
                    tick={{ fontSize: CHART_COMMON.AXIS.TICK_FONT_SIZE, fill: colors.tick }}
                    stroke={colors.grid}
                    allowDecimals={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: CHART_COMMON.AXIS.TICK_FONT_SIZE, fill: colors.tick }}
                    stroke={colors.grid}
                    width={100}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: colors.tooltipBg,
                      border: `1px solid ${colors.tooltipBorder}`,
                      borderRadius: CHART_COMMON.TOOLTIP.BORDER_RADIUS,
                      fontSize: CHART_COMMON.TOOLTIP.FONT_SIZE,
                    }}
                    labelStyle={{ color: colors.label }}
                    formatter={(value: number | undefined) => {
                      return [value ?? 0, t('admin.landings.stats.purchases')];
                    }}
                  />
                  <Bar
                    dataKey="purchases"
                    name={t('admin.landings.stats.purchases')}
                    radius={[0, 4, 4, 0]}
                  >
                    {tariffData.map((_, index) => (
                      <Cell key={index} fill={TARIFF_PALETTE[index % TARIFF_PALETTE.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Additional Stats Row */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-dark-700 bg-dark-800 p-4">
            <div className="mb-1 text-sm text-dark-400">
              {t('admin.landings.stats.avgPurchase')}
            </div>
            <div className="text-lg font-medium text-dark-200">
              {formatWithCurrency(stats.avg_purchase_kopeks / CHART_COMMON.KOPEKS_DIVISOR)}
            </div>
          </div>
          <div className="rounded-xl border border-dark-700 bg-dark-800 p-4">
            <div className="mb-1 text-sm text-dark-400">
              {t('admin.landings.stats.regularPurchases')}
            </div>
            <div className="text-lg font-medium text-dark-200">{stats.total_regular}</div>
          </div>
          <div className="col-span-2 rounded-xl border border-dark-700 bg-dark-800 p-4 sm:col-span-1">
            <div className="mb-1 text-sm text-dark-400">{t('admin.landings.stats.funnel')}</div>
            <div className="text-lg font-medium text-dark-200">
              {stats.total_created}{' '}
              <span className="text-sm text-dark-500">{t('admin.landings.stats.created')}</span>
              {' / '}
              {stats.total_successful}{' '}
              <span className="text-sm text-dark-500">{t('admin.landings.stats.successful')}</span>
            </div>
          </div>
        </div>

        {/* Gift vs Regular Donut */}
        {stats.total_purchases > 0 && (
          <div className="rounded-xl border border-dark-700 bg-dark-800 p-4">
            <h3 className="mb-4 font-medium text-dark-200">
              {t('admin.landings.stats.giftBreakdown')}
            </h3>
            <div className="flex items-center justify-center gap-8">
              <div className="relative">
                <ResponsiveContainer width={160} height={160}>
                  <PieChart>
                    <Pie
                      data={donutData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={70}
                      dataKey="value"
                      strokeWidth={0}
                    >
                      {donutData.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: colors.tooltipBg,
                        border: `1px solid ${colors.tooltipBorder}`,
                        borderRadius: CHART_COMMON.TOOLTIP.BORDER_RADIUS,
                        fontSize: CHART_COMMON.TOOLTIP.FONT_SIZE,
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                {/* Center text */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-lg font-bold text-dark-100">{stats.total_purchases}</span>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: colors.referrals }}
                  />
                  <span className="text-sm text-dark-300">
                    {t('admin.landings.stats.regular')}: {stats.total_regular}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: GIFT_COLOR }} />
                  <span className="text-sm text-dark-300">
                    {t('admin.landings.stats.gifts')}: {stats.total_gifts}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
