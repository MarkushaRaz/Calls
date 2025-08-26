const logDiv = document.getElementById('log');
const callBtn = document.getElementById('callBtn');
const remoteAudio = document.getElementById('remoteAudio');

let ws;
let pc;
let localStream;

function log(msg) {
  console.log(msg);
  logDiv.textContent += msg + '\n';
  logDiv.scrollTop = logDiv.scrollHeight;
}

// ICE конфиг
const config = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

// Подключаемся к серверу сигналинга
function connectWS() {
  ws = new WebSocket('wss://sigmacalls.onrender.com/'); // вставьте свой домен

  ws.onopen = () => {
    log('✅ WebSocket connected');
    ws.send(JSON.stringify({ type: 'ready' }));
  };

  ws.onclose = () => log('⚠️ WebSocket closed');
  ws.onerror = (err) => log('❌ WebSocket error: ' + err);

  ws.onmessage = async (event) => {
    const data = JSON.parse(event.data);
    log('⬅️ ' + JSON.stringify(data));

    if (data.type === 'start') {
      // Подготовка локального потока и PeerConnection
      localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      log('🎤 Local audio obtained');
      initPeerConnection();

      // Если мы caller — создаем offer
      if (data.role === 'caller') {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        ws.send(JSON.stringify({ type: 'offer', sdp: offer }));
        log('📤 Offer sent');
      }
      // callee ждет offer через ws.onmessage дальше
    } else if (data.type === 'offer') {
      await pc.setRemoteDescription(data.sdp);
      log('📨 Offer applied');

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
}

// Инициализация RTCPeerConnection
function initPeerConnection() {
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
}

// Кнопка старт
callBtn.onclick = () => {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    connectWS();
  }
};