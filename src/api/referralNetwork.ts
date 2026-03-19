import apiClient from './client';
import type {
  NetworkGraphData,
  NetworkUserDetail,
  NetworkCampaignDetail,
  NetworkSearchResult,
} from '@/types/referralNetwork';

export const referralNetworkApi = {
  getNetworkGraph: async (): Promise<NetworkGraphData> => {
    const response = await apiClient.get('/cabinet/admin/referral-network/');
    return response.data;
  },

  getUserDetail: async (userId: number): Promise<NetworkUserDetail> => {
    const response = await apiClient.get(`/cabinet/admin/referral-network/user/${userId}`);
    return response.data;
  },

  getCampaignDetail: async (campaignId: number): Promise<NetworkCampaignDetail> => {
    const response = await apiClient.get(`/cabinet/admin/referral-network/campaign/${campaignId}`);
    return response.data;
  },

  search: async (query: string): Promise<NetworkSearchResult> => {
    const response = await apiClient.get('/cabinet/admin/referral-network/search', {
      params: { q: query },
    });
    return response.data;
  },
};
