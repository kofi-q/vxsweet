import React from 'react';
import { deepEqual } from '@vx/libs/basics/objects';
import { type Api } from '../../backend/app/app';
import {
  AUTH_STATUS_POLLING_INTERVAL_MS,
  QUERY_CLIENT_DEFAULT_OPTIONS,
} from '@vx/libs/ui/src';
import { USB_DRIVE_STATUS_POLLING_INTERVAL_MS } from '@vx/libs/ui/usb';
import { createSystemCallApi } from '@vx/libs/ui/system-calls';
import {
  QueryClient,
  QueryKey,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import * as grout from '@vx/libs/grout/src';
import { type UsbDriveStatus } from '@vx/libs/usb-drive/src';

const PRINTER_STATUS_POLLING_INTERVAL_MS = 100;

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
  return new QueryClient({ defaultOptions: QUERY_CLIENT_DEFAULT_OPTIONS });
}

export const getMachineConfig = {
  queryKeyPrefix: 'getMachineConfig',
  queryKey(): QueryKey {
    return [this.queryKeyPrefix];
  },
  useQuery() {
    const apiClient = useApiClient();
    return useQuery({
      queryKey: this.queryKey(),
      queryFn: () => apiClient.getMachineConfig(),
    });
  },
} as const;

// Auth

export const getAuthStatus = {
  queryKeyPrefix: 'getAuthStatus',
  queryKey(): QueryKey {
    return [this.queryKeyPrefix];
  },
  useQuery() {
    const apiClient = useApiClient();
    return useQuery({
      queryKey: this.queryKey(),
      queryFn: () => apiClient.getAuthStatus(),
      refetchInterval: AUTH_STATUS_POLLING_INTERVAL_MS,
      structuralSharing(oldData, newData) {
        if (!oldData) {
          return newData;
        }

        // Prevent infinite re-renders of the app tree:
        const isUnchanged = deepEqual(oldData, newData);
        return isUnchanged ? oldData : newData;
      },
    });
  },
} as const;

export const checkPin = {
  useMutation() {
    const apiClient = useApiClient();
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: apiClient.checkPin,
      async onSuccess() {
        // Because we poll auth status with high frequency, this invalidation isn't strictly
        // necessary
        await queryClient.invalidateQueries({
          queryKey: getAuthStatus.queryKey(),
        });
      },
    });
  },
} as const;

export const logOut = {
  useMutation() {
    const apiClient = useApiClient();
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: apiClient.logOut,
      async onSuccess() {
        // Because we poll auth status with high frequency, this invalidation isn't strictly
        // necessary
        await queryClient.invalidateQueries({
          queryKey: getAuthStatus.queryKey(),
        });
      },
    });
  },
} as const;

export const updateSessionExpiry = {
  useMutation() {
    const apiClient = useApiClient();
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: apiClient.updateSessionExpiry,
      async onSuccess() {
        // Because we poll auth status with high frequency, this invalidation isn't strictly
        // necessary
        await queryClient.invalidateQueries({
          queryKey: getAuthStatus.queryKey(),
        });
      },
    });
  },
} as const;

export const programCard = {
  useMutation() {
    const apiClient = useApiClient();
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: apiClient.programCard,
      async onSuccess() {
        // Because we poll auth status with high frequency, this invalidation isn't strictly
        // necessary
        await queryClient.invalidateQueries({
          queryKey: getAuthStatus.queryKey(),
        });
      },
    });
  },
} as const;

export const unprogramCard = {
  useMutation() {
    const apiClient = useApiClient();
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: apiClient.unprogramCard,
      async onSuccess() {
        // Because we poll auth status with high frequency, this invalidation isn't strictly
        // necessary
        await queryClient.invalidateQueries({
          queryKey: getAuthStatus.queryKey(),
        });
      },
    });
  },
} as const;

export const getPrinterStatus = {
  queryKey(): QueryKey {
    return ['getPrinterStatus'];
  },
  useQuery() {
    const apiClient = useApiClient();
    return useQuery({
      queryKey: this.queryKey(),
      queryFn: () => apiClient.getPrinterStatus(),
      refetchInterval: PRINTER_STATUS_POLLING_INTERVAL_MS,
    });
  },
} as const;

