const socket = io("https://sucksexfull.onrender.com");

const screens = {
  landing: document.getElementById('landing-page'),
  setup: document.getElementById('setup-page'),
  mode: document.getElementById('mode-page'),
  search: document.getElementById('search-page'),
  chat: document.getElementById('chat-page'),
  video: document.getElementById('video-page'),
};

const landingContinue = document.getElementById('landing-continue');
const setupContinue = document.getElementById('setup-continue');
const usernameInput = document.getElementById('username');
const genderInput = document.getElementById('gender');
const preferenceInput = document.getElementById('preference');
const setupError = document.getElementById('setup-error');
const globalNotice = document.getElementById('global-notice');
const modeButtons = document.querySelectorAll('.mode-btn');

const chatTitle = document.getElementById('chat-title');
const chatSubtitle = document.getElementById('chat-subtitle');
const chatMessages = document.getElementById('chat-messages');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const chatNext = document.getElementById('chat-next');
const chatAddFriend = document.getElementById('chat-add-friend');
const reconnectLast = document.getElementById('reconnect-last');
const friendSelect = document.getElementById('friend-select');
const reconnectFriend = document.getElementById('reconnect-friend');

const videoSubtitle = document.getElementById('video-subtitle');
const videoEnd = document.getElementById('video-end');
const videoNext = document.getElementById('video-next');
const videoAddFriend = document.getElementById('video-add-friend');
const localVideo = document.getElementById('local-video');
const remoteVideo = document.getElementById('remote-video');

let profile = null;
let currentMode = null;
let currentPartner = null;
let lastPartner = null;
let friends = JSON.parse(localStorage.getItem('sfs_friends') || '[]');

let localStream = null;
let peerConnection = null;

const rtcConfig = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

function showScreen(name) {
  Object.values(screens).forEach((screen) => screen.classList.remove('active'));
  screens[name].classList.add('active');
}

function notify(text) {
  globalNotice.textContent = text;
}

function setFriendSelect() {
  friendSelect.innerHTML = '';
  if (friends.length === 0) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = 'No friends yet';
    friendSelect.appendChild(option);
    return;
  }

  friends.forEach((name) => {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    friendSelect.appendChild(option);
  });
}

function rememberFriend(username) {
  if (!username || friends.includes(username)) {
    return;
  }
  friends.push(username);
  localStorage.setItem('sfs_friends', JSON.stringify(friends));
  setFriendSelect();
}

function addMessage(text, type) {
  const bubble = document.createElement('div');
  bubble.className = `message ${type}`;
  bubble.textContent = text;
  chatMessages.appendChild(bubble);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function clearMessages() {
  chatMessages.innerHTML = '';
}

async function startLocalMedia() {
  if (localStream) {
    return localStream;
  }
  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  localVideo.srcObject = localStream;
  return localStream;
}

function stopLocalMedia() {
  if (!localStream) {
    return;
  }
  localStream.getTracks().forEach((track) => track.stop());
  localStream = null;
  localVideo.srcObject = null;
}

function destroyPeerConnection() {
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }
  remoteVideo.srcObject = null;
}

async function createPeerConnection(isCaller) {
  destroyPeerConnection();
  peerConnection = new RTCPeerConnection(rtcConfig);

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit('webrtc_ice_candidate', { candidate: event.candidate });
    }
  };

  peerConnection.ontrack = (event) => {
    remoteVideo.srcObject = event.streams[0];
  };

  const stream = await startLocalMedia();
  stream.getTracks().forEach((track) => peerConnection.addTrack(track, stream));

  if (isCaller) {
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket.emit('webrtc_offer', { sdp: offer });
  }
}

landingContinue.addEventListener('click', () => {
  showScreen('setup');
  notify('');
});

setupContinue.addEventListener('click', () => {
  const username = usernameInput.value.trim();
  if (!username) {
    setupError.textContent = 'Username is required.';
    return;
  }

  setupError.textContent = '';
  const gender = genderInput.value;
  const preference = preferenceInput.value;

  socket.emit('register_user', { username, gender, preference }, (result) => {
    if (!result.ok) {
      setupError.textContent = result.error;
      return;
    }

    profile = { username, gender, preference };
    showScreen('mode');
    notify(`Welcome, ${username}. Choose chat or video.`);
  });
});

