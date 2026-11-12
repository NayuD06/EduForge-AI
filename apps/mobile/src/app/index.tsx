import type { HealthDto } from '@eduforge/shared';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { API_URL, api } from '@/lib/api';

// Màn hình khung. Các màn hình dự kiến (Expo Router, thư mục src/app):
//   login.tsx                 – đăng nhập (token lưu trong SecureStore)
//   courses/[id].tsx          – chi tiết khóa học, bài học
//   attempts/[id].tsx         – làm bài thi: đồng hồ, tự lưu tiến trình, nộp bài
//   attempts/[id]/result.tsx  – kết quả + AI giải thích
export default function HomeScreen() {
  const [health, setHealth] = useState<HealthDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .health()
      .then(setHealth)
      .catch((e: Error) => setError(e.message));
  }, []);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.kicker}>EDUFORGE · MOBILE</Text>
      <Text style={styles.title}>Học và thi mọi lúc</Text>
      <View style={styles.card}>
        <Text style={styles.label}>API: {API_URL}</Text>
        {error && <Text style={styles.error}>Không kết nối được: {error}</Text>}
        {!error && !health && <Text>Đang kiểm tra…</Text>}
        {health &&
          Object.entries(health.services).map(([name, state]) => (
            <Text key={name}>
              {state === 'up' ? '🟢' : '🔴'} {name}
            </Text>
          ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, gap: 12 },
  kicker: { color: '#6366f1', fontWeight: '700', letterSpacing: 1 },
  title: { fontSize: 28, fontWeight: '700' },
  card: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, padding: 16, gap: 4 },
  label: { fontWeight: '600' },
  error: { color: '#dc2626' },
});