// USB

export const getUsbDriveStatus = {
  queryKey(): QueryKey {
    return ['getUsbDriveStatus'];
  },
  useQuery() {
    const apiClient = useApiClient();
    return useQuery({
      queryKey: this.queryKey(),
      queryFn: () => apiClient.getUsbDriveStatus(),
      refetchInterval: USB_DRIVE_STATUS_POLLING_INTERVAL_MS,
      structuralSharing(oldData, newData) {
        if (!oldData) {
          return newData;
        }

        // Prevent unnecessary re-renders of dependent components
        const isUnchanged = deepEqual(oldData, newData);
        return isUnchanged ? oldData : newData;
      },
    });
  },
} as const;

export const ejectUsbDrive = {
  useMutation() {
    const apiClient = useApiClient();
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: apiClient.ejectUsbDrive,
      async onSuccess() {
        await queryClient.invalidateQueries({
          queryKey: getUsbDriveStatus.queryKey(),
        });
      },
    });
  },
} as const;

export const formatUsbDrive = {
  useMutation() {
    const apiClient = useApiClient();
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: apiClient.formatUsbDrive,
      async onSuccess() {
        await queryClient.invalidateQueries({
          queryKey: getUsbDriveStatus.queryKey(),
        });
      },
    });
  },
} as const;

// Queries

type QueryInput<Method extends keyof ApiClient> = Parameters<
  ApiClient[Method]
>[0];

export const getCurrentElectionMetadata = {
  queryKey(): QueryKey {
    return ['getCurrentElectionMetadata'];
  },
  useQuery() {
    const apiClient = useApiClient();
    return useQuery({
      queryKey: this.queryKey(),
      queryFn: () => apiClient.getCurrentElectionMetadata(),
    });
  },
} as const;

export const listCastVoteRecordFilesOnUsb = {
  queryKey(): QueryKey {
    return ['listCastVoteRecordFilesOnUsb'];
  },
  useQuery() {
    const apiClient = useApiClient();
    return useQuery({
      queryKey: this.queryKey(),
      queryFn: () => apiClient.listCastVoteRecordFilesOnUsb(),
    });
  },
} as const;

export const getCastVoteRecordFiles = {
  queryKey(): QueryKey {
    return ['getCastVoteRecordFiles'];
  },
  useQuery() {
    const apiClient = useApiClient();
    return useQuery({
      queryKey: this.queryKey(),
      queryFn: () => apiClient.getCastVoteRecordFiles(),
    });
  },
} as const;

export const getCastVoteRecordFileMode = {
  queryKey(): QueryKey {
    return ['getCastVoteRecordFileMode'];
  },
  useQuery() {
    const apiClient = useApiClient();
    return useQuery({
      queryKey: this.queryKey(),
      queryFn: () => apiClient.getCastVoteRecordFileMode(),
    });
  },
} as const;

type GetWriteInAdjudicationQueueInput =
  QueryInput<'getWriteInAdjudicationQueue'>;
export const getWriteInAdjudicationQueue = {
  queryKey(input?: GetWriteInAdjudicationQueueInput): QueryKey {
    return input
      ? ['getWriteInAdjudicationQueue', input]
      : ['getWriteInAdjudicationQueue'];
  },
  useQuery(input: GetWriteInAdjudicationQueueInput) {
    const apiClient = useApiClient();
    return useQuery({
      queryKey: this.queryKey(input),
      queryFn: () => apiClient.getWriteInAdjudicationQueue(input),
    });
  },
} as const;

type GetFirstPendingWriteInIdInput = QueryInput<'getFirstPendingWriteInId'>;
export const getFirstPendingWriteInId = {
  queryKey(input?: GetFirstPendingWriteInIdInput): QueryKey {
    return input
      ? ['getFirstPendingWriteInId', input]
      : ['getFirstPendingWriteInId'];
  },
  useQuery(input: GetFirstPendingWriteInIdInput) {
    const apiClient = useApiClient();
    return useQuery({
      queryKey: this.queryKey(input),
      queryFn: () => apiClient.getFirstPendingWriteInId(input),
      gcTime: 0,
    });
  },
} as const;

