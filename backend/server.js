const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

/* ✅ FIXED PATH */
app.use(express.static(path.join(__dirname, 'frontend')));

/* ---------------- BASIC MATCHING ---------------- */
let waitingUser = null;

io.on('connection', (socket) => {
  console.log("User connected:", socket.id);

  socket.on("register_user", () => {
    console.log("User registered");
  });

  socket.on("select_mode", ({ mode }) => {

    if (waitingUser) {
      const partner = waitingUser;
      waitingUser = null;

      socket.partner = partner.id;
      partner.partner = socket.id;

      socket.emit("matched", { mode: "video" });
      partner.emit("matched", { mode: "video" });

    } else {
      waitingUser = socket;
    }
  });

  socket.on("webrtc_offer", ({ sdp }) => {
    if (socket.partner) {
      io.to(socket.partner).emit("webrtc_offer", { sdp });
    }
  });

  socket.on("webrtc_answer", ({ sdp }) => {
    if (socket.partner) {
      io.to(socket.partner).emit("webrtc_answer", { sdp });
    }
  });

  socket.on("webrtc_ice_candidate", ({ candidate }) => {
    if (socket.partner) {
      io.to(socket.partner).emit("webrtc_ice_candidate", { candidate });
    }
  });

  socket.on("next_user", () => {
    if (socket.partner) {
      io.to(socket.partner).emit("partner_left");
    }
    socket.partner = null;
    waitingUser = socket;
  });

});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
