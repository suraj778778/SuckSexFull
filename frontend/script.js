const socket = io();

let localStream;
let peerConnection = null;
let facingMode = "user";

const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
const searching = document.getElementById("searching");
const placeholder = document.getElementById("placeholder");

/* ICE SERVERS */
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

  placeholder.style.display = "none";
  searching.style.display = "flex";

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
    console.log("REMOTE STREAM RECEIVED");

    remoteVideo.srcObject = event.streams[0];
    remoteVideo.style.display = "block";

    searching.style.display = "none";
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
socket.on("matched", ({ caller }) => {
  console.log("MATCHED");

  createPeer();

  if (caller) {
    createOffer();
  }
});

/* OFFER */
async function createOffer() {
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);

  socket.emit("webrtc_offer", { sdp: offer });
}

/* RECEIVE OFFER */
socket.on("webrtc_offer", async ({ sdp }) => {
  console.log("OFFER RECEIVED");

  createPeer();

  await peerConnection.setRemoteDescription(
    new RTCSessionDescription(sdp)
  );

  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);

  socket.emit("webrtc_answer", { sdp: answer });
});

/* RECEIVE ANSWER */
socket.on("webrtc_answer", async ({ sdp }) => {
  console.log("ANSWER RECEIVED");

  await peerConnection.setRemoteDescription(
    new RTCSessionDescription(sdp)
  );
});

/* ICE */
socket.on("webrtc_ice_candidate", async ({ candidate }) => {
  try {
    if (peerConnection) {
      await peerConnection.addIceCandidate(
        new RTCIceCandidate(candidate)
      );
    }
  } catch (e) {
    console.log("ICE ERROR", e);
  }
});

/* NEXT */
nextBtn.onclick = () => {
  resetConnection();

  searching.style.display = "flex";

  socket.emit("next");
};

/* STOP */
stopBtn.onclick = () => {
  resetConnection();

  localStream?.getTracks().forEach(track => track.stop());

  placeholder.style.display = "block";
  searching.style.display = "none";
};

/* RESET */
function resetConnection() {
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }

  remoteVideo.srcObject = null;
  remoteVideo.style.display = "none";
}

/* SWITCH CAMERA */
cameraBtn.onclick = async () => {
  facingMode = facingMode === "user" ? "environment" : "user";
  startBtn.click();
};