type GetWriteInAdjudicationQueueMetadataInput =
  QueryInput<'getWriteInAdjudicationQueueMetadata'>;
export const getWriteInAdjudicationQueueMetadata = {
  queryKey(input?: GetWriteInAdjudicationQueueMetadataInput): QueryKey {
    return input
      ? ['getWriteInAdjudicationQueueMetadata', input]
      : ['getWriteInAdjudicationQueueMetadata'];
  },
  useQuery(input?: GetWriteInAdjudicationQueueMetadataInput) {
    const apiClient = useApiClient();
    return useQuery({
      queryKey: this.queryKey(input),
      queryFn: () => apiClient.getWriteInAdjudicationQueueMetadata(input),
    });
  },
} as const;

type GetWriteInCandidatesInput = QueryInput<'getWriteInCandidates'>;
export const getWriteInCandidates = {
  queryKey(input?: GetWriteInCandidatesInput): QueryKey {
    return input ? ['getWriteInCandidates', input] : ['getWriteInCandidates'];
  },
  useQuery(input?: GetWriteInCandidatesInput) {
    const apiClient = useApiClient();
    return useQuery({
      queryKey: this.queryKey(input),
      queryFn: () => apiClient.getWriteInCandidates(input),
    });
  },
} as const;

type GetWriteInImageViewInput = QueryInput<'getWriteInImageView'>;
export const getWriteInImageView = {
  queryKey(input?: GetWriteInImageViewInput): QueryKey {
    return input
      ? ['getWriteInImageView', input.writeInId]
      : ['getWriteInImageView'];
  },
  useQuery(input: GetWriteInImageViewInput, enabled = true) {
    const apiClient = useApiClient();
    return useQuery({
      queryKey: this.queryKey(input),
      queryFn: () =>
        apiClient.getWriteInImageView({ writeInId: input.writeInId }),
      enabled,
    });
  },
} as const;

type GetWriteInAdjudicationContextInput =
  QueryInput<'getWriteInAdjudicationContext'>;
export const getWriteInAdjudicationContext = {
  queryKey(input?: GetWriteInAdjudicationContextInput): QueryKey {
    return input
      ? ['getWriteInAdjudicationContext', input.writeInId]
      : ['getWriteInAdjudicationContext'];
  },
  useQuery(input: GetWriteInAdjudicationContextInput, enabled = true) {
    const apiClient = useApiClient();
    return useQuery({
      queryKey: this.queryKey(input),
      queryFn: () =>
        apiClient.getWriteInAdjudicationContext({ writeInId: input.writeInId }),
      enabled,
    });
  },
} as const;

export const getSystemSettings = {
  queryKey(): QueryKey {
    return ['getSystemSettings'];
  },
  useQuery() {
    const apiClient = useApiClient();
    return useQuery({
      queryKey: this.queryKey(),
      queryFn: () => apiClient.getSystemSettings(),
    });
  },
} as const;

type GetManualResultsInput = QueryInput<'getManualResults'>;
export const getManualResults = {
  queryKey(input?: GetManualResultsInput): QueryKey {
    return input ? ['getManualResults', input] : ['getManualResults'];
  },
  useQuery(input: GetManualResultsInput) {
    const apiClient = useApiClient();
    return useQuery({
      queryKey: this.queryKey(input),
      queryFn: () => apiClient.getManualResults(input),
    });
  },
} as const;

export const getManualResultsMetadata = {
  queryKey(): QueryKey {
    return ['getManualResultsMetadata'];
  },
  useQuery() {
    const apiClient = useApiClient();
    return useQuery({
      queryKey: this.queryKey(),
      queryFn: () => apiClient.getManualResultsMetadata(),
    });
  },
} as const;

export const getTotalBallotCount = {
  queryKey(): QueryKey {
    return ['getTotalBallotCount'];
  },
  useQuery() {
    const apiClient = useApiClient();
    return useQuery({
      queryKey: this.queryKey(),
      queryFn: () => apiClient.getTotalBallotCount(),
    });
  },
} as const;

