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

  socket.on("start", () => {

    // Remove duplicates
    queue = queue.filter(id => id !== socket.id);

    queue.push(socket.id);

    tryMatch();
  });

  function tryMatch() {
    while (queue.length >= 2) {
      const id1 = queue.shift();
      const id2 = queue.shift();

      const user1 = io.sockets.sockets.get(id1);
      const user2 = io.sockets.sockets.get(id2);

      if (!user1 || !user2) continue;

      user1.partner = id2;
      user2.partner = id1;

      user1.emit("matched", { caller: true });
      user2.emit("matched", { caller: false });
    }
  }

  socket.on("webrtc_offer", ({ sdp }) => {
    io.to(socket.partner).emit("webrtc_offer", { sdp });
  });

  socket.on("webrtc_answer", ({ sdp }) => {
    io.to(socket.partner).emit("webrtc_answer", { sdp });
  });

  socket.on("webrtc_ice_candidate", ({ candidate }) => {
    io.to(socket.partner).emit("webrtc_ice_candidate", { candidate });
  });

  socket.on("next", () => {
    if (socket.partner) {
      io.to(socket.partner).emit("partner_left");
    }

    socket.partner = null;
    socket.emit("start");
  });

  socket.on("disconnect", () => {
    queue = queue.filter(id => id !== socket.id);

    if (socket.partner) {
      io.to(socket.partner).emit("partner_left");
    }
  });
});

server.listen(3000);
