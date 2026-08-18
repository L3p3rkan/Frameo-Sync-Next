import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, FlatList } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAlbums, ImmichAlbum, normalizeServerUrl } from '../lib/immich';

const SERVER_KEY = 'frameo.serverUrl';
const API_KEY = 'frameo.apiKey';
const ALBUM_KEY = 'frameo.albumId';
const ALBUM_NAME_KEY = 'frameo.albumName';

export default function HomeScreen() {
  const [serverUrl, setServerUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [albums, setAlbums] = useState<ImmichAlbum[]>([]);
  const [selectedAlbum, setSelectedAlbum] = useState('');
  const [selectedAlbumName, setSelectedAlbumName] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [loadingAlbums, setLoadingAlbums] = useState(false);

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(SERVER_KEY),
      SecureStore.getItemAsync(API_KEY),
      AsyncStorage.getItem(ALBUM_KEY),
      AsyncStorage.getItem(ALBUM_NAME_KEY),
    ]).then(([server, key, albumId, albumName]) => {
      setServerUrl(server || '');
      setApiKey(key || '');
      setSelectedAlbum(albumId || '');
      setSelectedAlbumName(albumName || '');
    }).finally(() => setBusy(false));
  }, []);

  async function connect() {
    const normalizedServer = normalizeServerUrl(serverUrl);
    const normalizedKey = apiKey.trim();
    if (!normalizedServer || !normalizedKey) { setStatus('Enter both the Immich server and API key.'); return; }
    setBusy(true);
    try {
      const nextAlbums = await getAlbums(normalizedServer, normalizedKey);
      await AsyncStorage.setItem(SERVER_KEY, normalizedServer);
      await SecureStore.setItemAsync(API_KEY, normalizedKey);
      setServerUrl(normalizedServer);
      setApiKey(normalizedKey);
      setAlbums(nextAlbums);
      setStatus(`Connected. Found ${nextAlbums.length} album${nextAlbums.length === 1 ? '' : 's'}.`);
    } catch (error) {
      setStatus(error instanceof Error ? `Connection failed: ${error.message}` : 'Connection failed.');
    } finally { setBusy(false); }
  }

  async function chooseAlbum(album: ImmichAlbum) {
    setSelectedAlbum(album.id);
    setSelectedAlbumName(album.albumName);
    await AsyncStorage.setItem(ALBUM_KEY, album.id);
    await AsyncStorage.setItem(ALBUM_NAME_KEY, album.albumName);
    setStatus(`Selected “${album.albumName}”.`);
  }

  async function refreshAlbums() {
    setLoadingAlbums(true);
    try {
      const nextAlbums = await getAlbums(serverUrl, apiKey);
      setAlbums(nextAlbums);
      setStatus(`Loaded ${nextAlbums.length} album${nextAlbums.length === 1 ? '' : 's'}.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not load albums.');
    } finally { setLoadingAlbums(false); }
  }

  if (busy && !serverUrl && !apiKey) return <View style={styles.center}><ActivityIndicator /><Text style={styles.muted}>Loading Frameo Sync…</Text></View>;

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.container}
      ListHeaderComponent={
        <>
          <Text style={styles.eyebrow}>FRAMEO SYNC</Text>
          <Text style={styles.title}>Connect your photo server.</Text>
          <Text style={styles.subtitle}>Connect to Immich, choose an album, and we'll build the photo sync on top of it.</Text>
          <View style={styles.card}>
            <Text style={styles.label}>Immich server</Text>
            <TextInput value={serverUrl} onChangeText={setServerUrl} autoCapitalize="none" autoCorrect={false} keyboardType="url" placeholder="https://photos.example.com" style={styles.input} />
            <Text style={styles.hint}>For your server, use https://immich.jaarsmafamily.com</Text>
            <Text style={styles.label}>API key</Text>
            <TextInput value={apiKey} onChangeText={setApiKey} autoCapitalize="none" autoCorrect={false} secureTextEntry placeholder="Paste your Immich API key" style={styles.input} />
            <Pressable onPress={connect} disabled={busy} style={({ pressed }) => [styles.button, pressed && styles.pressed, busy && styles.disabled]}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Test Connection & Load Albums</Text>}
            </Pressable>
            {status ? <Text style={status.startsWith('Connection failed') || status.startsWith('Could not') ? styles.error : styles.success}>{status}</Text> : null}
          </View>
          {albums.length > 0 ? <Text style={styles.sectionTitle}>Choose an album</Text> : null}
        </>
      }
      data={albums}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <Pressable onPress={() => chooseAlbum(item)} style={({ pressed }) => [styles.album, item.id === selectedAlbum && styles.selectedAlbum, pressed && styles.pressed]}>
          <View style={styles.albumText}><Text style={styles.albumName}>{item.albumName}</Text><Text style={styles.albumCount}>{item.assetCount ?? 0} photos</Text></View>
          {item.id === selectedAlbum ? <Text style={styles.check}>✓</Text> : null}
        </Pressable>
      )}
      ListFooterComponent={albums.length > 0 ? <Pressable onPress={refreshAlbums} disabled={loadingAlbums} style={styles.refresh}>{loadingAlbums ? <ActivityIndicator /> : <Text style={styles.refreshText}>Refresh albums</Text>}</Pressable> : null}
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: '#f5f5f2' },
  container: { padding: 28, paddingBottom: 50 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#f5f5f2' },
  eyebrow: { fontSize: 13, fontWeight: '700', letterSpacing: 2, marginBottom: 10 },
  title: { fontSize: 36, fontWeight: '700', lineHeight: 42, marginBottom: 12 },
  subtitle: { fontSize: 16, lineHeight: 24, color: '#555', marginBottom: 28 },
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 20, gap: 10 },
  label: { fontSize: 14, fontWeight: '700', marginTop: 4 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, fontSize: 16, backgroundColor: '#fafafa' },
  hint: { color: '#777', fontSize: 12, marginBottom: 6 },
  button: { minHeight: 50, borderRadius: 12, backgroundColor: '#171717', alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.55 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  success: { color: '#177245', fontWeight: '600', marginTop: 4 },
  error: { color: '#b42318', fontWeight: '600', marginTop: 4 },
  sectionTitle: { fontSize: 20, fontWeight: '700', marginTop: 28, marginBottom: 10 },
  album: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#e4e4df' },
  selectedAlbum: { borderColor: '#171717', borderWidth: 2 },
  albumText: { flex: 1 },
  albumName: { fontSize: 16, fontWeight: '700' },
  albumCount: { color: '#777', marginTop: 4, fontSize: 13 },
  check: { fontSize: 22, fontWeight: '800', marginLeft: 12 },
  refresh: { alignItems: 'center', padding: 16 },
  refreshText: { fontWeight: '700' },
  muted: { color: '#666' },
});
