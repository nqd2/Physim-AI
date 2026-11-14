import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { api, normalizeServer } from '../../src/shared/api';
import { useStore } from '../../src/shared/store';
import { color } from '../../src/shared/theme';
import { Action, Copy, Field, Frame, Heading, Notice, Page, Rule, useLayout } from '../../src/shared/ui';

export default function Settings() {
  const { server, setServer } = useStore();
  const { wide } = useLayout();
  const [value, setValue] = useState(server);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  useEffect(() => setValue(server), [server]);

  async function connect() {
    setBusy(true);
    setError('');
    setStatus('');
    try {
      const address = normalizeServer(value);
      const health = await api.health(address);
      setServer(address);
      setStatus([
        'Đã lưu địa chỉ máy chủ.',
        health.catalogReady ? 'Thư viện mô phỏng đã sẵn sàng.' : 'Thư viện đang chờ đồng bộ.',
        health.aiConfigured ? 'Máy chủ đã cấu hình AI.' : 'Máy chủ chưa cấu hình AI. Bạn vẫn có thể dùng các đề mẫu.',
      ].join(' '));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Không kết nối được máy chủ.');
    } finally {
      setBusy(false);
    }
  }

  return <Page><Frame style={[styles.page, wide && styles.wide]}>
    <View style={styles.intro}>
      <Heading>Cài đặt</Heading>
      <Copy muted>Chọn máy chủ dùng cho thư viện mô phỏng và phân tích ảnh.</Copy>
    </View>
    <View style={styles.form}>
      <Rule />
      <Heading level={3}>Kết nối máy chủ</Heading>
      <Field label="Địa chỉ máy chủ" value={value} onChangeText={(text) => { setValue(text); setStatus(''); setError(''); }}
        placeholder="https://physim.example.edu" inputMode="url" autoCapitalize="none" autoCorrect={false}
        onSubmitEditing={() => { if (!busy && value.trim()) void connect(); }} editable={!busy} />
      <Action label="Kiểm tra và lưu" icon="right" onPress={() => void connect()} busy={busy} disabled={!value.trim()} />
      {error ? <Notice tone="error">{error}</Notice> : null}
      {status ? <Notice tone="success">{status}</Notice> : null}
      <Copy muted>Tiến độ học và thẻ ôn tập được lưu trên thiết bị này.</Copy>
    </View>
  </Frame></Page>;
}

const styles = StyleSheet.create({
  page: { paddingTop: 34, gap: 24 },
  wide: { flexDirection: 'row', gap: 50 },
  intro: { flex: 1, gap: 8, maxWidth: 420 },
  form: { flex: 2, gap: 14, maxWidth: 610, backgroundColor: color.paper },
});
