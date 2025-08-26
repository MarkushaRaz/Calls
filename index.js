const logDiv = document.getElementById('log');
const callBtn = document.getElementById('callBtn');
const remoteAudio = document.getElementById('remoteAudio');

let localStream;
let pc;
let ws;

// Функция логирования
function log(msg) {
  console.log(msg);
  logDiv.textContent += msg + '\n';
  logDiv.scrollTop = logDiv.scrollHeight;
}

// Подключение к серверу сигналинга
function connectWS() {
  // Замените на свой Render сервер
  ws = new WebSocket('wss://sigmacalls.onrender.com');

  ws.onopen = () => log('✅ WebSocket connected');
  ws.onclose = () => log('⚠️ WebSocket closed');
  ws.onerror = (err) => log('❌ WebSocket error: ' + JSON.stringify(err));

  ws.onmessage = async (message) => {
    const data = JSON.parse(message.data);
    log('⬅️ Message received: ' + JSON.stringify(data));

    if (!pc) await startCall(true); // true = мы отвечаем

    if (data.type === 'offer') {
      log('📨 Offer received');
      await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      ws.send(JSON.stringify({ type: 'answer', sdp: answer }));
      log('📤 Answer sent');
    } else if (data.type === 'answer') {
      log('📨 Answer received');
      await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
    } else if (data.type === 'ice') {
      log('🌐 ICE candidate received');
      try {
        await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
      } catch (e) {
        log('❌ Error adding ICE candidate: ' + e);
      }
    }
  };
}

// Конфигурация RTCPeerConnection
const config = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' }
    // Для стабильности можно добавить TURN сервер сюда
  ]
};

// Запуск звонка
async function startCall(isAnswer = false) {
  log('🎬 Starting call');
  localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  log('🎤 Local audio stream obtained');

  pc = new RTCPeerConnection(config);

  // Добавляем локальные треки
  localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

  // Когда приходит удаленный поток
  pc.ontrack = (event) => {
    log('🎧 Remote track received');
    remoteAudio.srcObject = event.streams[0];
  };

  // ICE кандидаты
  pc.onicecandidate = (event) => {
    if (event.candidate) {
      log('🌐 ICE candidate generated');
      ws.send(JSON.stringify({ type: 'ice', candidate: event.candidate }));
    }
  };

  if (!isAnswer) {
    // Мы инициатор — создаем offer
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    ws.send(JSON.stringify({ type: 'offer', sdp: offer }));
    log('📤 Offer sent');
  }
}

// Кнопка старт
callBtn.onclick = async () => {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    connectWS();
    // Даем WebSocket время подключиться
    setTimeout(() => startCall(), 500);
  } else {
    startCall();
  }
};