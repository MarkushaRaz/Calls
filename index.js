const logDiv = document.getElementById('log');
const callBtn = document.getElementById('callBtn');
const remoteAudio = document.getElementById('remoteAudio');

let pc;
let localStream;
let ws;

function log(msg) {
  console.log(msg);
  logDiv.textContent += msg + '\n';
  logDiv.scrollTop = logDiv.scrollHeight;
}

// Подключаемся к серверу сигналинга
function connectWS() {
  ws = new WebSocket('wss://sigmacalls.onrender.com'); // вставьте свой

  ws.onopen = () => {
    log('✅ WebSocket connected');
    ws.send(JSON.stringify({ type: 'ready' }));
  };

  ws.onmessage = async (event) => {
    const data = JSON.parse(event.data);
    log('⬅️ ' + JSON.stringify(data));

    if (data.type === 'start') {
      if (data.role === 'caller') startCall(false);
      else startCall(true);
    } else if (data.type === 'offer') {
      await pc.setRemoteDescription(data.sdp);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      ws.send(JSON.stringify({ type: 'answer', sdp: answer }));
      log('📤 Answer sent');
    } else if (data.type === 'answer') {
      await pc.setRemoteDescription(data.sdp);
      log('📨 Answer applied');
    } else if (data.type === 'ice') {
      try {
        await pc.addIceCandidate(data.candidate);
        log('🌐 ICE candidate added');
      } catch (e) {
        log('❌ ICE error: ' + e);
      }
    }
  };

  ws.onclose = () => log('⚠️ WebSocket closed');
  ws.onerror = (err) => log('❌ WebSocket error: ' + err);
}

const config = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

async function startCall(isAnswer = false) {
  log('🎬 Starting call');
  localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  log('🎤 Local stream obtained');

  pc = new RTCPeerConnection(config);
  localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

  pc.ontrack = (event) => {
    log('🎧 Remote track received');
    remoteAudio.srcObject = event.streams[0];
  };

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      ws.send(JSON.stringify({ type: 'ice', candidate: event.candidate }));
      log('🌐 ICE candidate generated');
    }
  };

  if (!isAnswer) {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    ws.send(JSON.stringify({ type: 'offer', sdp: offer }));
    log('📤 Offer sent');
  }
}

callBtn.onclick = () => {
  if (!ws || ws.readyState !== WebSocket.OPEN) connectWS();
};