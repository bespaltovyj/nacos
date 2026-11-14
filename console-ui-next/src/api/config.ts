import client from './client';
import type { AxiosResponse } from 'axios';
import type { ApiResult } from './types';
import type {
  Config,
  ConfigListParams,
  ConfigListResponse,
  ConfigCreateData,
  ConfigHistoryListResponse,
  ConfigHistory,
  ConflictPolicy,
  ConfigCloneItem,
  ConfigListenerInfo,
  ConfigBetaInfo,
} from '@/types/config';

export interface ExportFile {
  blob: Blob;
  filename: string;
}

const DEFAULT_EXPORT_FILE_NAME = 'nacos_config_export.zip';

/**
 * Parse the download file name from a Content-Disposition header, e.g.
 * `attachment;filename=nacos_config_export_20240101120000.zip`.
 */
export function parseExportFileName(disposition: string): string {
  const match = disposition.match(/filename\*?=(?:UTF-8''|")?([^";]+)"?/i);
  return match ? decodeURIComponent(match[1]) : DEFAULT_EXPORT_FILE_NAME;
}

export const configApi = {
  // List configs
  list: (params: ConfigListParams): ApiResult<ConfigListResponse> =>
    client.get('v3/console/cs/config/list', { params }) as ApiResult<ConfigListResponse>,

  // Advanced search with content
  searchDetail: (params: ConfigListParams): ApiResult<ConfigListResponse> =>
    client.get('v3/console/cs/config/searchDetail', { params }) as ApiResult<ConfigListResponse>,

  // Get single config
  get: (params: { dataId: string; groupName: string; namespaceId?: string }): ApiResult<Config> =>
    client.get('v3/console/cs/config', { params }) as ApiResult<Config>,

  // Create or update config
  publish: (data: ConfigCreateData): ApiResult<boolean> =>
    client.post('v3/console/cs/config', data) as ApiResult<boolean>,

  // Delete config
  delete: (params: { dataId: string; groupName: string; namespaceId?: string }): ApiResult<boolean> =>
    client.delete('v3/console/cs/config', { params }) as ApiResult<boolean>,

  // Batch delete
  batchDelete: (params: { ids: string; namespaceId: string }): ApiResult<boolean> =>
    client.delete('v3/console/cs/config/batchDelete', { params }) as ApiResult<boolean>,

  // History list
  historyList: (params: {
    dataId: string;
    groupName: string;
    namespaceId?: string;
    pageNo: number;
    pageSize: number;
  }): ApiResult<ConfigHistoryListResponse> =>
    client.get('v3/console/cs/history/list', { params }) as ApiResult<ConfigHistoryListResponse>,

  // History detail
  historyDetail: (params: {
    nid: string;
    dataId: string;
    groupName: string;
    namespaceId?: string;
  }): ApiResult<ConfigHistory> =>
    client.get('v3/console/cs/history', { params }) as ApiResult<ConfigHistory>,

  // Previous version
  historyPrevious: (params: {
    id: string;
    dataId: string;
    groupName: string;
    namespaceId?: string;
  }): ApiResult<ConfigHistory> =>
    client.get('v3/console/cs/history/previous', { params }) as ApiResult<ConfigHistory>,

  // Listeners by config
  listenersByConfig: (params: { dataId: string; groupName: string; namespaceId?: string }): ApiResult<ConfigListenerInfo> =>
    client.get('v3/console/cs/config/listener', { params }) as ApiResult<ConfigListenerInfo>,

  // Listeners by IP
  listenersByIp: (params: { ip: string; namespaceId?: string }): ApiResult<ConfigListenerInfo> =>
    client.get('v3/console/cs/config/listener/ip', { params }) as ApiResult<ConfigListenerInfo>,

  // Get beta config
  getBeta: (params: { dataId: string; groupName: string; namespaceId?: string }): ApiResult<ConfigBetaInfo> =>
    client.get('v3/console/cs/config/beta', { params }) as ApiResult<ConfigBetaInfo>,

  // Publish beta config (same endpoint, with betaIps header)
  publishBeta: (data: ConfigCreateData, betaIps: string): ApiResult<boolean> =>
    client.post('v3/console/cs/config', data, {
      headers: { betaIps },
    }) as ApiResult<boolean>,

  // Stop beta
  stopBeta: (params: { dataId: string; groupName: string; namespaceId?: string }): ApiResult<boolean> =>
    client.delete('v3/console/cs/config/beta', { params }) as ApiResult<boolean>,

  // Export - fetch configs ZIP via XHR so the request is visible in the browser Network console
  export: async (params: {
    namespaceId: string;
    ids?: string;
    groupName?: string;
    appName?: string;
    dataId?: string;
  }): Promise<ExportFile> => {
    const response = (await client.get('v3/console/cs/config/export2', {
      params: {
        namespaceId: params.namespaceId,
        ids: params.ids ?? '',
        groupName: params.groupName || '',
        appName: params.appName || '',
        dataId: params.dataId || '',
      },
      // Large exports can exceed the default 10s client timeout
      timeout: 0,
      responseType: 'blob',
    })) as unknown as AxiosResponse<Blob>;
    const disposition: string = response.headers?.['content-disposition'] || '';
    return { blob: response.data, filename: parseExportFileName(disposition) };
  },

  // Trigger a browser download for an exported file
  downloadBlob: (blob: Blob, filename: string): void => {
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(blobUrl);
  },

  // Import - POST multipart/form-data (ZIP file)
  importFile: (namespaceId: string, policy: ConflictPolicy, file: File): ApiResult<unknown> => {
    const formData = new FormData();
    formData.append('file', file);
    // Add auth params
    let username = '';
    let accessToken = '';
    try {
      const tokenStr = localStorage.getItem('token');
      if (tokenStr) {
        const tokenData = JSON.parse(tokenStr);
        accessToken = tokenData.accessToken || '';
        username = tokenData.username || '';
      }
    } catch { /* ignore */ }
    return client.post('v3/console/cs/config/import', formData, {
      params: { namespaceId, policy, accessToken, username },
      headers: { 'Content-Type': 'multipart/form-data' },
    }) as ApiResult<unknown>;
  },

  // Clone - POST JSON body
  clone: (params: { namespaceId: string; targetNamespaceId: string; policy: ConflictPolicy }, configs: ConfigCloneItem[]): ApiResult<unknown> =>
    client.post('v3/console/cs/config/clone', JSON.stringify(configs), {
      params: {
        targetNamespaceId: params.targetNamespaceId,
        policy: params.policy,
        namespaceId: params.namespaceId,
      },
      headers: { 'Content-Type': 'application/json' },
    }) as ApiResult<unknown>,
};
