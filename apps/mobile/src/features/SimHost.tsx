import { forwardRef, useImperativeHandle, useRef } from 'react';
import { Platform } from 'react-native';
import { WebView } from 'react-native-webview';

export interface HostRef { send(message: unknown): void }
export interface HostProps {
  uri: string;
  title: string;
  onMessage(message: unknown): void;
  onFailure(): void;
  onLoad(): void;
}

const SimHost = forwardRef<HostRef, HostProps>(function SimHost({ uri, title, onMessage, onFailure, onLoad }, ref) {
  const frame = useRef<WebView<object>>(null);
  const origin = new URL(uri).origin;

  useImperativeHandle(ref, () => ({
    send(message) {
      const value = JSON.stringify(message).replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
      frame.current?.injectJavaScript('window.physimBridge?.receive(' + value + '); true;');
    },
  }), []);

  return <WebView<object>
    ref={frame}
    source={{ uri }}
    accessibilityLabel={title}
    originWhitelist={[origin]}
    mixedContentMode="never"
    javaScriptEnabled
    allowFileAccess={false}
    allowsBackForwardNavigationGestures={false}
    setSupportMultipleWindows={false}
    onShouldStartLoadWithRequest={(request) => request.url === uri}
    onMessage={(event) => {
      // Android's WebMessageListener reports only the source origin.
      const source = event.nativeEvent.url;
      if (source === uri || (Platform.OS === 'android' && source === origin)) onMessage(event.nativeEvent.data);
    }}
    onLoad={onLoad}
    onError={onFailure}
    onHttpError={onFailure}
    style={{ backgroundColor: '#FFFFFF' }}
  />;
});

export default SimHost;
