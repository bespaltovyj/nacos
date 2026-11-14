/**
 * Config export API unit tests.
 * Verifies that config export goes through the axios client as a blob download
 * (replacing the previous window.open URL flow, see nacos#15954) and that the
 * download file name is parsed from the Content-Disposition header.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockClient = {
  get: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
};

vi.mock('../client', () => ({ default: mockClient }));

const { configApi, parseExportFileName } = await import('../config');

describe('Config export API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches export2 with blob response and no timeout', async () => {
    mockClient.get.mockResolvedValue({
      data: new Blob(['zip-content']),
      headers: {
        'content-disposition': 'attachment;filename=nacos_config_export_20240101120000.zip',
      },
    });

    const result = await configApi.export({ namespaceId: 'public', ids: '1,2' });

    expect(mockClient.get).toHaveBeenCalledWith('v3/console/cs/config/export2', {
      params: {
        namespaceId: 'public',
        ids: '1,2',
        groupName: '',
        appName: '',
        dataId: '',
      },
      timeout: 0,
      responseType: 'blob',
    });
    expect(result.filename).toBe('nacos_config_export_20240101120000.zip');
    expect(result.blob).toBeInstanceOf(Blob);
  });

  it('defaults ids to empty string and file name when header is missing', async () => {
    mockClient.get.mockResolvedValue({ data: new Blob(['zip-content']), headers: {} });

    const result = await configApi.export({ namespaceId: 'public' });

    const requestConfig = mockClient.get.mock.calls[0][1] as { params: { ids: string } };
    expect(requestConfig.params.ids).toBe('');
    expect(result.filename).toBe('nacos_config_export.zip');
  });
});

describe('parseExportFileName', () => {
  it('parses a plain filename', () => {
    expect(parseExportFileName('attachment;filename=export.zip')).toBe('export.zip');
  });

  it('parses a quoted filename', () => {
    expect(parseExportFileName('attachment;filename="my export.zip"')).toBe('my export.zip');
  });

  it('parses an RFC 5987 filename*', () => {
    expect(parseExportFileName("attachment;filename*=UTF-8''%E4%B8%AD%E6%96%87.zip")).toBe('中文.zip');
  });

  it('falls back to the default file name when the header is empty', () => {
    expect(parseExportFileName('')).toBe('nacos_config_export.zip');
  });
});
