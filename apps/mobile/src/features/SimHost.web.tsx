import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

export interface HostRef { send(message: unknown): void }
export interface HostProps {
  uri: string;
  title: string;
  onMessage(message: unknown): void;
  onFailure(): void;
  onLoad(): void;
}

const SimHost = forwardRef<HostRef, HostProps>(function SimHost({ uri, title, onMessage, onLoad }, ref) {
  const frame = useRef<HTMLIFrameElement>(null);
  const origin = new URL(uri).origin;

  useImperativeHandle(ref, () => ({
    send(message) { frame.current?.contentWindow?.postMessage(JSON.stringify(message), origin); },
  }), [origin]);

  useEffect(() => {
    function receive(event: MessageEvent) {
      if (event.origin === origin && event.source === frame.current?.contentWindow) onMessage(event.data);
    }
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, [origin, onMessage]);

  return <iframe ref={frame} src={uri} title={title} onLoad={onLoad}
    sandbox="allow-scripts allow-same-origin"
    style={{ border: 0, width: '100%', height: '100%', display: 'block', background: '#fff' }} />;
});

export default SimHost;
