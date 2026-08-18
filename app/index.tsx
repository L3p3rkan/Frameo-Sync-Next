import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SERVER_KEY = 'frameo.serverUrl';
const API_KEY = 'frameo.apiKey';

function normalizeServerUrl(input: string) {
  let value = input.trim();
  if (!value) return '';
  if (!/^https?:\\/\\//i.test(value)) value = `http://${value}`;
  try {
    const url = new URL(value);
    url.pathname = url.pathname.replace(/\\/+$/, '').replace(/\\/api$/i, '');
    url.search = '';
    url.hash = '';
    return url.toString().replace(/\\/$/, '');
  } catch {
    return value.replace(/\\/+$/, '').replace(/\\/api$/i, '');
  }
}

export default function HomeScreen() {
  const [serverUrl, setServerUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    Promise.all([AsyncStorage.getItem(SERVER_KEY), SecureStore.getItemAsync(API_KEY)])
      .then(([server, key]) => { setServerUrl(server || ''); setApiKey(key || ''); })
      .finally(() => setBusy(false));
  }, []);

  async function save() {
    const normalizedServer = normalizeServerUrl(serverUrl);
    const normalizedKey = apiKey.trim();
    if (!normalizedServer || !normalizedKey) { setStatus('Enter both the Immich server and API key.'); return; }
    setBusy(true);
    try {
      const response = await fetch(`${normalizedServer}/api/albums`, { headers: { Accept: 'application/json', 'x-api-key': normalizedKey } });
      if (!response.ok) throw new Error(`Immich returned HTTP ${response.status}`);
      await AsyncStorage.setItem(SERVER_KEY, normalizedServer);
      await SecureStore.setItemAsync(API_KEY, normalizedKey);
      setServerUrl(normalizedServer);
      setStatus('Connected successfully.');
    } catch (error) {
      setStatus(error instanceof Error ? `Connection failed: ${error.message}` : 'Connection failed.');
    } finally { setBusy(false); }
  }

  if (busy && !serverUrl && !apiKey) return <View style={styles.center}><ActivityIndicator /><Text style={styles.muted}>Loading Frameo Sync…</Text></View>;

  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>FRAMEO SYNC</Text>
      <Text style={styles.title}>Connect your photo server.</Text>
      <Text style={styles.subtitle}>Start with a secure Immich connection. We'll build albums, photos, sync, and slideshow features on top of this foundation.</Text>
      <View style={styles.card}>
        <Text style={styles.label}>Immich server</Text>
        <TextInput value={serverUrl} onChangeText={setServerUrl} autoCapitalize="none" autoCorrect={false} keyboardType="url" placeholder="https://photos.example.com" style={styles.input} />
        <Text style={styles.hint}>You can enter the host with or without /api.</Text>
        <Text style={styles.label}>API key</Text>
        <TextInput value={apiKey} onChangeText={setApiKey} autoCapitalize="none" autoCorrect={false} secureTextEntry placeholder="Paste your Immich API key" style={styles.input} />
        <Pressable onPress={save} disabled={busy} style={({ pressed }) => [styles.button, pressed && styles.pressed, busy && styles.disabled]}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Test & Save Connection</Text>}
        </Pressable>
        {status ? <Text style={status.startsWith('Connected') ? styles.success : styles.error}>{status}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 28, justifyContent: 'center', backgroundColor: '#f5f5f2' },
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
  muted: { color: '#666' }
});
