import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';

// Minimal loopback-only signalling fixture following Epic's documented protocol.
// The actual renderer/encoder is Epic's installed PixelStreaming2 plugin.
const root = path.dirname(fileURLToPath(import.meta.url));
const players = new Map();
let streamer = null;
let streamerId = 'Kineti';
let nextPlayerId = 1;
const send = (socket, message) => { if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message)); };
const streamerList = () => ({ type: 'streamerList', ids: streamer ? [streamerId] : [] });
const server = http.createServer(async (request, response) => {
  const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
  if (pathname === '/status') {
    response.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    response.end(JSON.stringify({ streamer: Boolean(streamer), streamerId, players: players.size, scope: 'loopback-only' }));
    return;
  }
  const files = { '/': ['index.html', 'text/html'], '/index.html': ['index.html', 'text/html'], '/client.js': ['client.js', 'text/javascript'] };
  const file = files[pathname];
  if (!file) { response.writeHead(404); response.end('Not found'); return; }
  try {
    response.writeHead(200, { 'content-type': `${file[1]}; charset=utf-8`, 'cache-control': 'no-store' });
    response.end(await readFile(path.join(root, 'web', file[0])));
  } catch (error) { response.writeHead(500); response.end(error.message); }
});
const playerServer = new WebSocketServer({ server });
const streamerServer = new WebSocketServer({ host: '127.0.0.1', port: 8898 });
streamerServer.on('connection', (socket) => {
  if (streamer) { socket.close(1013, 'One isolated renderer at a time'); return; }
  streamer = socket;
  console.log('UE streamer connected');
  send(socket, { type: 'config', peerConnectionOptions: { iceServers: [] } });
  send(socket, { type: 'identify' });
  socket.on('message', (raw) => {
    let message;
    try { message = JSON.parse(raw); } catch { return; }
    if (message.type === 'endpointId') {
      streamerId = message.id || 'Kineti';
      send(socket, { type: 'endpointIdConfirm', committedId: streamerId });
      for (const player of players.values()) send(player.socket, streamerList());
      console.log(`UE streamer identified: ${streamerId}`);
    } else if (message.type === 'ping') {
      send(socket, { type: 'pong', time: message.time });
    } else if (message.type === 'disconnectPlayer') {
      players.get(String(message.playerId))?.socket.close(1000, message.reason || 'Renderer ended connection');
    } else if (message.playerId !== undefined) {
      const player = players.get(String(message.playerId));
      const { playerId, ...payload } = message;
      send(player?.socket, payload);
    } else console.log(`UE signal: ${message.type}`);
  });
  socket.on('close', () => {
    if (streamer === socket) streamer = null;
    for (const player of players.values()) send(player.socket, { type: 'streamerDisconnected' });
    console.log('UE streamer disconnected');
  });
  socket.on('error', (error) => console.error(error.message));
});
playerServer.on('connection', (socket) => {
  const playerId = String(nextPlayerId++);
  const player = { socket, subscribed: false };
  players.set(playerId, player);
  send(socket, { type: 'config', peerConnectionOptions: { iceServers: [] } });
  socket.on('message', (raw) => {
    let message;
    try { message = JSON.parse(raw); } catch { return; }
    if (message.type === 'listStreamers') send(socket, streamerList());
    else if (message.type === 'subscribe') {
      if (!streamer || message.streamerId !== streamerId) {
        send(socket, { type: 'subscribeFailed', message: 'Start the isolated UE renderer first.' });
      } else if (!player.subscribed) {
        player.subscribed = true;
        send(streamer, { type: 'playerConnected', playerId, dataChannel: true, sfu: false });
        console.log(`Player ${playerId} subscribed`);
      }
    } else if (message.type === 'ping') send(socket, { type: 'pong', time: message.time });
    else if (player.subscribed && ['answer', 'offer', 'iceCandidate'].includes(message.type)) {
      send(streamer, { ...message, playerId });
    }
  });
  socket.on('close', () => {
    if (player.subscribed) send(streamer, { type: 'playerDisconnected', playerId });
    players.delete(playerId);
  });
  socket.on('error', (error) => console.error(error.message));
});
server.listen(8899, '127.0.0.1', () => console.log('Kineti Unreal browser: http://127.0.0.1:8899'));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
  for (const player of players.values()) player.socket.close();
  streamer?.close();
  playerServer.close(); streamerServer.close(); server.close(() => process.exit(0));
});
