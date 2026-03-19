import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { referralNetworkApi } from '@/api/referralNetwork';
import { useReferralNetworkStore } from '@/store/referralNetwork';
import { AdminBackButton } from '@/components/admin/AdminBackButton';
import { NetworkGraph } from './components/NetworkGraph';
import { NetworkSearch } from './components/NetworkSearch';
import { NetworkFilters } from './components/NetworkFilters';
import { UserDetailPanel } from './components/UserDetailPanel';
import { CampaignDetailPanel } from './components/CampaignDetailPanel';
import { NetworkStats } from './components/NetworkStats';
import { NetworkLegend } from './components/NetworkLegend';
import { NetworkControls } from './components/NetworkControls';

export function ReferralNetwork() {
  const { t } = useTranslation();
  const selectedNode = useReferralNetworkStore((s) => s.selectedNode);

  const {
    data: networkData,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['referral-network-graph'],
    queryFn: referralNetworkApi.getNetworkGraph,
    staleTime: 120_000,
  });

  const isPanelOpen = selectedNode !== null;

  return (
    <div
      id="referral-network-container"
      className="relative flex h-[calc(100vh-64px)] flex-col overflow-hidden bg-[#0a0a0f]"
    >
      {/* Top bar */}
      <div className="relative z-20 flex shrink-0 items-center gap-3 border-b border-dark-700/50 bg-dark-900/90 px-4 py-3 backdrop-blur-md">
        <AdminBackButton />
        <div className="mr-2 min-w-0">
          <h1 className="truncate text-sm font-bold text-dark-100 sm:text-lg">
            {t('admin.referralNetwork.title')}
          </h1>
          <p className="hidden text-xs text-dark-500 sm:block">
            {t('admin.referralNetwork.subtitle')}
          </p>
        </div>
        <div className="flex flex-1 items-center gap-2">
          <NetworkSearch className="max-w-md flex-1" />
          {networkData && <NetworkFilters data={networkData} />}
        </div>
      </div>

      {/* Main content area */}
      <div className="relative flex min-h-0 flex-1">
        {/* Loading state */}
        {isLoading && (
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center">
              <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-dark-600 border-t-accent-400" />
              <p className="text-sm text-dark-400">{t('admin.referralNetwork.loading')}</p>
            </div>
          </div>
        )}

        {/* Error state */}
        {isError && (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-sm text-error-400">{t('admin.referralNetwork.error')}</p>
          </div>
        )}

        {/* Empty state */}
        {networkData && networkData.users.length === 0 && networkData.campaigns.length === 0 && (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-sm text-dark-500">{t('admin.referralNetwork.empty')}</p>
          </div>
        )}

        {/* Graph */}
        {networkData && (networkData.users.length > 0 || networkData.campaigns.length > 0) && (
          <>
            <NetworkGraph data={networkData} className="flex-1" />

            {/* Bottom-left: stats overlay */}
            <div className="absolute bottom-4 left-4 z-10">
              <NetworkStats data={networkData} />
            </div>

            {/* Bottom-right: legend */}
            <div className="absolute bottom-4 right-4 z-10">
              <NetworkLegend />
            </div>

            {/* Bottom-center: controls */}
            <div className="absolute bottom-4 left-1/2 z-10 -translate-x-1/2">
              <NetworkControls />
            </div>
          </>
        )}

        {/* Right side panel */}
        <div
          className={`absolute right-0 top-0 z-30 flex h-full w-full flex-col border-l border-dark-700/50 bg-dark-900/95 backdrop-blur-md transition-transform duration-300 ease-in-out sm:w-[400px] ${
            isPanelOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          {selectedNode?.type === 'user' && (
            <UserDetailPanel
              userId={selectedNode.id}
              className="flex flex-1 flex-col overflow-hidden"
            />
          )}
          {selectedNode?.type === 'campaign' && (
            <CampaignDetailPanel
              campaignId={selectedNode.id}
              className="flex flex-1 flex-col overflow-hidden"
            />
          )}
        </div>
      </div>
    </div>
  );
}
