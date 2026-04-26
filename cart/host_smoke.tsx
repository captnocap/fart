/**
 * host_smoke — minimal cart that exercises the networking trichotomy:
 * useHost (server side) + useConnection (outbound side). Used to flip the
 * WANT_USEHOST gate in scripts/ship and verify the full binding surface
 * (httpsrv/wssrv/process/net) compiles + registers cleanly.
 *
 * Renders the live state of one of each kind. Endpoints/cmds are chosen so
 * the cart starts up even with no external services running:
 *   - useHost http  on 0.0.0.0:8400 (listening)
 *   - useHost ws    on 0.0.0.0:8401 (listening)
 *   - useConnection tcp to 127.0.0.1:8400 (loopback to our own http server)
 *   - useConnection udp to 127.0.0.1:8400 (loopback; udp will silently never receive)
 *   - useHost process: /bin/echo "hello from useHost"
 */

import * as React from 'react';
import { useHost } from '../runtime/hooks/useHost';
import { useConnection } from '../runtime/hooks/useConnection';

export default function App() {
  const http = useHost({
    kind: 'http',
    port: 8400,
    routes: [{ path: '/', kind: 'handler' }],
    onRequest: (_req, res) => res.send(200, 'text/plain', 'hi'),
  });

  const ws = useHost({
    kind: 'ws',
    port: 8401,
    onMessage: (cid, data) => ws.send(cid, `echo: ${data}`),
  });

  const tcp = useConnection({
    kind: 'tcp',
    host: '127.0.0.1',
    port: 8400,
    onData: () => {},
  });

  const udp = useConnection({
    kind: 'udp',
    host: '127.0.0.1',
    port: 8400,
  });

  const proc = useHost({
    kind: 'process',
    cmd: '/bin/echo',
    args: ['hello from useHost'],
    onStdout: () => {},
  });

  return (
    <div style={{ padding: 24, fontFamily: 'monospace' }}>
      <h1>useHost + useConnection smoke</h1>
      <pre>{JSON.stringify({
        http: http.state,
        ws: ws.state,
        tcp: tcp.state,
        udp: udp.state,
        process: { state: proc.state, pid: proc.pid },
      }, null, 2)}</pre>
    </div>
  );
}
