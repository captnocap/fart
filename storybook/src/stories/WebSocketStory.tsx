import React, { useState, useCallback, useEffect } from 'react';
import { Box, Text, Pressable, useWebSocket, usePeerServer, useLoveEvent, useLoveRPC } from '../../../packages/shared/src';
import { useThemeColors } from '../../../packages/theme/src';

function StatusDot({ status }: { status: string }) {
  const c = useThemeColors();
  const color = status === 'open' || status === 'ready' ? c.success
    : status === 'connecting' ? c.warning
    : status === 'error' ? c.error
    : c.textDim;
  return (
    <Box style={{
      width: 10, height: 10, borderRadius: 5,
      backgroundColor: color,
    }} />
  );
}

// ---- P2P Demo: Host a server + connect a client to it ----
function P2PDemo() {
  const c = useThemeColors();
  // Tor hidden service address
  const [onionAddr, setOnionAddr] = useState<string | null>(null);
  const getHostname = useLoveRPC<string>('tor:getHostname');

  // Query on mount — defeats the race where tor:ready fires before useEffect subscribes
  useEffect(() => {
    getHostname().then((hostname) => {
      if (hostname) setOnionAddr(hostname);
    }).catch(() => {}); // Tor not ready yet, event will catch it
  }, []);

  // Backup: listen for tor:ready event (covers case where Tor is still bootstrapping at mount)
  useLoveEvent('tor:ready', (payload: any) => {
    if (payload && payload.hostname) {
      setOnionAddr(payload.hostname);
    }
  });

  // Server side
  const [serverPort, setServerPort] = useState<number | null>(null);
  const server = usePeerServer(serverPort);
  const [serverLog, setServerLog] = useState<string[]>([]);

  // Client side
  const [clientUrl, setClientUrl] = useState<string | null>(null);
  const client = useWebSocket(clientUrl);
  const [clientLog, setClientLog] = useState<string[]>([]);

  // Track incoming messages
  React.useEffect(() => {
    if (server.lastMessage) {
      const msg = `[peer ${server.lastMessage.clientId}] ${server.lastMessage.data}`;
      setServerLog(prev => [...prev.slice(-6), msg]);

      // Echo back with prefix
      server.send(server.lastMessage.clientId, `echo: ${server.lastMessage.data}`);
    }
  }, [server.lastMessage]);

  React.useEffect(() => {
    if (client.lastMessage) {
      setClientLog(prev => [...prev.slice(-6), client.lastMessage!]);
    }
  }, [client.lastMessage]);

  const startServer = useCallback(() => {
    setServerPort(8080);
    setServerLog([]);
  }, []);

  const stopServer = useCallback(() => {
    setServerPort(null);
    setServerLog([]);
  }, []);

  const connectClient = useCallback(() => {
    setClientUrl('ws://localhost:8080');
    setClientLog([]);
  }, []);

  const connectViaTor = useCallback(() => {
    if (!onionAddr) return;
    setClientUrl(`ws://${onionAddr}:8080`);
    setClientLog([]);
  }, [onionAddr]);

  const disconnectClient = useCallback(() => {
    setClientUrl(null);
    setClientLog([]);
  }, []);

  const clientSend = useCallback(() => {
    const msg = `hello @ ${Date.now()}`;
    client.send(msg);
    setClientLog(prev => [...prev.slice(-6), `> ${msg}`]);
  }, [client.send]);

  const serverBroadcast = useCallback(() => {
    const msg = `broadcast @ ${Date.now()}`;
    server.broadcast(msg);
    setServerLog(prev => [...prev.slice(-6), `> ${msg}`]);
  }, [server.broadcast]);

  return (
    <Box style={{ flexDirection: 'row', gap: 16, width: '100%' }}>
      {/* Server panel */}
      <Box style={{ flexGrow: 1, gap: 8 }}>
        <Text style={{ fontSize: 14, color: c.text }}>Server (Host)</Text>

        <Box style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <StatusDot status={server.ready ? 'ready' : 'closed'} />
          <Text style={{ fontSize: 12, color: c.text }}>
            {server.ready ? `Listening on :8080` : 'Stopped'}
          </Text>
        </Box>

        <Text style={{ fontSize: 11, color: c.textSecondary }}>
          {`Peers: ${server.peers.length}`}
        </Text>

        <Box style={{ flexDirection: 'row', gap: 6 }}>
          <Pressable onPress={startServer} style={{
            backgroundColor: serverPort ? c.surface : c.primary,
            paddingLeft: 12, paddingRight: 12,
            paddingTop: 5, paddingBottom: 5,
            borderRadius: 5,
          }}>
            <Text style={{ fontSize: 11, color: '#ffffff' }}>Start</Text>
          </Pressable>

          <Pressable onPress={stopServer} style={{
            backgroundColor: serverPort ? c.error : c.surface,
            paddingLeft: 12, paddingRight: 12,
            paddingTop: 5, paddingBottom: 5,
            borderRadius: 5,
          }}>
            <Text style={{ fontSize: 11, color: '#ffffff' }}>Stop</Text>
          </Pressable>

          <Pressable onPress={serverBroadcast} style={{
            backgroundColor: server.ready ? c.accent : c.surface,
            paddingLeft: 12, paddingRight: 12,
            paddingTop: 5, paddingBottom: 5,
            borderRadius: 5,
          }}>
            <Text style={{ fontSize: 11, color: '#ffffff' }}>Broadcast</Text>
          </Pressable>
        </Box>

        {server.error && (
          <Text style={{ fontSize: 11, color: c.error }}>{`Error: ${server.error}`}</Text>
        )}

        <Box style={{ backgroundColor: c.bgElevated, borderRadius: 6, padding: 8, gap: 3 }}>
          <Text style={{ fontSize: 10, color: c.textDim }}>Server log:</Text>
          {serverLog.length === 0 && (
            <Text style={{ fontSize: 10, color: c.textDim }}>No messages yet</Text>
          )}
          {serverLog.map((msg, i) => (
            <Text key={i} style={{ fontSize: 10, color: c.accent }}>{msg}</Text>
          ))}
        </Box>
      </Box>

      {/* Client panel */}
      <Box style={{ flexGrow: 1, gap: 8 }}>
        <Text style={{ fontSize: 14, color: c.text }}>Client (Joiner)</Text>

        <Box style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <StatusDot status={client.status} />
          <Text style={{ fontSize: 12, color: c.text }}>{`Status: ${client.status}`}</Text>
        </Box>

        <Text style={{ fontSize: 11, color: onionAddr ? c.success : c.textSecondary }}>
          {onionAddr ? `Tor ready: ${onionAddr.substring(0, 20)}...` : 'Waiting for Tor...'}
        </Text>

        <Box style={{ flexDirection: 'row', gap: 6 }}>
          <Pressable onPress={connectClient} style={{
            backgroundColor: clientUrl && !clientUrl.includes('.onion') ? c.surface : c.primary,
            paddingLeft: 12, paddingRight: 12,
            paddingTop: 5, paddingBottom: 5,
            borderRadius: 5,
          }}>
            <Text style={{ fontSize: 11, color: '#ffffff' }}>Connect Local</Text>
          </Pressable>

          <Pressable onPress={connectViaTor} style={{
            backgroundColor: !onionAddr ? c.bgElevated : clientUrl && clientUrl.includes('.onion') ? c.surface : c.accent,
            paddingLeft: 12, paddingRight: 12,
            paddingTop: 5, paddingBottom: 5,
            borderRadius: 5,
          }}>
            <Text style={{ fontSize: 11, color: '#ffffff' }}>Connect via Tor</Text>
          </Pressable>

          <Pressable onPress={disconnectClient} style={{
            backgroundColor: clientUrl ? c.error : c.surface,
            paddingLeft: 12, paddingRight: 12,
            paddingTop: 5, paddingBottom: 5,
            borderRadius: 5,
          }}>
            <Text style={{ fontSize: 11, color: '#ffffff' }}>Disconnect</Text>
          </Pressable>

          <Pressable onPress={clientSend} style={{
            backgroundColor: client.status === 'open' ? c.success : c.surface,
            paddingLeft: 12, paddingRight: 12,
            paddingTop: 5, paddingBottom: 5,
            borderRadius: 5,
          }}>
            <Text style={{ fontSize: 11, color: '#ffffff' }}>Send</Text>
          </Pressable>
        </Box>

        {onionAddr && (
          <Box style={{ backgroundColor: c.bgElevated, borderRadius: 6, padding: 6 }}>
            <Text style={{ fontSize: 9, color: c.textDim }}>Onion address:</Text>
            <Text style={{ fontSize: 10, color: c.accent }}>{onionAddr}</Text>
          </Box>
        )}

        {client.error && (
          <Text style={{ fontSize: 11, color: c.error }}>{`Error: ${client.error}`}</Text>
        )}

        <Box style={{ backgroundColor: c.bgElevated, borderRadius: 6, padding: 8, gap: 3 }}>
          <Text style={{ fontSize: 10, color: c.textDim }}>Client log:</Text>
          {clientLog.length === 0 && (
            <Text style={{ fontSize: 10, color: c.textDim }}>No messages yet</Text>
          )}
          {clientLog.map((msg, i) => (
            <Text key={i} style={{ fontSize: 10, color: c.accent }}>{msg}</Text>
          ))}
        </Box>
      </Box>
    </Box>
  );
}

export function WebSocketStory() {
  const c = useThemeColors();
  return (
    <Box style={{
      width: '100%', height: '100%',
      padding: 20, gap: 16,
      backgroundColor: c.bg,
    }}>
      <Text style={{ fontSize: 18, color: c.text }}>WebSocket — P2P Server + Client</Text>
      <Text style={{ fontSize: 12, color: c.textDim }}>
        {`Start the server, then connect the client. Messages echo back through the server.`}
      </Text>

      <P2PDemo />
    </Box>
  );
}