export const getScannerBatches = {
  queryKey(): QueryKey {
    return ['getScannerBatches'];
  },
  useQuery() {
    const apiClient = useApiClient();
    return useQuery({
      queryKey: this.queryKey(),
      queryFn: () => apiClient.getScannerBatches(),
    });
  },
} as const;

export const listPotentialElectionPackagesOnUsbDrive = {
  // Refetch if USB drive status changes
  queryKey(usbDriveStatus: UsbDriveStatus): QueryKey {
    return ['listPotentialElectionPackagesOnUsbDrive', usbDriveStatus];
  },
  useQuery(usbDriveStatus: UsbDriveStatus) {
    const apiClient = useApiClient();
    return useQuery({
      queryKey: this.queryKey(usbDriveStatus),
      queryFn: () => apiClient.listPotentialElectionPackagesOnUsbDrive(),
      staleTime: 0,
    });
  },
} as const;

type GetTallyReportPreviewInput = QueryInput<'getTallyReportPreview'>;
export const getTallyReportPreview = {
  queryKey(input?: GetTallyReportPreviewInput): QueryKey {
    return input ? ['getTallyReportPreview', input] : ['getTallyReportPreview'];
  },
  useQuery(
    input: GetTallyReportPreviewInput,
    options: { enabled: boolean } = { enabled: true }
  ) {
    const apiClient = useApiClient();
    return useQuery({
      queryKey: this.queryKey(input),
      queryFn: () => apiClient.getTallyReportPreview(input),
      gcTime: 0,
      staleTime: 0,
      refetchOnWindowFocus: false,
      ...options,
    });
  },
} as const;

type GetBallotCountReportPreviewInput =
  QueryInput<'getBallotCountReportPreview'>;
export const getBallotCountReportPreview = {
  queryKey(input?: GetBallotCountReportPreviewInput): QueryKey {
    return input
      ? ['getBallotCountReportPreview', input]
      : ['getBallotCountReportPreview'];
  },
  useQuery(
    input: GetBallotCountReportPreviewInput,
    options: { enabled: boolean } = { enabled: true }
  ) {
    const apiClient = useApiClient();
    return useQuery({
      queryKey: this.queryKey(input),
      queryFn: () => apiClient.getBallotCountReportPreview(input),
      gcTime: 0,
      staleTime: 0,
      refetchOnWindowFocus: false,
      ...options,
    });
  },
} as const;

export const getWriteInAdjudicationReportPreview = {
  queryKey(): QueryKey {
    return ['getWriteInAdjudicationReportPreview'];
  },
  useQuery() {
    const apiClient = useApiClient();
    return useQuery({
      queryKey: this.queryKey(),
      queryFn: () => apiClient.getWriteInAdjudicationReportPreview(),
      gcTime: 0,
      staleTime: 0,
      refetchOnWindowFocus: false,
    });
  },
} as const;

export const getMostRecentPrinterDiagnostic = {
  queryKey(): QueryKey {
    return ['getDiagnosticRecords'];
  },
  useQuery() {
    const apiClient = useApiClient();
    return useQuery({
      queryKey: this.queryKey(),
      queryFn: () => apiClient.getMostRecentPrinterDiagnostic(),
    });
  },
} as const;

export const getApplicationDiskSpaceSummary = {
  queryKey(): QueryKey {
    return ['getApplicationDiskSpaceSummary'];
  },
  useQuery() {
    const apiClient = useApiClient();
    return useQuery({
      queryKey: this.queryKey(),
      queryFn: () => apiClient.getApplicationDiskSpaceSummary(),
      // disk space availability could change between queries for a variety
      // reasons, so always treat it as stale
      staleTime: 0,
    });
  },
} as const;

// Grouped Invalidations

