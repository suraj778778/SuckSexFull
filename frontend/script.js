const socket = io();

let localStream;
let peerConnection;
let isFront = true;
let isSwapped = false;
let isSearching = false;

const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");

const placeholder = document.getElementById("placeholder");
const searching = document.getElementById("searching");

/* INIT STATE */
searching.style.display = "none";

/* ICE */
const config = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
};

/* START */
document.getElementById("startBtn").onclick = async () => {
  await startCamera();
  startSearching();
};

/* CAMERA */
async function startCamera() {
  localStream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: isFront ? "user" : "environment" },
    audio: true
  });

  localVideo.srcObject = localStream;
}

/* SEARCH */
function startSearching() {
  isSearching = true;
  searching.style.display = "flex";

  placeholder.style.display = "none";
  remoteVideo.style.display = "none";

  socket.emit("start");
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

    searching.style.display = "none";
    isSearching = false;
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

/* NEXT (OMEGLE STYLE) */
document.getElementById("nextBtn").onclick = () => {
  resetCall();
  startSearching();
};

/* STOP */
document.getElementById("stopBtn").onclick = () => {
  resetCall();
};

/* RESET */
function resetCall() {
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }

  remoteVideo.srcObject = null;
  remoteVideo.style.display = "none";

  searching.style.display = "none";
  isSearching = false;

  socket.emit("next");
}

/* PARTNER LEFT */
socket.on("partner_left", () => {
  resetCall();
  startSearching();
});

/* 🔁 PERFECT SWAP */
function swapVideos() {
  isSwapped = !isSwapped;

  if (isSwapped) {
    localVideo.style.width = "100%";
    localVideo.style.height = "100%";
    localVideo.style.top = "0";
    localVideo.style.left = "0";
    localVideo.style.zIndex = "1";

    remoteVideo.style.width = "120px";
    remoteVideo.style.height = "160px";
    remoteVideo.style.bottom = "80px";
    remoteVideo.style.right = "10px";
    remoteVideo.style.zIndex = "10";
  } else {
    remoteVideo.style.width = "100%";
    remoteVideo.style.height = "100%";
    remoteVideo.style.top = "0";
    remoteVideo.style.left = "0";
    remoteVideo.style.zIndex = "1";

    localVideo.style.width = "120px";
    localVideo.style.height = "160px";
    localVideo.style.bottom = "80px";
    localVideo.style.right = "10px";
    localVideo.style.zIndex = "10";
  }
}

/* CLICK TO SWAP */
localVideo.onclick = swapVideos;
remoteVideo.onclick = swapVideos;

/* FILTER */
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

/* SWITCH CAMERA */
document.getElementById("cameraBtn").onclick = async () => {
  isFront = !isFront;
  await startCamera();
};
