import React, { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFrameController, type SimulationFrameHandle, type SimulationFrameProps } from './SimulationFrame.types';
import { fonts } from '../theme';

const useTransportEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

const SimulationFrame = forwardRef<SimulationFrameHandle, SimulationFrameProps>(function SimulationFrame(props, ref) {
  const iframe = useRef<HTMLIFrameElement>(null);
  const controller = useFrameController(props, 'web');
  const { connection } = controller;
  useImperativeHandle(ref, () => ({ command: controller.command, reload: controller.reload }), [controller.command, controller.reload]);

  useTransportEffect(() => {
    if (!connection) return;
    const listener = (event: MessageEvent) => {
      if (event.source !== iframe.current?.contentWindow || event.origin !== connection.origin) return;
      controller.receive(event.data, connection.loadId);
    };
    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
  }, [connection, controller.receive]);

  return <View style={[styles.frame, { height: props.height ?? 420 }]}>
    {connection && <iframe
      key={connection.loadId}
      ref={iframe}
      src={connection.url}
      title={`Mô phỏng PhET: ${props.slug}`}
      allow="fullscreen"
      allowFullScreen
      referrerPolicy="same-origin"
      style={{ display: 'block', width: '100%', height: '100%', border: 0, borderRadius: 10, background: '#E6DDFB' }}
      onLoad={() => controller.loaded(connection.loadId, message => {
        const target = iframe.current?.contentWindow;
        if (!target) throw new Error('Mô phỏng chưa được gắn vào trang.');
        // Older PhET listeners also receive these events and expect JSON text.
        target.postMessage(JSON.stringify(message), connection.origin);
      })}
      onError={() => controller.fail('Không tải được mô phỏng. Kiểm tra địa chỉ server và kết nối.', connection.loadId)}
    />}
    {controller.status !== 'ready' && <View style={styles.overlay} accessibilityLiveRegion="polite">
      {controller.status === 'loading' ? <>
        <View style={styles.statusTile} accessible={false}><Text style={styles.statusMark}>✦</Text></View>
        <ActivityIndicator color="#FF8EC7" size="large" />
        <Text style={styles.title}>Đang mở mô phỏng</Text>
        <Text style={styles.note}>Lần mở đầu tiên có thể cần thêm một chút thời gian.</Text>
      </> : <>
        <Text style={styles.title}>Chưa tải được mô phỏng</Text>
        <Text style={styles.note}>{controller.error}</Text>
        <Pressable accessibilityRole="button" onPress={controller.reload} style={styles.button}>
          <Text style={styles.buttonText}>Thử tải lại</Text>
        </Pressable>
      </>}
    </View>}
  </View>;
});

const styles = StyleSheet.create({
  frame: { width: '100%', minHeight: 240, padding: 6, backgroundColor: '#fff', borderWidth: 3, borderColor: '#3B2849', borderRadius: 20, boxShadow: '5px 5px 0 #3B2849', overflow: 'hidden' },
  overlay: { ...StyleSheet.absoluteFill, backgroundColor: '#E6DDFB', borderRadius: 16, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  statusTile: { width: 54, height: 54, backgroundColor: '#FFB3DA', borderWidth: 3, borderColor: '#3B2849', borderRadius: 14, boxShadow: '3px 3px 0 #3B2849', alignItems: 'center', justifyContent: 'center' },
  statusMark: { color: '#3B2849', fontSize: 32, fontFamily: fonts.heading },
  title: { color: '#3B2849', fontFamily: fonts.heading, fontSize: 22, textAlign: 'center' },
  note: { color: '#6F5A75', fontFamily: fonts.body, fontSize: 13, lineHeight: 20, textAlign: 'center', maxWidth: 340 },
  button: { backgroundColor: '#FFB3DA', borderColor: '#3B2849', borderWidth: 3, minHeight: 48, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 14, boxShadow: '3px 3px 0 #3B2849' },
  buttonText: { fontFamily: fonts.heading, color: '#3B2849', fontSize: 17 },
});

export default SimulationFrame;
export type { SimulationFrameHandle, SimulationFrameProps } from './SimulationFrame.types';