modeButtons.forEach((button) => {
  button.addEventListener('click', () => {
    currentMode = button.dataset.mode;
    currentPartner = null;
    showScreen('search');
    notify(`Searching for a ${currentMode} match...`);
    socket.emit('select_mode', { mode: currentMode });
  });
});

chatForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const text = chatInput.value.trim();
  if (!text) {
    return;
  }

  addMessage(`You: ${text}`, 'me');
  socket.emit('chat_message', { text });
  chatInput.value = '';
});

chatNext.addEventListener('click', () => {
  socket.emit('next_user');
  showScreen('search');
  notify('Finding the next user...');
});

chatAddFriend.addEventListener('click', () => {
  socket.emit('add_friend');
});

reconnectLast.addEventListener('click', () => {
  if (!lastPartner) {
    notify('No last user to reconnect with yet.');
    return;
  }

  socket.emit('reconnect_user', { username: lastPartner, mode: 'text' });
});

reconnectFriend.addEventListener('click', () => {
  const username = friendSelect.value;
  if (!username) {
    return;
  }

  socket.emit('reconnect_user', { username, mode: 'text' });
});

videoEnd.addEventListener('click', () => {
  destroyPeerConnection();
  stopLocalMedia();
  showScreen('mode');
  notify('Call ended. Select a mode to continue.');
});

videoNext.addEventListener('click', () => {
  destroyPeerConnection();
  stopLocalMedia();
  socket.emit('next_user');
  showScreen('search');
});

videoAddFriend.addEventListener('click', () => {
  socket.emit('add_friend');
});

socket.on('searching', ({ mode }) => {
  currentMode = mode;
  showScreen('search');
  notify('Searching for an available match...');
});

socket.on('matched', async ({ mode, partnerUsername }) => {
  currentMode = mode;
  currentPartner = partnerUsername;
  lastPartner = partnerUsername;

  if (mode === 'video') {
    showScreen('video');
    videoSubtitle.textContent = `${profile.username} ↔ ${partnerUsername}`;
    notify(`Connected to ${partnerUsername} (video)`);
    try {
      await createPeerConnection(profile.username.localeCompare(partnerUsername) < 0);
    } catch (error) {
      notify('Unable to access camera/mic. Check browser permissions.');
    }
    return;
  }

  showScreen('chat');
  chatTitle.textContent = `Text Chat: ${profile.username} ↔ ${partnerUsername}`;
  chatSubtitle.textContent = 'Stay respectful. Use Next to skip.';
  clearMessages();
  addMessage(`Connected with ${partnerUsername}`, 'system');
  notify(`Connected to ${partnerUsername} (text chat)`);
});

socket.on('chat_message', ({ from, text }) => {
  addMessage(`${from}: ${text}`, 'them');
});

socket.on('partner_left', ({ username }) => {
  currentPartner = null;
  destroyPeerConnection();
  stopLocalMedia();
  showScreen('search');
  notify(`${username} disconnected. Searching for someone else...`);
});

socket.on('friend_added', ({ username }) => {
  rememberFriend(username);
  notify(`${username} added to friends.`);
});

socket.on('reconnect_result', ({ ok, message }) => {
  notify(message);
  if (ok) {
    showScreen('search');
  }
});

socket.on('system_error', ({ message }) => {
  notify(message);
});

socket.on('webrtc_offer', async ({ sdp }) => {
  try {
    if (!peerConnection) {
      await createPeerConnection(false);
    }
    await peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    socket.emit('webrtc_answer', { sdp: answer });
  } catch (error) {
    notify('Video signaling error while handling offer.');
  }
});

socket.on('webrtc_answer', async ({ sdp }) => {
  try {
    if (!peerConnection) {
      return;
    }
    await peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
  } catch (error) {
    notify('Video signaling error while handling answer.');
  }
});

socket.on('webrtc_ice_candidate', async ({ candidate }) => {
  try {
    if (peerConnection && candidate) {
      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    }
  } catch (error) {
    notify('Video signaling error while adding ICE candidate.');
  }
});

setFriendSelect();
