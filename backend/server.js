const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, '../frontend')));

// 🔥 QUEUE SYSTEM
let queue = [];

io.on('connection', (socket) => {
  console.log("User connected:", socket.id);

  socket.on("start", () => {
    console.log("User searching:", socket.id);

    // Add user to queue
    queue.push(socket);

    // If 2 users available → match
    if (queue.length >= 2) {
      const user1 = queue.shift();
      const user2 = queue.shift();

      user1.partner = user2.id;
      user2.partner = user1.id;

      user1.emit("matched");
      user2.emit("matched");

      console.log("Matched:", user1.id, user2.id);
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

    // Remove from queue if waiting
    queue = queue.filter(s => s.id !== socket.id);

    if (socket.partner) {
      io.to(socket.partner).emit("partner_left");
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
