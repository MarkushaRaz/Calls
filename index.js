const ws = new WebSocket(`wss://sigmacalls.onrender.com`);
const callBtn = document.getElementById('callBtn');
const remoteAudio = document.getElementById('remoteAudio');

let localStream;
let pc;

const config = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

async function startCall() {
  localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  
  pc = new RTCPeerConnection(config);
  
  // Добавляем локальный аудио поток
  localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

  // Когда приходит удаленный поток
  pc.ontrack = (event) => {
    remoteAudio.srcObject = event.streams[0];
  };

  // ICE кандидаты
  pc.onicecandidate = (event) => {
    if (event.candidate) {
      ws.send(JSON.stringify({ type: 'ice', candidate: event.candidate }));
    }
  };

  // Если ты первый клиент, создаем оффер
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  ws.send(JSON.stringify({ type: 'offer', sdp: offer }));
}

ws.onmessage = async (message) => {
  const data = JSON.parse(message.data);

  if (!pc) await startCall();

  if (data.type === 'offer') {
    await pc.setRemoteDescription(data.sdp);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    ws.send(JSON.stringify({ type: 'answer', sdp: answer }));
  } else if (data.type === 'answer') {
    await pc.setRemoteDescription(data.sdp);
  } else if (data.type === 'ice') {
    try {
      await pc.addIceCandidate(data.candidate);
    } catch (e) {
      console.error('Error adding ICE candidate', e);
    }
  }
};

callBtn.onclick = startCall;