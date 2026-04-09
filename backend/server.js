const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, '../frontend')));

let queue = [];

io.on('connection', (socket) => {

  socket.on("start", () => {

    queue.push(socket);

    if (queue.length >= 2) {
      const user1 = queue.shift();
      const user2 = queue.shift();

      user1.partner = user2.id;
      user2.partner = user1.id;

      // 🔥 FIX: send caller info
      user1.emit("matched", { caller: true });
      user2.emit("matched", { caller: false });
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
    queue = queue.filter(s => s.id !== socket.id);

    if (socket.partner) {
      io.to(socket.partner).emit("partner_left");
    }
  });
});

server.listen(PORT, () => {
  console.log("Server running");
});
