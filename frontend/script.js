const socket = io();

/* ---------------- SCREENS ---------------- */
const screens = {
  landing: document.getElementById('landing-page'),
  setup: document.getElementById('setup-page'),
  modePage: document.getElementById('mode-page'),
  search: document.getElementById('search-page'),
  chat: document.getElementById('chat-page'),
  video: document.getElementById('video-page'),
};

function showScreen(name) {
  Object.values(screens).forEach(screen => {
    screen.classList.remove('active');
  });
  screens[name].classList.add('active');
}

/* ---------------- VARIABLES ---------------- */
let localStream;
let peerConnection;

const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");

/* 🔥 UPDATED ICE CONFIG (TURN ADDED) */
const config = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },

    {
      urls: "turn:openrelay.metered.ca:80",
      username: "openrelayproject",
      credential: "openrelayproject"
    },
    {
      urls: "turn:openrelay.metered.ca:443",
      username: "openrelayproject",
      credential: "openrelayproject"
    }
  ]
};

/* ---------------- LANDING ---------------- */
document.getElementById('landing-continue').onclick = () => {
  showScreen('setup');
};

/* ---------------- SETUP ---------------- */
document.getElementById('setup-continue').onclick = async () => {
  const name = document.getElementById('username').value;
  const mode = document.getElementById('mode').value;

  if (!name || !mode) {
    alert("Enter name and select option");
    return;
  }

  socket.emit("register_user", {
    username: name,
    gender: "male",
    preference: "random"
  });

  showScreen('search');

  if (mode === "video") {
    await startCamera();
  }

  socket.emit("select_mode", { mode });
};

/* ---------------- CAMERA ---------------- */
async function startCamera() {
  localStream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true
  });

  if (localVideo) {
    localVideo.srcObject = localStream;
  }
}

/* ---------------- CREATE PEER ---------------- */
function createPeer() {
  peerConnection = new RTCPeerConnection(config);

  localStream.getTracks().forEach(track => {
    peerConnection.addTrack(track, localStream);
  });

  peerConnection.ontrack = (event) => {
    remoteVideo.srcObject = event.streams[0];
  };

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit("webrtc_ice_candidate", {
        candidate: event.candidate
      });
    }
  };
}

/* ---------------- MATCHED ---------------- */
socket.on("matched", async ({ mode }) => {
  if (mode === "video") {
    showScreen('video');
    createPeer();

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    socket.emit("webrtc_offer", {
      sdp: offer
    });
  } else {
    showScreen('chat');
  }
});

/* ---------------- OFFER ---------------- */
socket.on("webrtc_offer", async ({ sdp }) => {
  createPeer();

  await peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));

  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);

  socket.emit("webrtc_answer", {
    sdp: answer
  });
});

/* ---------------- ANSWER ---------------- */
socket.on("webrtc_answer", async ({ sdp }) => {
  await peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
});

/* ---------------- ICE ---------------- */
socket.on("webrtc_ice_candidate", async ({ candidate }) => {
  try {
    await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
  } catch (e) {
    console.error(e);
  }
});

/* ---------------- NEXT ---------------- */
function nextUser() {
  if (peerConnection) peerConnection.close();
  if (remoteVideo) remoteVideo.srcObject = null;

  socket.emit("next_user");
}

/* ---------------- DISCONNECT ---------------- */
socket.on("partner_left", () => {
  if (peerConnection) peerConnection.close();
  if (remoteVideo) remoteVideo.srcObject = null;

  showScreen('search');
});
