export type ImmichAlbum = { id: string; albumName: string; assetCount?: number };

export function normalizeServerUrl(input: string) {
  let value = input.trim();
  if (!value) return '';
  if (!/^https?:\/\//i.test(value)) value = `http://${value}`;
  try {
    const url = new URL(value);
    url.pathname = url.pathname.replace(/\/+$/, '').replace(/\/api$/i, '');
    url.search = '';
    url.hash = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return value.replace(/\/+$/, '').replace(/\/api$/i, '');
  }
}

export function normalizeApiKey(input: string) {
  return input.trim();
}

export async function getAlbums(serverUrl: string, apiKey: string): Promise<ImmichAlbum[]> {
  const server = normalizeServerUrl(serverUrl);
  const key = normalizeApiKey(apiKey);
  if (!server || !key) throw new Error('Immich server and API key are required.');
  const response = await fetch(`${server}/api/albums`, {
    headers: { Accept: 'application/json', 'x-api-key': key },
  });
  if (!response.ok) throw new Error(`Immich returned HTTP ${response.status}`);
  return response.json();
}