function invalidateCastVoteRecordQueries(queryClient: QueryClient) {
  return Promise.all([
    // cast vote record endpoints
    queryClient.invalidateQueries({
      queryKey: getCastVoteRecordFileMode.queryKey(),
    }),
    queryClient.invalidateQueries({
      queryKey: getCastVoteRecordFiles.queryKey(),
    }),

    // scanner batches are generated from cast vote records
    queryClient.invalidateQueries({ queryKey: getScannerBatches.queryKey() }),

    // total ballot count may be affected
    queryClient.invalidateQueries({ queryKey: getTotalBallotCount.queryKey() }),

    // write-in queues
    queryClient.invalidateQueries({
      queryKey: getWriteInAdjudicationQueue.queryKey(),
    }),
  ]);
}

function invalidateWriteInQueries(queryClient: QueryClient) {
  const invalidations = [
    // write-in endpoints
    queryClient.invalidateQueries({
      queryKey: getWriteInAdjudicationContext.queryKey(),
    }),
    queryClient.invalidateQueries({
      queryKey: getWriteInCandidates.queryKey(),
    }),
    queryClient.invalidateQueries({
      queryKey: getWriteInAdjudicationQueueMetadata.queryKey(),
    }),
  ];

  return Promise.all(invalidations);
}

function invalidateManualResultsQueries(queryClient: QueryClient) {
  return Promise.all([
    // manual results queries
    queryClient.invalidateQueries({ queryKey: getManualResults.queryKey() }),
    queryClient.invalidateQueries({
      queryKey: getManualResultsMetadata.queryKey(),
    }),

    // total ballot count may be affected
    queryClient.invalidateQueries({ queryKey: getTotalBallotCount.queryKey() }),
  ]);
}

// Mutations

export const configure = {
  useMutation() {
    const apiClient = useApiClient();
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: apiClient.configure,
      async onSuccess() {
        await queryClient.invalidateQueries({
          queryKey: getCurrentElectionMetadata.queryKey(),
        });
        await queryClient.invalidateQueries({
          queryKey: getSystemSettings.queryKey(),
        });
      },
    });
  },
} as const;

export const unconfigure = {
  useMutation() {
    const apiClient = useApiClient();
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: apiClient.unconfigure,
      async onSuccess() {
        // If we configure with a different election, any data in the cache will
        // correspond to the previous election, so we don't just invalidate, but
        // reset all queries to clear their cached data, since invalidated
        // queries may still return stale data while refetching.
        await queryClient.resetQueries();
      },
    });
  },
} as const;

export const markResultsOfficial = {
  useMutation() {
    const apiClient = useApiClient();
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: apiClient.markResultsOfficial,
      async onSuccess() {
        await queryClient.invalidateQueries({
          queryKey: getCurrentElectionMetadata.queryKey(),
        });
      },
    });
  },
} as const;

export const clearCastVoteRecordFiles = {
  useMutation() {
    const apiClient = useApiClient();
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: apiClient.clearCastVoteRecordFiles,
      async onSuccess() {
        return Promise.all([
          invalidateCastVoteRecordQueries(queryClient),
          invalidateWriteInQueries(queryClient),
          queryClient.invalidateQueries({
            queryKey: getCurrentElectionMetadata.queryKey(),
          }),
        ]);
      },
    });
  },
} as const;

export const addCastVoteRecordFile = {
  useMutation() {
    const apiClient = useApiClient();
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: apiClient.addCastVoteRecordFile,
      async onSuccess() {
        await invalidateCastVoteRecordQueries(queryClient);
        await invalidateWriteInQueries(queryClient);
      },
    });
  },
} as const;

export const importElectionResultsReportingFile = {
  useMutation() {
    const apiClient = useApiClient();
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: apiClient.importElectionResultsReportingFile,
      async onSuccess() {
        // The backend treats ERR files like manual results
        await invalidateManualResultsQueries(queryClient);
        await invalidateWriteInQueries(queryClient);
      },
    });
  },
} as const;

export const setManualResults = {
  useMutation() {
    const apiClient = useApiClient();
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: apiClient.setManualResults,
      async onSuccess() {
        await invalidateManualResultsQueries(queryClient);
        await invalidateWriteInQueries(queryClient);
      },
    });
  },
} as const;

