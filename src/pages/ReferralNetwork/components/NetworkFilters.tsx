import { useTranslation } from 'react-i18next';
import { useReferralNetworkStore } from '@/store/referralNetwork';
import type { NetworkGraphData } from '@/types/referralNetwork';

interface NetworkFiltersProps {
  data: NetworkGraphData;
  className?: string;
}

export function NetworkFilters({ data, className }: NetworkFiltersProps) {
  const { t } = useTranslation();

  const filters = useReferralNetworkStore((s) => s.filters);
  const updateFilters = useReferralNetworkStore((s) => s.updateFilters);
  const resetFilters = useReferralNetworkStore((s) => s.resetFilters);
  const isOpen = useReferralNetworkStore((s) => s.isFiltersOpen);
  const setIsOpen = useReferralNetworkStore((s) => s.setIsFiltersOpen);

  function toggleCampaign(campaignId: number) {
    const current = filters.campaigns;
    const next = current.includes(campaignId)
      ? current.filter((id) => id !== campaignId)
      : [...current, campaignId];
    updateFilters({ campaigns: next });
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        aria-label={t('admin.referralNetwork.filters.title')}
        className={`flex items-center gap-2 rounded-lg border border-dark-700/50 bg-dark-800/80 px-3 py-2 text-sm text-dark-300 transition-colors hover:border-dark-600 hover:text-dark-100 ${className ?? ''}`}
      >
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75"
          />
        </svg>
        {t('admin.referralNetwork.filters.title')}
      </button>
    );
  }

  return (
    <div
      className={`rounded-xl border border-dark-700/50 bg-dark-900/90 p-4 backdrop-blur-md ${className ?? ''}`}
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-dark-100">
          {t('admin.referralNetwork.filters.title')}
        </h3>
        <button
          onClick={() => setIsOpen(false)}
          aria-label={t('common.close')}
          className="text-dark-500 transition-colors hover:text-dark-300"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="space-y-4">
        {/* Campaigns */}
        {data.campaigns.length > 0 && (
          <div>
            <label className="mb-1.5 block text-xs font-medium text-dark-400">
              {t('admin.referralNetwork.filters.campaigns')}
            </label>
            <div className="max-h-32 space-y-1 overflow-y-auto">
              {data.campaigns.map((campaign) => (
                <label
                  key={campaign.id}
                  className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm transition-colors hover:bg-dark-800/50"
                >
                  <input
                    type="checkbox"
                    checked={filters.campaigns.includes(campaign.id)}
                    onChange={() => toggleCampaign(campaign.id)}
                    className="h-3.5 w-3.5 rounded border-dark-600 bg-dark-800 text-accent-500 focus:ring-accent-500/30"
                  />
                  <span className="truncate text-dark-200">{campaign.name}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Partners only */}
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={filters.partnersOnly}
            onChange={(e) => updateFilters({ partnersOnly: e.target.checked })}
            className="h-3.5 w-3.5 rounded border-dark-600 bg-dark-800 text-accent-500 focus:ring-accent-500/30"
          />
          <span className="text-dark-200">{t('admin.referralNetwork.filters.partnersOnly')}</span>
        </label>

        {/* Min referrals */}
        <div>
          <label className="mb-1.5 flex items-center justify-between text-xs font-medium text-dark-400">
            <span>{t('admin.referralNetwork.filters.minReferrals')}</span>
            <span className="font-mono text-dark-300">{filters.minReferrals}</span>
          </label>
          <input
            type="range"
            min={0}
            max={50}
            value={filters.minReferrals}
            onChange={(e) => updateFilters({ minReferrals: Number(e.target.value) })}
            className="w-full accent-accent-500"
          />
        </div>

        {/* Reset */}
        <button
          onClick={resetFilters}
          className="w-full rounded-lg border border-dark-700/50 py-1.5 text-xs font-medium text-dark-400 transition-colors hover:border-dark-600 hover:text-dark-200"
        >
          {t('admin.referralNetwork.filters.reset')}
        </button>
      </div>
    </div>
  );
}
