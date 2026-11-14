import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { useFrameController, type SimulationFrameHandle, type SimulationFrameProps } from './SimulationFrame.types';
import { fonts } from '../theme';

const SimulationFrame = forwardRef<SimulationFrameHandle, SimulationFrameProps>(function SimulationFrame(props, ref) {
  // WebView 14's default generic is undefined; choose object so strict TS keeps its declared props.
  const webView = useRef<WebView<object>>(null);
  const controller = useFrameController(props, 'native');
  const { connection } = controller;
  useImperativeHandle(ref, () => ({ command: controller.command, reload: controller.reload }), [controller.command, controller.reload]);

  return <View style={[styles.frame, { height: props.height ?? 420 }]}>
    {connection && <WebView<object>
      key={connection.loadId}
      ref={webView}
      source={{ uri: connection.url }}
      style={styles.webView}
      javaScriptEnabled
      domStorageEnabled
      originWhitelist={['*']}
      mixedContentMode="never"
      allowFileAccess={false}
      allowUniversalAccessFromFileURLs={false}
      javaScriptCanOpenWindowsAutomatically={false}
      setSupportMultipleWindows={false}
      allowsFullscreenVideo
      onShouldStartLoadWithRequest={request => {
        try { return new URL(request.url).origin === connection.origin; } catch { return false; }
      }}
      onMessage={event => {
        try {
          if (new URL(event.nativeEvent.url).origin !== connection.origin) return;
          controller.receive(event.nativeEvent.data, connection.loadId);
        } catch { /* Ignore non-HTTP or malformed native events. */ }
      }}
      onLoad={() => controller.loaded(connection.loadId, message => {
        if (!webView.current) throw new Error('Mô phỏng chưa được gắn vào màn hình.');
        webView.current.injectJavaScript(`window.physimBridge&&window.physimBridge.receive(${JSON.stringify(JSON.stringify(message))},${JSON.stringify(connection.loadId)});true;`);
      })}
      onError={() => controller.fail('Không tải được mô phỏng. Kiểm tra địa chỉ server và kết nối.', connection.loadId)}
      onHttpError={event => {
        // Ignore resource failures: only the main HTML request makes the frame unusable.
        const main = event.nativeEvent.url.split('#')[0] === connection.url.split('#')[0];
        if (main) controller.fail(`Server trả lỗi ${event.nativeEvent.statusCode}. Hãy thử tải lại.`, connection.loadId);
      }}
      onContentProcessDidTerminate={() => controller.fail('Mô phỏng đã được hệ thống đóng để giải phóng bộ nhớ. Hãy tải lại.', connection.loadId)}
      onRenderProcessGone={() => controller.fail('Mô phỏng đã được hệ thống đóng để giải phóng bộ nhớ. Hãy tải lại.', connection.loadId)}
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
  webView: { flex: 1, backgroundColor: '#E6DDFB', borderRadius: 10 },
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
