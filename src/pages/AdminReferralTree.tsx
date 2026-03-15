import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { adminUsersApi, type UserListItem } from '@/api/adminUsers';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/primitives/Select';
import { Skeleton } from '@/components/ui/Skeleton';

const ChevronDownIcon = () => (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
  </svg>
);

const ChevronUpIcon = () => (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
  </svg>
);

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

function SubscriptionBadge({ status }: { status: string | null }) {
  const { t } = useTranslation();
  const key =
    status === 'active' || status === 'trial' || status === 'expired' ? status : 'expired';
  const label = t(`admin.referralTree.subscription.${key}`);
  const styles: Record<string, string> = {
    active: 'bg-success-500/20 text-success-400 border-success-500/30',
    trial: 'bg-accent-500/20 text-accent-400 border-accent-500/30',
    expired: 'bg-warning-500/20 text-warning-400 border-warning-500/30',
  };
  const style = styles[key] ?? styles.expired;
  return <span className={`rounded-full border px-2 py-0.5 text-xs ${style}`}>{label}</span>;
}

export default function AdminReferralTree() {
  const { t } = useTranslation();
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [referralsCache, setReferralsCache] = useState<Map<number, UserListItem[]>>(new Map());
  const [loadingReferrals, setLoadingReferrals] = useState<Set<number>>(new Set());

  const [topN, setTopN] = useState<number | null>(null);
  const [periodDays, setPeriodDays] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<'referrals' | 'earnings'>('referrals');

  const loadUsers = useCallback(
    async (top: number | null, days: number | null, sort: 'referrals' | 'earnings') => {
      setLoading(true);
      setError(null);
      try {
        try {
          const data = await adminUsersApi.getReferrers({
            ...(top != null ? { top } : { limit: 500 }),
            ...(days != null ? { days } : {}),
            sort_by: sort,
          });
          setUsers(data.users);
        } catch (referrersErr: unknown) {
          const is404 =
            referrersErr &&
            typeof referrersErr === 'object' &&
            'response' in referrersErr &&
            (referrersErr as { response?: { status?: number } }).response?.status === 404;
          if (is404) {
            const data = await adminUsersApi.getUsers({ limit: 500 });
            const withReferrals = data.users.filter((u) => (u.referral?.referrals_count ?? 0) > 0);
            setUsers(withReferrals);
          } else {
            throw referrersErr;
          }
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : t('common.error'));
      } finally {
        setLoading(false);
      }
    },
    [t],
  );

  useEffect(() => {
    loadUsers(topN, periodDays, sortBy);
  }, [topN, periodDays, sortBy, loadUsers]);

  const filteredUsers = searchQuery.trim()
    ? users.filter((u) => {
        const q = searchQuery.toLowerCase();
        const name = (u.full_name ?? '').toLowerCase();
        const un = (u.username ?? '').toLowerCase();
        return name.includes(q) || un.includes(q);
      })
    : users;

  const handleExportCSV = useCallback(() => {
    const list = searchQuery.trim() ? filteredUsers : users;
    const header = [
      t('admin.referralTree.export.place'),
      t('admin.referralTree.export.name'),
      t('admin.referralTree.export.username'),
      t('admin.referralTree.export.referralsCount'),
      t('admin.referralTree.export.earningsRub'),
    ].join(',');
    const rows = list.map((u, i) => {
      const earnings = u.referral?.total_earnings_kopeks ?? 0;
      const rub = (earnings / 100).toFixed(2);
      return [
        i + 1,
        `"${(u.full_name ?? '').replace(/"/g, '""')}"`,
        u.username ? `"@${u.username.replace(/"/g, '""')}"` : '',
        u.referral?.referrals_count ?? 0,
        rub,
      ].join(',');
    });
    const csv = [header, ...rows].join('\r\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `referrers-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [users, filteredUsers, searchQuery, t]);

  const toggleExpand = useCallback(
    async (userId: number) => {
      if (expanded.has(userId)) {
        setExpanded((prev) => {
          const next = new Set(prev);
          next.delete(userId);
          return next;
        });
        return;
      }
      const cached = referralsCache.get(userId);
      if (cached !== undefined) {
        setExpanded((prev) => new Set(prev).add(userId));
        return;
      }
      setLoadingReferrals((prev) => new Set(prev).add(userId));
      try {
        const data = await adminUsersApi.getReferrals(userId, 0, 100);
        setReferralsCache((prev) => new Map(prev).set(userId, data.users));
        setExpanded((prev) => new Set(prev).add(userId));
      } catch {
        setError(t('common.error'));
      } finally {
        setLoadingReferrals((prev) => {
          const next = new Set(prev);
          next.delete(userId);
          return next;
        });
      }
    },
    [expanded, referralsCache, t],
  );

  return (
    <div className="animate-fade-in space-y-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-dark-100">{t('admin.referralTree.title')}</h1>
        <p className="mt-1 text-sm text-dark-400">
          {t('admin.referralTree.subtitle', { count: users.length })}
        </p>
      </div>

      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-dark-400">
            <span>{t('admin.referralTree.periodLabel')}</span>
            <Select
              value={periodDays !== null ? String(periodDays) : 'all'}
              onValueChange={(v) => setPeriodDays(v === 'all' ? null : Number(v))}
            >
              <SelectTrigger className="h-9 min-w-[7rem] rounded-lg border border-dark-700/50 bg-dark-800/40 px-2 py-1.5 text-dark-100" />
              <SelectContent>
                <SelectItem value="all">{t('admin.referralTree.periodAll')}</SelectItem>
                <SelectItem value="7">{t('admin.referralTree.period7')}</SelectItem>
                <SelectItem value="30">{t('admin.referralTree.period30')}</SelectItem>
                <SelectItem value="60">{t('admin.referralTree.period60')}</SelectItem>
              </SelectContent>
            </Select>
          </label>
          <label className="flex items-center gap-2 text-sm text-dark-400">
            <span>{t('admin.referralTree.sortLabel')}</span>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as 'referrals' | 'earnings')}>
              <SelectTrigger className="h-9 min-w-[12rem] rounded-lg border border-dark-700/50 bg-dark-800/40 px-2 py-1.5 text-dark-100" />
              <SelectContent>
                <SelectItem value="referrals">{t('admin.referralTree.sortReferrals')}</SelectItem>
                <SelectItem value="earnings">{t('admin.referralTree.sortEarnings')}</SelectItem>
              </SelectContent>
            </Select>
          </label>
          <label className="flex items-center gap-2 text-sm text-dark-400">
            <span>{t('admin.referralTree.topLabel')}</span>
            <Select
              value={topN !== null ? String(topN) : 'all'}
              onValueChange={(v) => setTopN(v === 'all' ? null : Number(v))}
            >
              <SelectTrigger className="h-9 min-w-[5rem] rounded-lg border border-dark-700/50 bg-dark-800/40 px-2 py-1.5 text-dark-100" />
              <SelectContent>
                <SelectItem value="all">{t('admin.referralTree.topAll')}</SelectItem>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
          </label>
          <button
            type="button"
            onClick={handleExportCSV}
            disabled={users.length === 0}
            className="rounded-lg border border-dark-700/50 bg-dark-800/40 px-3 py-1.5 text-sm text-dark-200 transition-colors hover:bg-dark-700 disabled:opacity-50"
          >
            {t('admin.referralTree.exportBtn')}
          </button>
        </div>
        <div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('common.search')}
            className="w-full rounded-xl border border-dark-700/50 bg-dark-800/40 px-4 py-2 text-dark-100 placeholder-dark-500 focus:border-dark-600 focus:outline-none"
          />
        </div>

        {loading ? (
          <div className="space-y-4">
            <Skeleton variant="list" count={5} />
          </div>
        ) : error ? (
          <div className="rounded-xl border border-dark-700/50 bg-dark-800/40 p-4 text-dark-300">
            {error}
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="rounded-xl border border-dark-700/50 bg-dark-800/40 p-8 text-center">
            <p className="text-dark-300">{t('admin.referralTree.empty')}</p>
            <p className="mt-2 text-sm text-dark-500">{t('admin.referralTree.emptyHint')}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredUsers.map((user) => {
              const count = user.referral?.referrals_count ?? 0;
              const earningsKopeks = user.referral?.total_earnings_kopeks ?? 0;
              const earningsRub = (earningsKopeks / 100).toFixed(2);
              const isExpanded = expanded.has(user.id);
              const refs = referralsCache.get(user.id) ?? [];
              const isLoadingRefs = loadingReferrals.has(user.id);

              return (
                <div key={user.id} className="space-y-2">
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleExpand(user.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleExpand(user.id);
                      }
                    }}
                    className="flex cursor-pointer items-center gap-3 rounded-xl border border-dark-700/50 bg-dark-800/40 p-3 transition-all hover:border-dark-600 hover:bg-dark-800/80"
                    aria-expanded={isExpanded}
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-500/20 text-sm font-medium text-accent-400">
                      {user.full_name?.[0] ?? user.username?.[0] ?? '?'}
                    </div>
                    <div className="min-w-0 flex-1" onClick={(e) => e.stopPropagation()}>
                      <Link
                        to={`/admin/users/${user.id}`}
                        className="font-medium text-dark-100 hover:text-accent-400 hover:underline"
                      >
                        {user.full_name}
                      </Link>
                      {user.username && (
                        <div className="text-sm text-dark-500">
                          <Link
                            to={`/admin/users/${user.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="hover:text-accent-400 hover:underline"
                          >
                            @{user.username}
                          </Link>
                        </div>
                      )}
                    </div>
                    <span className="shrink-0 text-right text-sm text-success-400">
                      {t('admin.referralTree.earnings')}: {earningsRub} ₽
                    </span>
                    <span className="shrink-0 rounded-full border border-dark-600 bg-dark-700/50 px-2 py-0.5 text-xs text-dark-300">
                      {t('admin.referralTree.referralsCount', { count })}
                    </span>
                    <span className="shrink-0 text-dark-400" aria-hidden>
                      {isExpanded ? <ChevronUpIcon /> : <ChevronDownIcon />}
                    </span>
                  </div>

                  {isExpanded && (
                    <div className="space-y-2 pl-8">
                      {isLoadingRefs ? (
                        <div className="flex items-center gap-2 py-2">
                          <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent-500 border-t-transparent" />
                          <span className="text-sm text-dark-500">{t('common.loading')}</span>
                        </div>
                      ) : refs.length === 0 ? (
                        <div className="py-2 text-sm text-dark-500">
                          {t('admin.referralTree.noReferrals')}
                        </div>
                      ) : (
                        refs.map((ref) => (
                          <Link
                            key={ref.id}
                            to={`/admin/users/${ref.id}`}
                            className="flex items-center gap-3 rounded-xl border border-dark-700/50 bg-dark-800/40 p-2.5 transition-all hover:border-dark-600 hover:bg-dark-800/80"
                          >
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-500/20 text-xs font-medium text-accent-400">
                              {ref.full_name?.[0] ?? ref.username?.[0] ?? '?'}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-medium text-dark-100">
                                {ref.full_name}
                              </div>
                              <div className="flex flex-wrap items-center gap-2 text-xs text-dark-500">
                                {ref.username && <span>@{ref.username}</span>}
                                <span>{formatDate(ref.created_at)}</span>
                              </div>
                            </div>
                            <SubscriptionBadge status={ref.subscription_status} />
                          </Link>
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
