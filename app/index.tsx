import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAlbumAssets, getAlbums, ImmichAlbum, ImmichAsset, normalizeServerUrl, originalUrl, thumbnailUrl } from '../lib/immich';

const SERVER_KEY = 'frameo.serverUrl';
const API_KEY = 'frameo.apiKey';
const ALBUM_KEY = 'frameo.albumId';
const ALBUM_NAME_KEY = 'frameo.albumName';
const SLIDE_SECONDS = 10;
const REFRESH_SECONDS = 60;

async function getStoredApiKey() {
  return Platform.OS === 'web' ? AsyncStorage.getItem(API_KEY) : SecureStore.getItemAsync(API_KEY);
}

async function storeApiKey(value: string) {
  return Platform.OS === 'web' ? AsyncStorage.setItem(API_KEY, value) : SecureStore.setItemAsync(API_KEY, value);
}

export default function HomeScreen() {
  const { width } = useWindowDimensions();
  const [serverUrl, setServerUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [albums, setAlbums] = useState<ImmichAlbum[]>([]);
  const [assets, setAssets] = useState<ImmichAsset[]>([]);
  const [selectedAlbum, setSelectedAlbum] = useState('');
  const [selectedAlbumName, setSelectedAlbumName] = useState('');
  const [viewer, setViewer] = useState<ImmichAsset | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [loadingAlbums, setLoadingAlbums] = useState(false);
  const [slideshow, setSlideshow] = useState(false);
  const [slideIndex, setSlideIndex] = useState(0);
  const [autoPlay, setAutoPlay] = useState(true);
  const refreshTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const slideTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const assetIds = useRef<string[]>([]);

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(SERVER_KEY),
      getStoredApiKey(),
      AsyncStorage.getItem(ALBUM_KEY),
      AsyncStorage.getItem(ALBUM_NAME_KEY),
    ]).then(([server, key, album, name]) => {
      setServerUrl(server || '');
      setApiKey(key || '');
      setSelectedAlbum(album || '');
      setSelectedAlbumName(name || '');
    }).finally(() => setBusy(false));
  }, []);

  useEffect(() => {
    if (selectedAlbum && serverUrl && apiKey) loadPhotos();
  }, [selectedAlbum]);

  useEffect(() => {
    assetIds.current = assets.map((asset) => asset.id);
    if (slideIndex >= assets.length && assets.length > 0) setSlideIndex(0);
  }, [assets, slideIndex]);

  useEffect(() => {
    if (!slideshow || !autoPlay || assets.length < 2) return;
    slideTimer.current = setInterval(() => {
      setSlideIndex((index) => (index + 1) % assets.length);
    }, SLIDE_SECONDS * 1000);
    return () => {
      if (slideTimer.current) clearInterval(slideTimer.current);
    };
  }, [slideshow, autoPlay, assets.length]);

  useEffect(() => {
    if (!slideshow || !selectedAlbum || !serverUrl || !apiKey) return;

    const poll = async () => {
      try {
        const fresh = await getAlbumAssets(serverUrl, apiKey, selectedAlbum);
        const oldIds = assetIds.current;
        const newIds = fresh.map((asset) => asset.id);
        const currentId = oldIds[slideIndex];
        const nextIndex = currentId ? Math.max(0, newIds.indexOf(currentId)) : 0;
        setAssets(fresh);
        if (currentId) setSlideIndex(nextIndex);
        if (fresh.length !== oldIds.length) {
          setStatus(`${fresh.length} photos • updated from Immich`);
        }
      } catch (error) {
        setStatus(error instanceof Error ? `Refresh failed: ${error.message}` : 'Refresh failed.');
      }
    };

    refreshTimer.current = setInterval(poll, REFRESH_SECONDS * 1000);
    return () => {
      if (refreshTimer.current) clearInterval(refreshTimer.current);
    };
  }, [slideshow, selectedAlbum, serverUrl, apiKey, slideIndex]);

  async function connect() {
    const server = normalizeServerUrl(serverUrl);
    const key = apiKey.trim();
    if (!server || !key) {
      setStatus('Enter both the Immich server and API key.');
      return;
    }
    setBusy(true);
    try {
      const foundAlbums = await getAlbums(server, key);
      await AsyncStorage.setItem(SERVER_KEY, server);
      await storeApiKey(key);
      setServerUrl(server);
      setApiKey(key);
      setAlbums(foundAlbums);
      setStatus(`Connected. Found ${foundAlbums.length} album${foundAlbums.length === 1 ? '' : 's'}.`);
      if (selectedAlbum) await loadPhotos(server, key, selectedAlbum);
    } catch (error) {
      setStatus(error instanceof Error ? `Connection failed: ${error.message}` : 'Connection failed.');
    } finally {
      setBusy(false);
    }
  }

  async function loadPhotos(server = serverUrl, key = apiKey, album = selectedAlbum) {
    if (!server || !key || !album) return;
    setLoadingPhotos(true);
    try {
      const photos = await getAlbumAssets(server, key, album);
      setAssets(photos);
      setSlideIndex((index) => Math.min(index, Math.max(0, photos.length - 1)));
      setStatus(`${photos.length} photo${photos.length === 1 ? '' : 's'} in ${selectedAlbumName || 'selected album'}.`);
    } catch (error) {
      setStatus(error instanceof Error ? `Could not load photos: ${error.message}` : 'Could not load photos.');
    } finally {
      setLoadingPhotos(false);
    }
  }

  async function chooseAlbum(album: ImmichAlbum) {
    setSlideshow(false);
    setSelectedAlbum(album.id);
    setSelectedAlbumName(album.albumName);
    await AsyncStorage.setItem(ALBUM_KEY, album.id);
    await AsyncStorage.setItem(ALBUM_NAME_KEY, album.albumName);
    setStatus(`Loading ${album.albumName}…`);
    await loadPhotos(serverUrl, apiKey, album.id);
  }

  async function refreshAlbums() {
    setLoadingAlbums(true);
    try {
      const foundAlbums = await getAlbums(serverUrl, apiKey);
      setAlbums(foundAlbums);
      setStatus(`Loaded ${foundAlbums.length} album${foundAlbums.length === 1 ? '' : 's'}.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not load albums.');
    } finally {
      setLoadingAlbums(false);
    }
  }

  function startSlideshow() {
    if (!assets.length) {
      setStatus('The selected album has no photos.');
      return;
    }
    setSlideIndex(0);
    setAutoPlay(true);
    setSlideshow(true);
  }

  const columns = width >= 900 ? 5 : width >= 600 ? 4 : 2;
  const tile = (width - 56 - (columns - 1) * 10) / columns;

  if (busy && !serverUrl && !apiKey) {
    return <View style={styles.center}><ActivityIndicator /><Text style={styles.muted}>Loading Frameo Sync…</Text></View>;
  }

  if (slideshow) {
    const currentAsset = assets[slideIndex];
    return (
      <View style={styles.slideshow}>
        {currentAsset ? (
          <Image source={{ uri: originalUrl(serverUrl, currentAsset.id), headers: { 'x-api-key': apiKey.trim() } }} style={styles.slideImage} resizeMode="contain" />
        ) : null}
        <View style={styles.slideOverlay}>
          <Text style={styles.slideTitle}>{selectedAlbumName}</Text>
          <Text style={styles.slideCount}>{assets.length ? `${slideIndex + 1} / ${assets.length}` : 'No photos'}</Text>
          <View style={styles.controls}>
            <Pressable style={styles.control} onPress={() => setSlideIndex((index) => (index - 1 + assets.length) % assets.length)}><Text style={styles.controlText}>‹</Text></Pressable>
            <Pressable style={styles.control} onPress={() => setAutoPlay((value) => !value)}><Text style={styles.controlText}>{autoPlay ? 'Ⅱ' : '▶'}</Text></Pressable>
            <Pressable style={styles.control} onPress={() => setSlideIndex((index) => (index + 1) % assets.length)}><Text style={styles.controlText}>›</Text></Pressable>
            <Pressable style={styles.exit} onPress={() => setSlideshow(false)}><Text style={styles.exitText}>Exit</Text></Pressable>
          </View>
          <Text style={styles.slideHint}>Changes checked every {REFRESH_SECONDS}s • {SLIDE_SECONDS}s per photo</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <FlatList
        data={assets}
        key={columns}
        numColumns={columns}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.container}
        columnWrapperStyle={columns > 1 ? styles.row : undefined}
        ListHeaderComponent={
          <>
            <Text style={styles.eyebrow}>FRAMEO SYNC</Text>
            <Text style={styles.title}>Your Immich photos.</Text>
            <Text style={styles.subtitle}>Connect, choose an album, browse your memories, or start a slideshow.</Text>
            <View style={styles.card}>
              <Text style={styles.label}>Immich server</Text>
              <TextInput value={serverUrl} onChangeText={setServerUrl} autoCapitalize="none" autoCorrect={false} keyboardType="url" placeholder="https://photos.example.com" style={styles.input} />
              <Text style={styles.hint}>Your server: https://immich.jaarsmafamily.com</Text>
              <Text style={styles.label}>API key</Text>
              <TextInput value={apiKey} onChangeText={setApiKey} autoCapitalize="none" autoCorrect={false} secureTextEntry placeholder="Paste your Immich API key" style={styles.input} />
              <Pressable onPress={connect} disabled={busy} style={styles.button}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Test Connection & Load Albums</Text>}</Pressable>
              {status ? <Text style={status.startsWith('Connection failed') || status.startsWith('Could not') || status.startsWith('Refresh failed') ? styles.error : styles.success}>{status}</Text> : null}
            </View>
            {albums.length > 0 ? <Text style={styles.sectionTitle}>Choose an album</Text> : null}
          </>
        }
        ListEmptyComponent={selectedAlbum ? <View style={styles.empty}>{loadingPhotos ? <ActivityIndicator /> : <><Text style={styles.emptyTitle}>No photos found</Text><Text style={styles.muted}>This album does not contain any photos yet.</Text></>}</View> : null}
        renderItem={({ item }) => (
          <Pressable onPress={() => setViewer(item)} style={({ pressed }) => [styles.photo, { width: tile }, pressed && styles.pressed]}>
            <Image source={{ uri: thumbnailUrl(serverUrl, item.id), headers: { 'x-api-key': apiKey.trim() } }} style={{ width: tile, height: tile }} resizeMode="cover" />
            <Text numberOfLines={1} style={styles.caption}>{item.originalFileName || 'Photo'}</Text>
          </Pressable>
        )}
        ListFooterComponent={
          <>
            {selectedAlbum && assets.length > 0 ? <Pressable onPress={startSlideshow} style={styles.slideshowButton}><Text style={styles.slideshowButtonText}>▶ Start Slideshow</Text></Pressable> : null}
            {albums.map((album) => (
              <Pressable key={album.id} onPress={() => chooseAlbum(album)} style={[styles.album, album.id === selectedAlbum && styles.selectedAlbum]}>
                <View><Text style={styles.albumName}>{album.albumName}</Text><Text style={styles.albumCount}>{album.assetCount ?? 0} photos</Text></View>
                {album.id === selectedAlbum ? <Text style={styles.check}>✓</Text> : null}
              </Pressable>
            ))}
            {albums.length > 0 ? <Pressable onPress={refreshAlbums} disabled={loadingAlbums} style={styles.refresh}>{loadingAlbums ? <ActivityIndicator /> : <Text style={styles.refreshText}>Refresh albums</Text>}</Pressable> : null}
          </>
        }
      />
      <Modal visible={!!viewer} transparent animationType="fade" onRequestClose={() => setViewer(null)}>
        <View style={styles.viewer}>
          <Pressable style={styles.close} onPress={() => setViewer(null)}><Text style={styles.closeText}>×</Text></Pressable>
          {viewer ? <Image source={{ uri: originalUrl(serverUrl, viewer.id), headers: { 'x-api-key': apiKey.trim() } }} style={styles.fullImage} resizeMode="contain" /> : null}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f5f5f2' },
  container: { padding: 28, paddingBottom: 60 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#f5f5f2' },
  eyebrow: { fontSize: 13, fontWeight: '700', letterSpacing: 2, marginBottom: 10 },
  title: { fontSize: 36, fontWeight: '700', lineHeight: 42, marginBottom: 12 },
  subtitle: { fontSize: 16, lineHeight: 24, color: '#555', marginBottom: 28 },
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 20, gap: 10, marginBottom: 8 },
  label: { fontSize: 14, fontWeight: '700', marginTop: 4 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, fontSize: 16, backgroundColor: '#fafafa' },
  hint: { color: '#777', fontSize: 12, marginBottom: 6 },
  button: { minHeight: 50, borderRadius: 12, backgroundColor: '#171717', alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  pressed: { opacity: 0.8 },
  success: { color: '#177245', fontWeight: '600', marginTop: 4 },
  error: { color: '#b42318', fontWeight: '600', marginTop: 4 },
  sectionTitle: { fontSize: 20, fontWeight: '700', marginTop: 20, marginBottom: 10 },
  row: { gap: 10 },
  photo: { backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden', marginBottom: 14 },
  caption: { padding: 7, fontSize: 12, color: '#555' },
  album: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#e4e4df' },
  selectedAlbum: { borderColor: '#171717', borderWidth: 2 },
  albumName: { fontSize: 16, fontWeight: '700' },
  albumCount: { color: '#777', marginTop: 4, fontSize: 13 },
  check: { fontSize: 22, fontWeight: '800' },
  refresh: { alignItems: 'center', padding: 16 },
  refreshText: { fontWeight: '700' },
  empty: { alignItems: 'center', padding: 40, gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  muted: { color: '#666' },
  viewer: { flex: 1, backgroundColor: 'rgba(0,0,0,.96)', justifyContent: 'center', alignItems: 'center' },
  fullImage: { width: '100%', height: '85%' },
  close: { position: 'absolute', right: 22, top: 55, zIndex: 2, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,.2)', alignItems: 'center', justifyContent: 'center' },
  closeText: { color: '#fff', fontSize: 32, lineHeight: 34 },
  slideshowButton: { minHeight: 54, borderRadius: 14, backgroundColor: '#171717', alignItems: 'center', justifyContent: 'center', marginVertical: 14 },
  slideshowButtonText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  slideshow: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  slideImage: { width: '100%', height: '100%' },
  slideOverlay: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 20, paddingTop: 55, backgroundColor: 'rgba(0,0,0,.55)', alignItems: 'center' },
  slideTitle: { color: '#fff', fontSize: 20, fontWeight: '700' },
  slideCount: { color: '#ddd', marginTop: 4 },
  controls: { flexDirection: 'row', gap: 12, marginTop: 14, alignItems: 'center' },
  control: { width: 48, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,.18)', alignItems: 'center', justifyContent: 'center' },
  controlText: { color: '#fff', fontSize: 22, fontWeight: '700' },
  exit: { paddingHorizontal: 18, height: 44, borderRadius: 22, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  exitText: { fontWeight: '700' },
  slideHint: { color: '#bbb', fontSize: 11, marginTop: 10 },
});
