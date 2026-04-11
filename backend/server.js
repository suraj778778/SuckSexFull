const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, '../frontend')));

/* 🔥 NEW MATCHING QUEUE */
let queue = [];

io.on('connection', (socket) => {
  console.log("User connected:", socket.id);

  /* START SEARCH */
  socket.on("start", () => {
    if (queue.length > 0) {
      const partner = queue.shift();

      socket.partner = partner.id;
      partner.partner = socket.id;

      socket.emit("matched", { caller: true });
      partner.emit("matched", { caller: false });

    } else {
      queue.push(socket);
    }
  });

  /* NEXT USER */
  socket.on("next", () => {
    leavePartner(socket);

    if (queue.length > 0) {
      const partner = queue.shift();

      socket.partner = partner.id;
      partner.partner = socket.id;

      socket.emit("matched", { caller: true });
      partner.emit("matched", { caller: false });

    } else {
      queue.push(socket);
    }
  });

  /* DISCONNECT */
  socket.on("disconnect", () => {
    leavePartner(socket);
    queue = queue.filter(u => u.id !== socket.id);
  });

  /* WEBRTC */
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

});

/* CLEAN PARTNER */
function leavePartner(socket) {
  if (socket.partner) {
    io.to(socket.partner).emit("partner_left");

    const partnerSocket = io.sockets.sockets.get(socket.partner);
    if (partnerSocket) {
      partnerSocket.partner = null;
    }

    socket.partner = null;
  }
}

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
