const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, '../frontend')));

let waitingUser = null;

io.on('connection', (socket) => {
  console.log("User connected:", socket.id);

  socket.on("start", () => {

    console.log("User started:", socket.id);

    // If someone is already waiting
    if (waitingUser && waitingUser !== socket) {

      const partner = waitingUser;

      socket.partner = partner.id;
      partner.partner = socket.id;

      waitingUser = null;

      // CONNECT BOTH
      socket.emit("matched");
      partner.emit("matched");

      console.log("Matched:", socket.id, partner.id);

    } else {
      // Put user in waiting
      waitingUser = socket;
      console.log("Waiting:", socket.id);
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

  socket.on("disconnect", () => {
    console.log("Disconnected:", socket.id);

    if (waitingUser === socket) {
      waitingUser = null;
    }

    if (socket.partner) {
      io.to(socket.partner).emit("partner_left");
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
