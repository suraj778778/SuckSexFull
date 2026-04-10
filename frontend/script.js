const socket = io();

let localStream;
let peerConnection;
let isCaller = false;
let facingMode = "user";

const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
const searching = document.getElementById("searching");

/* ICE (FIXED WITH TURN) */
const config = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    {
      urls: "turn:openrelay.metered.ca:80",
      username: "openrelayproject",
      credential: "openrelayproject"
    }
  ]
};

/* START */
startBtn.onclick = async () => {
  localStream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode },
    audio: true
  });

  localVideo.srcObject = localStream;

  searching.style.display = "block";

  socket.emit("start");
};

/* CREATE PEER */
function createPeer() {
  if (peerConnection) return;

  peerConnection = new RTCPeerConnection(config);

  localStream.getTracks().forEach(track => {
    peerConnection.addTrack(track, localStream);
  });

  peerConnection.ontrack = (e) => {
    remoteVideo.srcObject = e.streams[0];
    remoteVideo.style.display = "block";
    searching.style.display = "none";
  };

  peerConnection.onicecandidate = (e) => {
    if (e.candidate) {
      socket.emit("webrtc_ice_candidate", { candidate: e.candidate });
    }
  };
}

/* MATCH */
socket.on("matched", ({ caller }) => {
  isCaller = caller;

  createPeer();

  if (isCaller) createOffer();
});

/* OFFER */
async function createOffer() {
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  socket.emit("webrtc_offer", { sdp: offer });
}

/* RECEIVE OFFER */
socket.on("webrtc_offer", async ({ sdp }) => {
  createPeer();

  await peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));

  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);

  socket.emit("webrtc_answer", { sdp: answer });
});

/* RECEIVE ANSWER */
socket.on("webrtc_answer", async ({ sdp }) => {
  await peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
});

/* ICE */
socket.on("webrtc_ice_candidate", async ({ candidate }) => {
  if (peerConnection) {
    await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
  }
});

/* NEXT */
nextBtn.onclick = () => {
  peerConnection?.close();
  peerConnection = null;

  remoteVideo.style.display = "none";
  searching.style.display = "block";

  socket.emit("next");
};

/* STOP */
stopBtn.onclick = () => {
  peerConnection?.close();
  peerConnection = null;

  localStream?.getTracks().forEach(t => t.stop());

  remoteVideo.style.display = "none";
  searching.style.display = "none";
};

/* SWITCH CAMERA */
cameraBtn.onclick = async () => {
  facingMode = facingMode === "user" ? "environment" : "user";
  startBtn.click();
};

/* 🔥 TAP TO SWAP VIDEO */
remoteVideo.onclick = swap;
localVideo.onclick = swap;

function swap() {
  remoteVideo.classList.toggle("small");
  remoteVideo.classList.toggle("fullscreen");

  localVideo.classList.toggle("small");
  localVideo.classList.toggle("fullscreen");
}
