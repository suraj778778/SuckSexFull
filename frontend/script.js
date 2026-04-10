const socket = io();

let localStream;
let peerConnection = null;
let isCaller = false;

const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
const placeholder = document.getElementById("placeholder");
const searching = document.getElementById("searching");

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

/* UI STATES */
function showSearching() {
  searching.style.display = "block";
  placeholder.style.display = "none";
  remoteVideo.style.display = "none";
}

function showVideo() {
  searching.style.display = "none";
  placeholder.style.display = "none";
  remoteVideo.style.display = "block";
}

function showPlaceholder() {
  searching.style.display = "none";
  placeholder.style.display = "block";
  remoteVideo.style.display = "none";
}

/* START */
document.getElementById("startBtn").onclick = async () => {
  localStream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true
  });

  localVideo.srcObject = localStream;

  showSearching();

  socket.emit("start");
};

/* CREATE PEER */
function createPeer() {
  if (peerConnection) return;

  peerConnection = new RTCPeerConnection(config);

  localStream.getTracks().forEach(track => {
    peerConnection.addTrack(track, localStream);
  });

  peerConnection.ontrack = (event) => {
    remoteVideo.srcObject = event.streams[0];
    showVideo();
  };

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit("webrtc_ice_candidate", {
        candidate: event.candidate
      });
    }
  };
}

/* MATCHED */
socket.on("matched", (data) => {
  isCaller = data.caller;

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
document.getElementById("nextBtn").onclick = () => {
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }

  remoteVideo.srcObject = null;

  showSearching();

  socket.emit("start");
};

/* STOP */
document.getElementById("stopBtn").onclick = () => {
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }

  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
  }

  remoteVideo.srcObject = null;

  showPlaceholder();
};

/* PARTNER LEFT */
socket.on("partner_left", () => {
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }

  showSearching();

  socket.emit("start");
});
