const video = document.querySelector('#video');
const status = document.querySelector('#status');
const metrics = document.querySelector('#metrics');
const ackOutput = document.querySelector('#ack');
const defaults = { progress: 0, explode: 0, selectedPiece: 26, pieceOffset: 0, cameraFov: 38 };
const controls = { ...defaults };
const pending = new Map();
const acknowledgements = [];
const errors = [];
let sequence = 0, peer = null, channel = null, lastAck = null, frames = 0;
let connection = 'connecting', lastVideoFrame = null;
const socket = new WebSocket(`ws://${location.host}`);
const sendSignal = (message) => socket.readyState === WebSocket.OPEN && socket.send(JSON.stringify(message));
function showControls() {
  for (const key of Object.keys(defaults)) {
    document.getElementById(key).value = controls[key];
    document.getElementById(`${key}Value`).value = Number(controls[key]).toFixed(key === 'progress' ? 3 : ['selectedPiece', 'cameraFov'].includes(key) ? 0 : 2);
  }
}
function setControls(patch) {
  Object.assign(controls, patch);
  showControls();
  if (channel?.readyState !== 'open') return null;
  const command = { ...controls, sequence: ++sequence };
  const descriptor = JSON.stringify(command);
  const bytes = new ArrayBuffer(3 + descriptor.length * 2);
  const view = new DataView(bytes);
  view.setUint8(0, 50); // Epic's UIInteraction message.
  view.setUint16(1, descriptor.length, true);
  for (let i = 0; i < descriptor.length; ++i) view.setUint16(3 + i * 2, descriptor.charCodeAt(i), true);
  pending.set(sequence, performance.now());
  channel.send(bytes);
  return sequence;
}
function configureChannel(next) {
  channel = next;
  channel.binaryType = 'arraybuffer';
  channel.onopen = () => {
    status.textContent = 'Vídeo de Unreal conectado · control disponible';
    channel.send(new Uint8Array([1])); // Request quality control.
    channel.send(new Uint8Array([0])); // Request key frame.
    setControls(controls);
  };
  channel.onmessage = async ({ data }) => {
    const buffer = data instanceof ArrayBuffer ? data : await data.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    if (bytes[0] !== 1) return; // Epic's Response message.
    const decoded = new TextDecoder('utf-16le').decode(bytes.subarray(1)).replace(/\0+$/, '');
    const start = decoded.indexOf('{');
    if (start < 0) return;
    try {
      const ack = JSON.parse(decoded.slice(start));
      if (ack.kind !== 'kineti-state') return;
      const sentAt = pending.get(ack.sequence);
      const ackMs = sentAt === undefined ? null : performance.now() - sentAt;
      pending.delete(ack.sequence);
      lastAck = { ...ack, ackMs, receivedAt: performance.now(), videoFramesAtAck: frames };
      acknowledgements.push(lastAck);
      if (acknowledgements.length > 500) acknowledgements.shift();
      ackOutput.textContent = `UE confirma p=${ack.progress.toFixed(3)}\nPiezas=${ack.pieces}; selección=${ack.selectedPiece}\nPosición=[${ack.selected.map((v) => v.toFixed(1)).join(', ')}]\nSecuencia=${ack.sequence}\nIda y vuelta del control=${ackMs?.toFixed(1) ?? '—'} ms`;
    } catch (error) { errors.push(error.message); }
  };
}
async function receiveOffer(message) {
  peer?.close();
  peer = new RTCPeerConnection({ iceServers: [] });
  peer.onicecandidate = ({ candidate }) => candidate && sendSignal({ type: 'iceCandidate', candidate: candidate.toJSON() });
  peer.onconnectionstatechange = () => { connection = peer.connectionState; status.textContent = `Conexión de vídeo: ${connection}`; };
  peer.ondatachannel = ({ channel }) => configureChannel(channel);
  peer.ontrack = ({ track, streams }) => {
    if (track.kind === 'video') {
      video.srcObject = streams[0] || new MediaStream([track]);
      video.play().catch((error) => errors.push(error.message));
    }
  };
  await peer.setRemoteDescription({ type: 'offer', sdp: message.sdp });
  for (const candidate of queuedCandidates.splice(0)) await peer.addIceCandidate(candidate);
  const answer = await peer.createAnswer();
  await peer.setLocalDescription(answer);
  sendSignal({ type: 'answer', sdp: answer.sdp });
}
const queuedCandidates = [];
let signalChain = Promise.resolve();
socket.onopen = () => sendSignal({ type: 'listStreamers' });
socket.onmessage = ({ data }) => {
  signalChain = signalChain.then(async () => {
    const message = JSON.parse(data);
    if (message.type === 'streamerList') {
      if (message.ids.length) sendSignal({ type: 'subscribe', streamerId: message.ids[0] });
      else status.textContent = 'Servidor listo; esperando el render aislado de Unreal…';
    } else if (message.type === 'offer') await receiveOffer(message);
    else if (message.type === 'iceCandidate') {
      if (peer?.remoteDescription) await peer.addIceCandidate(message.candidate);
      else queuedCandidates.push(message.candidate);
    } else if (message.type === 'streamerDisconnected') {
      connection = 'disconnected'; status.textContent = 'El render de Unreal se ha detenido.';
    }
  }).catch((error) => { errors.push(error.message); status.textContent = error.message; });
};
socket.onerror = () => { errors.push('Signalling connection failed'); };
function frameCallback(now, metadata) {
  frames += 1;
  lastVideoFrame = { now, mediaTime: metadata.mediaTime, presentedFrames: metadata.presentedFrames, width: metadata.width, height: metadata.height, processingDuration: metadata.processingDuration };
  video.requestVideoFrameCallback(frameCallback);
}
if (video.requestVideoFrameCallback) video.requestVideoFrameCallback(frameCallback);
async function getStats() {
  if (!peer) return [];
  const result = [];
  (await peer.getStats()).forEach((row) => {
    if (row.type === 'inbound-rtp' && row.kind === 'video') result.push({ type: row.type, codecId: row.codecId, framesReceived: row.framesReceived, framesDecoded: row.framesDecoded, framesDropped: row.framesDropped, framesPerSecond: row.framesPerSecond, bytesReceived: row.bytesReceived, jitter: row.jitter, totalDecodeTime: row.totalDecodeTime, frameWidth: row.frameWidth, frameHeight: row.frameHeight });
    if (row.type === 'codec') result.push({ type: row.type, id: row.id, mimeType: row.mimeType });
    if (row.type === 'candidate-pair' && row.state === 'succeeded') result.push({ type: row.type, currentRoundTripTime: row.currentRoundTripTime });
  });
  return result;
}
setInterval(async () => {
  const stats = await getStats();
  const inbound = stats.find((row) => row.type === 'inbound-rtp');
  metrics.textContent = inbound ? `${inbound.frameWidth} × ${inbound.frameHeight} · ${inbound.framesPerSecond ?? '—'} fps recibidos · ${((inbound.bytesReceived || 0) / 1048576).toFixed(2)} MiB de vídeo\nEl tiempo del control no mide el retardo hasta el píxel visible.` : 'Esperando fotogramas decodificados…';
}, 1000);
for (const key of Object.keys(defaults)) document.getElementById(key).addEventListener('input', (event) => setControls({ [key]: Number(event.target.value) }));
document.querySelector('#reset').onclick = () => { scrollTo({ top: 0, behavior: 'instant' }); setControls(defaults); };
let scrollScheduled = false;
addEventListener('scroll', () => {
  if (scrollScheduled) return;
  scrollScheduled = true;
  requestAnimationFrame(() => {
    scrollScheduled = false;
    setControls({ progress: Math.min(1, Math.max(0, scrollY / (document.documentElement.scrollHeight - innerHeight))) });
  });
}, { passive: true });
window.__UNREAL_PROBE__ = {
  setControls, setProgress: (progress) => setControls({ progress }), getControls: () => ({ ...controls }),
  getState: () => ({ connection, channel: channel?.readyState, frames, lastVideoFrame, ack: lastAck, errors: [...errors] }),
  getAcknowledgements: () => acknowledgements.slice(), getStats,
};
showControls();
