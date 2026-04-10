const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, '../frontend')));

let queue = [];

io.on('connection', (socket) => {
  console.log("User connected:", socket.id);

  socket.on("start", () => {
    // remove if already in queue
    queue = queue.filter(s => s.id !== socket.id);

    queue.push(socket);

    tryMatch();
  });

  function tryMatch() {
    while (queue.length >= 2) {
      const user1 = queue.shift();
      const user2 = queue.shift();

      if (!user1 || !user2) return;

      user1.partner = user2.id;
      user2.partner = user1.id;

      user1.emit("matched", { caller: true });
      user2.emit("matched", { caller: false });

      console.log("Matched:", user1.id, user2.id);
    }
  }

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

  socket.on("next", () => {
    if (socket.partner) {
      io.to(socket.partner).emit("partner_left");
    }

    socket.partner = null;

    queue.push(socket);
    tryMatch();
  });

  socket.on("disconnect", () => {
    queue = queue.filter(s => s.id !== socket.id);

    if (socket.partner) {
      io.to(socket.partner).emit("partner_left");
    }
  });
});

server.listen(3000, () => {
  console.log("Server running");
});