export const deleteAllManualResults = {
  useMutation() {
    const apiClient = useApiClient();
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: apiClient.deleteAllManualResults,
      async onSuccess() {
        await invalidateManualResultsQueries(queryClient);
        await queryClient.invalidateQueries({
          queryKey: getWriteInCandidates.queryKey(),
        });
      },
    });
  },
} as const;

export const deleteManualResults = {
  useMutation() {
    const apiClient = useApiClient();
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: apiClient.deleteManualResults,
      async onSuccess() {
        await invalidateManualResultsQueries(queryClient);
        await queryClient.invalidateQueries({
          queryKey: getWriteInCandidates.queryKey(),
        });
      },
    });
  },
} as const;

export const addWriteInCandidate = {
  useMutation() {
    const apiClient = useApiClient();
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: apiClient.addWriteInCandidate,
      async onSuccess() {
        await queryClient.invalidateQueries({
          queryKey: getWriteInCandidates.queryKey(),
        });
      },
    });
  },
} as const;

export const adjudicateWriteIn = {
  useMutation() {
    const apiClient = useApiClient();
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: apiClient.adjudicateWriteIn,
      async onSuccess() {
        await invalidateWriteInQueries(queryClient);
      },
    });
  },
} as const;

export const saveElectionPackageToUsb = {
  useMutation() {
    const apiClient = useApiClient();
    return useMutation({ mutationFn: apiClient.saveElectionPackageToUsb });
  },
} as const;

export const printTallyReport = {
  useMutation() {
    const apiClient = useApiClient();
    return useMutation({ mutationFn: apiClient.printTallyReport });
  },
} as const;

export const exportTallyReportPdf = {
  useMutation() {
    const apiClient = useApiClient();
    return useMutation({ mutationFn: apiClient.exportTallyReportPdf });
  },
} as const;

export const exportTallyReportCsv = {
  useMutation() {
    const apiClient = useApiClient();
    return useMutation({ mutationFn: apiClient.exportTallyReportCsv });
  },
} as const;

export const exportCdfElectionResultsReport = {
  useMutation() {
    const apiClient = useApiClient();
    return useMutation({
      mutationFn: apiClient.exportCdfElectionResultsReport,
    });
  },
} as const;

export const printBallotCountReport = {
  useMutation() {
    const apiClient = useApiClient();
    return useMutation({ mutationFn: apiClient.printBallotCountReport });
  },
} as const;

export const exportBallotCountReportPdf = {
  useMutation() {
    const apiClient = useApiClient();
    return useMutation({ mutationFn: apiClient.exportBallotCountReportPdf });
  },
} as const;

export const exportBallotCountReportCsv = {
  useMutation() {
    const apiClient = useApiClient();
    return useMutation({ mutationFn: apiClient.exportBallotCountReportCsv });
  },
} as const;

export const printWriteInAdjudicationReport = {
  useMutation() {
    const apiClient = useApiClient();
    return useMutation({
      mutationFn: apiClient.printWriteInAdjudicationReport,
    });
  },
} as const;

export const exportWriteInAdjudicationReportPdf = {
  useMutation() {
    const apiClient = useApiClient();
    return useMutation({
      mutationFn: apiClient.exportWriteInAdjudicationReportPdf,
    });
  },
} as const;

export const addDiagnosticRecord = {
  useMutation() {
    const queryClient = useQueryClient();
    const apiClient = useApiClient();
    return useMutation({
      mutationFn: apiClient.addDiagnosticRecord,
      async onSuccess() {
        await queryClient.invalidateQueries({
          queryKey: getMostRecentPrinterDiagnostic.queryKey(),
        });
      },
    });
  },
} as const;

export const printTestPage = {
  useMutation() {
    const apiClient = useApiClient();
    return useMutation({ mutationFn: apiClient.printTestPage });
  },
} as const;

export const saveReadinessReport = {
  useMutation() {
    const apiClient = useApiClient();
    return useMutation({ mutationFn: apiClient.saveReadinessReport });
  },
} as const;

export const systemCallApi = createSystemCallApi(useApiClient);
