import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { referralNetworkApi } from '@/api/referralNetwork';
import { useReferralNetworkStore } from '@/store/referralNetwork';
import { getSigmaInstance, getGraphInstance } from '../sigmaGlobals';

interface NetworkSearchProps {
  className?: string;
}

export function NetworkSearch({ className }: NetworkSearchProps) {
  const { t } = useTranslation();
  const [inputValue, setInputValue] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const setHighlightedNodes = useReferralNetworkStore((s) => s.setHighlightedNodes);
  const setSelectedNode = useReferralNetworkStore((s) => s.setSelectedNode);

  // Debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(inputValue.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [inputValue]);

  const { data: searchResults, isFetching } = useQuery({
    queryKey: ['referral-network-search', debouncedQuery],
    queryFn: () => referralNetworkApi.search(debouncedQuery),
    enabled: debouncedQuery.length >= 2,
    staleTime: 30_000,
  });

  // Open dropdown when results arrive
  useEffect(() => {
    if (searchResults && debouncedQuery.length >= 2) {
      setIsDropdownOpen(true);
    }
  }, [searchResults, debouncedQuery]);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function navigateToNode(nodeId: string) {
    const sigma = getSigmaInstance();
    const graph = getGraphInstance();

    if (sigma && graph && graph.hasNode(nodeId)) {
      // getNodeDisplayData returns viewport (pixel) coordinates.
      // Convert to framed graph coordinates that the camera operates in.
      const displayData = sigma.getNodeDisplayData(nodeId);
      if (displayData) {
        const camera = sigma.getCamera();
        const framedCoords = sigma.viewportToFramedGraph({
          x: displayData.x,
          y: displayData.y,
        });
        camera.animate({ ...framedCoords, ratio: 0.15 }, { duration: 600 });
      }

      setHighlightedNodes(new Set([nodeId]));
    }
  }

  function handleSelectUser(userId: number) {
    setIsDropdownOpen(false);
    setSelectedNode({ type: 'user', id: userId });
    navigateToNode(`user_${userId}`);
  }

  function handleSelectCampaign(campaignId: number) {
    setIsDropdownOpen(false);
    setSelectedNode({ type: 'campaign', id: campaignId });
    navigateToNode(`campaign_${campaignId}`);
  }

  function handleClear() {
    setInputValue('');
    setDebouncedQuery('');
    setIsDropdownOpen(false);
    setHighlightedNodes(new Set());
    setSelectedNode(null);
  }

  const totalResults =
    (searchResults?.users?.length ?? 0) + (searchResults?.campaigns?.length ?? 0);

  return (
    <div ref={dropdownRef} className={`relative ${className ?? ''}`}>
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dark-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
          />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onFocus={() => {
            if (searchResults && debouncedQuery.length >= 2) setIsDropdownOpen(true);
          }}
          placeholder={t('admin.referralNetwork.search.placeholder')}
          className="w-full rounded-lg border border-dark-700/50 bg-dark-800/80 py-2 pl-10 pr-10 text-sm text-dark-100 placeholder-dark-500 outline-none transition-colors focus:border-accent-500/50 focus:ring-1 focus:ring-accent-500/30"
        />
        {inputValue && (
          <button
            onClick={handleClear}
            aria-label={t('admin.referralNetwork.search.clear')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-500 transition-colors hover:text-dark-300"
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
        )}
        {isFetching && (
          <div className="absolute right-10 top-1/2 -translate-y-1/2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-dark-600 border-t-accent-400" />
          </div>
        )}
      </div>

      {/* Dropdown */}
      {isDropdownOpen && debouncedQuery.length >= 2 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-80 overflow-y-auto rounded-lg border border-dark-700/50 bg-dark-900/95 shadow-xl backdrop-blur-md">
          {totalResults === 0 && !isFetching && (
            <div className="px-4 py-3 text-center text-sm text-dark-500">
              {t('admin.referralNetwork.search.noResults')}
            </div>
          )}

          {searchResults?.users && searchResults.users.length > 0 && (
            <div>
              {searchResults.users.map((user) => (
                <button
                  key={`u-${user.id}`}
                  onClick={() => handleSelectUser(user.id)}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-dark-800/80"
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-500/20 text-xs font-medium text-accent-400">
                    U
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-dark-100">
                      {user.display_name}
                    </p>
                    <p className="truncate text-xs text-dark-500">
                      {user.username ? `@${user.username}` : ''}
                      {user.tg_id ? ` #${user.tg_id}` : ''}
                    </p>
                  </div>
                  {user.is_partner && (
                    <span className="shrink-0 rounded bg-warning-500/20 px-1.5 py-0.5 text-[10px] font-medium text-warning-400">
                      {t('admin.referralNetwork.user.partner')}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {searchResults?.campaigns && searchResults.campaigns.length > 0 && (
            <div>
              {searchResults.users && searchResults.users.length > 0 && (
                <div className="mx-4 border-t border-dark-700/50" />
              )}
              {searchResults.campaigns.map((campaign) => (
                <button
                  key={`c-${campaign.id}`}
                  onClick={() => handleSelectCampaign(campaign.id)}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-dark-800/80"
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-success-500/20 text-xs font-medium text-success-400">
                    C
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-dark-100">{campaign.name}</p>
                    <p className="truncate text-xs text-dark-500">{campaign.start_parameter}</p>
                  </div>
                  <span
                    className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                      campaign.is_active
                        ? 'bg-success-500/20 text-success-400'
                        : 'bg-dark-700/50 text-dark-400'
                    }`}
                  >
                    {campaign.is_active
                      ? t('admin.referralNetwork.campaign.active')
                      : t('admin.referralNetwork.campaign.inactive')}
                  </span>
                </button>
              ))}
            </div>
          )}

          {totalResults > 0 && (
            <div className="border-t border-dark-700/50 px-4 py-2 text-center text-xs text-dark-500">
              {t('admin.referralNetwork.search.resultsCount', { count: totalResults })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
