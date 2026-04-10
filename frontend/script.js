const socket = io();

let localStream;
let peerConnection;
let currentFilter = 0;
let facingMode = "user";

const filters = [
  "none",
  "grayscale(100%)",
  "sepia(100%)",
  "contrast(200%)",
  "blur(5px)",
  "hue-rotate(90deg)"
];

const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
const placeholder = document.getElementById("placeholder");
const searching = document.getElementById("searching");

const config = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
};

/* CAMERA */
async function startCamera() {
  localStream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode },
    audio: true
  });

  localVideo.srcObject = localStream;
}

/* START */
startBtn.onclick = async () => {
  await startCamera();
  searching.style.display = "block";
  placeholder.style.display = "none";

  socket.emit("start");
};

/* CREATE PEER */
function createPeer() {
  peerConnection = new RTCPeerConnection(config);

  localStream.getTracks().forEach(track => {
    peerConnection.addTrack(track, localStream);
  });

  peerConnection.ontrack = e => {
    remoteVideo.srcObject = e.streams[0];
    remoteVideo.style.display = "block";
    searching.style.display = "none";
  };

  peerConnection.onicecandidate = e => {
    if (e.candidate) {
      socket.emit("webrtc_ice_candidate", { candidate: e.candidate });
    }
  };
}

/* MATCH */
socket.on("matched", ({ caller }) => {
  createPeer();
  if (caller) createOffer();
});

async function createOffer() {
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  socket.emit("webrtc_offer", { sdp: offer });
}

socket.on("webrtc_offer", async ({ sdp }) => {
  createPeer();
  await peerConnection.setRemoteDescription(sdp);

  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);

  socket.emit("webrtc_answer", { sdp: answer });
});

socket.on("webrtc_answer", async ({ sdp }) => {
  await peerConnection.setRemoteDescription(sdp);
});

/* NEXT */
nextBtn.onclick = () => {
  peerConnection?.close();
  socket.emit("next");
};

/* STOP */
stopBtn.onclick = () => {
  peerConnection?.close();
  localStream?.getTracks().forEach(t => t.stop());
  remoteVideo.style.display = "none";
  placeholder.style.display = "block";
};

/* FILTER */
filterBtn.onclick = () => {
  currentFilter = (currentFilter + 1) % filters.length;
  remoteVideo.style.filter = filters[currentFilter];
  localVideo.style.filter = filters[currentFilter];
};

/* SWITCH CAMERA */
cameraBtn.onclick = async () => {
  facingMode = facingMode === "user" ? "environment" : "user";
  await startCamera();
};
