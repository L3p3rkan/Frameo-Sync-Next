export type ImmichAlbum = { id: string; albumName: string; assetCount?: number };
export type ImmichAsset = { id: string; originalFileName?: string; createdAt?: string; width?: number; height?: number; type?: string };

export function normalizeServerUrl(input: string) {
  let value = input.trim(); if (!value) return '';
  if (!/^https?:\/\//i.test(value)) value = `http://${value}`;
  try { const url = new URL(value); url.pathname = url.pathname.replace(/\/+$/, '').replace(/\/api$/i, ''); url.search = ''; url.hash = ''; return url.toString().replace(/\/$/, ''); }
  catch { return value.replace(/\/+$/, '').replace(/\/api$/i, ''); }
}
export function normalizeApiKey(input: string) { return input.trim(); }
function headers(key: string, json = false) { return { Accept: 'application/json', ...(json ? { 'Content-Type': 'application/json' } : {}), 'x-api-key': normalizeApiKey(key) }; }

export async function getAlbums(serverUrl: string, apiKey: string): Promise<ImmichAlbum[]> {
  const server = normalizeServerUrl(serverUrl); const key = normalizeApiKey(apiKey);
  if (!server || !key) throw new Error('Immich server and API key are required.');
  const response = await fetch(`${server}/api/albums`, { headers: headers(key) });
  if (!response.ok) throw new Error(`Immich returned HTTP ${response.status}`);
  return response.json();
}

// Immich v3 no longer includes album assets in GET /albums/:id. Use the metadata
// search endpoint with albumIds instead. The response is paginated, so collect
// every page rather than silently showing only the first page.
export async function getAlbumAssets(serverUrl: string, apiKey: string, albumId: string): Promise<ImmichAsset[]> {
  const server = normalizeServerUrl(serverUrl); const key = normalizeApiKey(apiKey);
  if (!server || !key || !albumId) throw new Error('Immich server, API key, and album are required.');

  const assets: ImmichAsset[] = [];
  let page = 1;
  const size = 250;

  while (true) {
    const response = await fetch(`${server}/api/search/metadata`, {
      method: 'POST',
      headers: headers(key, true),
      body: JSON.stringify({ albumIds: [albumId], page, size }),
    });
    if (!response.ok) throw new Error(`Immich returned HTTP ${response.status}`);

    const data = await response.json();
    const items: ImmichAsset[] = data?.assets?.items || [];
    assets.push(...items);

    if (items.length < size || !data?.assets?.nextPage) break;
    page += 1;
  }

  return assets;
}
export function thumbnailUrl(serverUrl: string, assetId: string) { return `${normalizeServerUrl(serverUrl)}/api/assets/${encodeURIComponent(assetId)}/thumbnail?size=preview`; }
export function originalUrl(serverUrl: string, assetId: string) { return `${normalizeServerUrl(serverUrl)}/api/assets/${encodeURIComponent(assetId)}/original`; }
