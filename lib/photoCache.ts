import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ImmichAsset, originalUrl } from './immich';

const INDEX_KEY = 'frameo.photoCache.index.v1';
const DIR = `${FileSystem.cacheDirectory || ''}frameo-photos/`;
type CacheIndex = Record<string, string>;

async function readIndex(): Promise<CacheIndex> {
  try { return JSON.parse((await AsyncStorage.getItem(INDEX_KEY)) || '{}'); } catch { return {}; }
}
async function writeIndex(index: CacheIndex) { await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(index)); }

export async function cacheAlbumPhotos(serverUrl: string, apiKey: string, assets: ImmichAsset[], onProgress?: (done: number, total: number) => void) {
  if (Platform.OS === 'web' || !FileSystem.cacheDirectory) return new Map<string, string>();
  await FileSystem.makeDirectoryAsync(DIR, { intermediates: true }).catch(() => undefined);
  const index = await readIndex();
  const wanted = new Set(assets.map(a => a.id));
  const result = new Map<string, string>();
  let done = 0;
  for (const asset of assets) {
    const filename = `${asset.id}.jpg`;
    const uri = `${DIR}${filename}`;
    try {
      const info = await FileSystem.getInfoAsync(uri);
      if (!info.exists) {
        await FileSystem.downloadAsync(originalUrl(serverUrl, asset.id), uri, { headers: { 'x-api-key': apiKey.trim() } });
      }
      result.set(asset.id, uri);
      index[asset.id] = uri;
    } catch {
      const oldUri = index[asset.id];
      if (oldUri) {
        const oldInfo = await FileSystem.getInfoAsync(oldUri).catch(() => ({ exists: false } as any));
        if (oldInfo.exists) result.set(asset.id, oldUri);
      }
    }
    done += 1; onProgress?.(done, assets.length);
  }
  for (const [id, uri] of Object.entries(index)) {
    if (!wanted.has(id)) {
      await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => undefined);
      delete index[id];
    }
  }
  await writeIndex(index);
  return result;
}

export async function clearPhotoCache() {
  if (Platform.OS !== 'web' && FileSystem.cacheDirectory) await FileSystem.deleteAsync(DIR, { idempotent: true }).catch(() => undefined);
  await AsyncStorage.removeItem(INDEX_KEY);
}
