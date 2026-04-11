const socket = io();

let localStream;
let peerConnection;
let isFront = true;
let isSwapped = false;

const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");

const placeholder = document.getElementById("placeholder");
const searching = document.getElementById("searching");

/* ICE */
const config = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" }
  ]
};

/* START */
document.getElementById("startBtn").onclick = async () => {
  await startCamera();
  showSearching(true);
  socket.emit("start");
};

/* CAMERA */
async function startCamera() {
  localStream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: isFront ? "user" : "environment" },
    audio: true
  });

  localVideo.srcObject = localStream;
}

/* PEER */
function createPeer() {
  peerConnection = new RTCPeerConnection(config);

  localStream.getTracks().forEach(track => {
    peerConnection.addTrack(track, localStream);
  });

  peerConnection.ontrack = (event) => {
    remoteVideo.srcObject = event.streams[0];
    remoteVideo.style.display = "block";
    placeholder.style.display = "none";
    showSearching(false);
  };

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit("webrtc_ice_candidate", {
        candidate: event.candidate
      });
    }
  };
}

/* MATCH */
socket.on("matched", async ({ caller }) => {
  createPeer();

  if (caller) {
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    socket.emit("webrtc_offer", { sdp: offer });
  }
});

/* OFFER */
socket.on("webrtc_offer", async ({ sdp }) => {
  createPeer();

  await peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));

  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);

  socket.emit("webrtc_answer", { sdp: answer });
});

/* ANSWER */
socket.on("webrtc_answer", async ({ sdp }) => {
  await peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
});

/* ICE */
socket.on("webrtc_ice_candidate", async ({ candidate }) => {
  try {
    await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
  } catch {}
});

/* NEXT */
document.getElementById("nextBtn").onclick = () => {
  resetCall();
  showSearching(true);
  socket.emit("next");
};

/* STOP */
document.getElementById("stopBtn").onclick = () => {
  resetCall();
};

/* RESET */
function resetCall() {
  if (peerConnection) peerConnection.close();

  remoteVideo.srcObject = null;
  remoteVideo.style.display = "none";
  placeholder.style.display = "block";

  socket.emit("disconnect");
}

/* PARTNER LEFT */
socket.on("partner_left", () => {
  resetCall();
  showSearching(true);
});

/* SEARCH UI */
function showSearching(show) {
  searching.style.display = show ? "flex" : "none";
}

/* 🔁 SWAP VIDEO */
localVideo.onclick = remoteVideo.onclick = () => {
  isSwapped = !isSwapped;

  if (isSwapped) {
    localVideo.classList.add("big");
    remoteVideo.classList.add("small");
  } else {
    localVideo.classList.remove("big");
    remoteVideo.classList.remove("small");
  }
};

/* 🎨 FILTER */
let filterIndex = 0;
const filters = [
  "none",
  "grayscale(1)",
  "sepia(1)",
  "contrast(1.5)",
  "brightness(1.3)",
  "blur(2px)"
];

document.getElementById("filterBtn").onclick = () => {
  filterIndex = (filterIndex + 1) % filters.length;
  localVideo.style.filter = filters[filterIndex];
};

/* 🔄 SWITCH CAM */
document.getElementById("cameraBtn").onclick = async () => {
  isFront = !isFront;
  await startCamera();
};
