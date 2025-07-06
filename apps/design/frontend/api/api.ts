import React from 'react';
import { type Api } from '../../backend/app/app';
import { type BallotMode } from '@vx/libs/hmpb/src';
import * as grout from '@vx/libs/grout/src';
import {
  QueryClient,
  QueryKey,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { type BallotStyleId, BallotType } from '@vx/libs/types/elections';
import { type Id } from '@vx/libs/types/basic';

export type ApiClient = grout.Client<Api>;

export function createApiClient(): ApiClient {
  return grout.createClient<Api>({ baseUrl: '/api' });
}

export const ApiClientContext = React.createContext<ApiClient | undefined>(
  undefined
);

export function useApiClient(): ApiClient {
  const apiClient = React.useContext(ApiClientContext);
  if (!apiClient) {
    throw new Error('ApiClientContext.Provider not found');
  }
  return apiClient;
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        // In test, we only want to refetch when we explicitly invalidate. In
        // dev/prod, it's fine to refetch more aggressively.
        refetchOnMount: process.env.NODE_ENV !== 'test',
        throwOnError: true,
      },
      mutations: {
        throwOnError: true,
      },
    },
  });
}

export const listElections = {
  queryKey(): QueryKey {
    return ['listElections'];
  },
  useQuery() {
    const apiClient = useApiClient();
    return useQuery({
      queryKey: this.queryKey(),
      queryFn: () => apiClient.listElections(),
    });
  },
} as const;

export const getElection = {
  queryKey(id: Id): QueryKey {
    return ['getElection', id];
  },
  useQuery(id: Id) {
    const apiClient = useApiClient();
    return useQuery({
      queryKey: this.queryKey(id),
      queryFn: () => apiClient.getElection({ electionId: id }),
    });
  },
} as const;

export const loadElection = {
  useMutation() {
    const apiClient = useApiClient();
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: apiClient.loadElection,
      async onSuccess() {
        await queryClient.invalidateQueries({
          queryKey: listElections.queryKey(),
        });
      },
    });
  },
} as const;

export const createElection = {
  useMutation() {
    const apiClient = useApiClient();
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: apiClient.createElection,
      async onSuccess() {
        await queryClient.invalidateQueries({
          queryKey: listElections.queryKey(),
        });
      },
    });
  },
} as const;

export const updateElection = {
  useMutation() {
    const apiClient = useApiClient();
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: apiClient.updateElection,
      async onSuccess(_, { electionId }) {
        // Invalidate list, since title/date may have changed
        await queryClient.invalidateQueries({
          queryKey: listElections.queryKey(),
          // Ensure list of elections is refetched in the background so it's
          // fresh when user navigates back to elections list
          refetchType: 'all',
        });
        await queryClient.invalidateQueries({
          queryKey: getElection.queryKey(electionId),
        });
      },
    });
  },
} as const;

export const updateSystemSettings = {
  useMutation() {
    const apiClient = useApiClient();
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: apiClient.updateSystemSettings,
      async onSuccess(_, { electionId }) {
        await queryClient.invalidateQueries({
          queryKey: getElection.queryKey(electionId),
        });
      },
    });
  },
} as const;

export const updatePrecincts = {
  useMutation() {
    const apiClient = useApiClient();
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: apiClient.updatePrecincts,
      async onSuccess(_, { electionId }) {
        await queryClient.invalidateQueries({
          queryKey: getElection.queryKey(electionId),
        });
      },
    });
  },
} as const;

export const deleteElection = {
  useMutation() {
    const apiClient = useApiClient();
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: apiClient.deleteElection,
      async onSuccess(_, { electionId }) {
        queryClient.removeQueries({
          queryKey: getElection.queryKey(electionId),
        });
        await queryClient.invalidateQueries({
          queryKey: listElections.queryKey(),
          // Ensure list of elections is refetched in the background so it's
          // fresh when we redirect to elections list
          refetchType: 'all',
        });
      },
    });
  },
} as const;

export const exportAllBallots = {
  useMutation() {
    const apiClient = useApiClient();
    return useMutation({ mutationFn: apiClient.exportAllBallots });
  },
} as const;

interface GetBallotPreviewInput {
  electionId: Id;
  precinctId: string;
  ballotStyleId: BallotStyleId;
  ballotType: BallotType;
  ballotMode: BallotMode;
}

export const getBallotPreviewPdf = {
  queryKey(input: GetBallotPreviewInput): QueryKey {
    return ['getBallotPreviewPdf', input];
  },
  useQuery(input: GetBallotPreviewInput) {
    const apiClient = useApiClient();
    return useQuery({
      queryKey: this.queryKey(input),
      queryFn: () => apiClient.getBallotPreviewPdf(input),
      staleTime: 0,
      gcTime: 0,
    });
  },
} as const;

export const getElectionPackage = {
  queryKey(electionId: Id): QueryKey {
    return ['getElectionPackage', electionId];
  },
  useQuery(electionId: Id) {
    const apiClient = useApiClient();
    return useQuery({
      queryKey: this.queryKey(electionId),
      queryFn: () => apiClient.getElectionPackage({ electionId }),
      // Poll if an export is in progress
      refetchInterval: (result) =>
        result?.state.data?.task?.completedAt ? 1000 : 0,
    });
  },
} as const;

export const exportElectionPackage = {
  useMutation() {
    const apiClient = useApiClient();
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: apiClient.exportElectionPackage,
      async onSuccess(_, { electionId }) {
        await queryClient.invalidateQueries({
          queryKey: getElectionPackage.queryKey(electionId),
        });
      },
    });
  },
} as const;

export const exportTestDecks = {
  useMutation() {
    const apiClient = useApiClient();
    return useMutation({ mutationFn: apiClient.exportTestDecks });
  },
} as const;
