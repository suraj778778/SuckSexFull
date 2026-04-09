const socket = io();

let localStream;
let peerConnection;

const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");

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

/* ---------------- START BUTTON ---------------- */
document.getElementById("startBtn").onclick = async () => {
  try {
    // START CAMERA
    localStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true
    });

    localVideo.srcObject = localStream;

    // START MATCHING (IMPORTANT CHANGE)
    socket.emit("start");

  } catch (e) {
    alert("Camera error");
    console.error(e);
  }
};

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
socket.on("matched", async () => {
  createPeer();

  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);

  socket.emit("webrtc_offer", {
    sdp: offer
  });
});

/* ---------------- OFFER ---------------- */
socket.on("webrtc_offer", async ({ sdp }) => {
  createPeer();

  await peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));

  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);

  socket.emit("webrtc_answer", { sdp: answer });
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

/* ---------------- NEXT BUTTON ---------------- */
document.getElementById("nextBtn").onclick = () => {
  if (peerConnection) peerConnection.close();
  remoteVideo.srcObject = null;

  socket.emit("start"); // find new user
};

/* ---------------- STOP BUTTON ---------------- */
document.getElementById("stopBtn").onclick = () => {
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
  }

  if (peerConnection) peerConnection.close();

  remoteVideo.srcObject = null;
};
