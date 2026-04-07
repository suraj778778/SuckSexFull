const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

const usersBySocketId = new Map();
const socketIdByUsername = new Map();
const waitingQueues = {
  text: [],
  video: [],
};

function isPreferenceMatch(user, other) {
  const userLikesOther = user.preference === 'random' || user.preference === other.gender;
  const otherLikesUser = other.preference === 'random' || other.preference === user.gender;
  return userLikesOther && otherLikesUser;
}

function removeFromQueues(socketId) {
  waitingQueues.text = waitingQueues.text.filter((id) => id !== socketId);
  waitingQueues.video = waitingQueues.video.filter((id) => id !== socketId);
}

function emitSearching(socket) {
  socket.emit('searching', { mode: usersBySocketId.get(socket.id)?.mode || 'text' });
}

function pairUsers(firstSocketId, secondSocketId, mode) {
  const firstSocket = io.sockets.sockets.get(firstSocketId);
  const secondSocket = io.sockets.sockets.get(secondSocketId);
  const firstUser = usersBySocketId.get(firstSocketId);
  const secondUser = usersBySocketId.get(secondSocketId);

  if (!firstSocket || !secondSocket || !firstUser || !secondUser) {
    return false;
  }

  firstUser.partnerId = secondSocketId;
  secondUser.partnerId = firstSocketId;
  firstUser.mode = mode;
  secondUser.mode = mode;
  firstUser.lastPartner = secondUser.username;
  secondUser.lastPartner = firstUser.username;

  firstSocket.emit('matched', { mode, partnerUsername: secondUser.username });
  secondSocket.emit('matched', { mode, partnerUsername: firstUser.username });
  return true;
}

function findMatchFor(socketId) {
  const user = usersBySocketId.get(socketId);
  if (!user || !user.mode) {
    return false;
  }

  const queue = waitingQueues[user.mode];
  for (let i = 0; i < queue.length; i += 1) {
    const candidateId = queue[i];
    if (candidateId === socketId) {
      continue;
    }

    const candidate = usersBySocketId.get(candidateId);
    if (!candidate || candidate.partnerId || candidate.mode !== user.mode) {
      continue;
    }

    if (!isPreferenceMatch(user, candidate)) {
      continue;
    }

    waitingQueues[user.mode] = queue.filter((id) => id !== socketId && id !== candidateId);
    return pairUsers(socketId, candidateId, user.mode);
  }

  return false;
}

function enqueueForMode(socketId, mode) {
  const user = usersBySocketId.get(socketId);
  const socket = io.sockets.sockets.get(socketId);
  if (!user || !socket) {
    return;
  }

  removeFromQueues(socketId);
  user.mode = mode;

  if (!findMatchFor(socketId)) {
    waitingQueues[mode].push(socketId);
    emitSearching(socket);
  }
}

function detachPartner(socketId, notifyPartner = true) {
  const user = usersBySocketId.get(socketId);
  if (!user || !user.partnerId) {
    return;
  }

  const partnerId = user.partnerId;
  const partner = usersBySocketId.get(partnerId);
  const partnerSocket = io.sockets.sockets.get(partnerId);

  user.partnerId = null;
  if (partner) {
    partner.partnerId = null;
    partner.lastPartner = user.username;
  }

  if (notifyPartner && partnerSocket && partner) {
    partnerSocket.emit('partner_left', { username: user.username });
    if (partner.mode) {
      enqueueForMode(partnerId, partner.mode);
    }
  }
}

io.on('connection', (socket) => {
  usersBySocketId.set(socket.id, {
    username: null,
    gender: 'other',
    preference: 'random',
    partnerId: null,
    mode: null,
    lastPartner: null,
  });

  socket.on('register_user', ({ username, gender, preference }, callback = () => {}) => {
    const cleanName = (username || '').trim().slice(0, 20);
    if (!cleanName) {
      callback({ ok: false, error: 'Username is required.' });
      return;
    }

    const nameTakenBy = socketIdByUsername.get(cleanName.toLowerCase());
    if (nameTakenBy && nameTakenBy !== socket.id) {
      callback({ ok: false, error: 'Username is already in use.' });
      return;
    }

    const user = usersBySocketId.get(socket.id);
    if (!user) {
      callback({ ok: false, error: 'Unable to register user.' });
      return;
    }

    if (user.username) {
      socketIdByUsername.delete(user.username.toLowerCase());
    }

    user.username = cleanName;
    user.gender = ['male', 'female', 'other'].includes(gender) ? gender : 'other';
    user.preference = ['male', 'female', 'random'].includes(preference) ? preference : 'random';

    socketIdByUsername.set(cleanName.toLowerCase(), socket.id);
    callback({ ok: true });
  });

  socket.on('select_mode', ({ mode }) => {
    const user = usersBySocketId.get(socket.id);
    if (!user || !user.username) {
      socket.emit('system_error', { message: 'Please complete setup first.' });
      return;
    }

    const selectedMode = mode === 'video' ? 'video' : 'text';
    detachPartner(socket.id, true);
    enqueueForMode(socket.id, selectedMode);
  });

  socket.on('chat_message', ({ text }) => {
    const user = usersBySocketId.get(socket.id);
    if (!user || !user.partnerId) {
      return;
    }

    const content = (text || '').trim();
    if (!content) {
      return;
    }

    const partnerSocket = io.sockets.sockets.get(user.partnerId);
    if (partnerSocket) {
      partnerSocket.emit('chat_message', {
        from: user.username,
        text: content,
      });
    }
  });

  socket.on('next_user', () => {
    const user = usersBySocketId.get(socket.id);
    if (!user || !user.mode) {
      return;
    }

    detachPartner(socket.id, true);
    enqueueForMode(socket.id, user.mode);
  });

  socket.on('add_friend', () => {
    const user = usersBySocketId.get(socket.id);
    if (!user || !user.partnerId) {
      return;
    }

    const partner = usersBySocketId.get(user.partnerId);
    if (!partner) {
      return;
    }

    socket.emit('friend_added', { username: partner.username });
  });

  socket.on('reconnect_user', ({ username, mode }) => {
    const user = usersBySocketId.get(socket.id);
    if (!user || !user.username) {
      return;
    }

    const targetSocketId = socketIdByUsername.get((username || '').toLowerCase());
    const target = targetSocketId ? usersBySocketId.get(targetSocketId) : null;

    if (!targetSocketId || !target) {
      socket.emit('reconnect_result', { ok: false, message: 'User is not online.' });
      return;
    }

    if (target.partnerId || targetSocketId === socket.id) {
      socket.emit('reconnect_result', { ok: false, message: 'User is currently unavailable.' });
      return;
    }

    const desiredMode = mode === 'video' ? 'video' : 'text';
    detachPartner(socket.id, true);
    removeFromQueues(socket.id);
    removeFromQueues(targetSocketId);

    const paired = pairUsers(socket.id, targetSocketId, desiredMode);
    socket.emit('reconnect_result', {
      ok: paired,
      message: paired ? `Reconnected with ${target.username}.` : 'Reconnect failed.',
    });
  });

  socket.on('webrtc_offer', ({ sdp }) => {
    const partnerId = usersBySocketId.get(socket.id)?.partnerId;
    if (partnerId) {
      io.to(partnerId).emit('webrtc_offer', { sdp });
    }
  });

  socket.on('webrtc_answer', ({ sdp }) => {
    const partnerId = usersBySocketId.get(socket.id)?.partnerId;
    if (partnerId) {
      io.to(partnerId).emit('webrtc_answer', { sdp });
    }
  });

  socket.on('webrtc_ice_candidate', ({ candidate }) => {
    const partnerId = usersBySocketId.get(socket.id)?.partnerId;
    if (partnerId) {
      io.to(partnerId).emit('webrtc_ice_candidate', { candidate });
    }
  });

  socket.on('disconnect', () => {
    const user = usersBySocketId.get(socket.id);
    removeFromQueues(socket.id);
    detachPartner(socket.id, true);

    if (user?.username) {
      socketIdByUsername.delete(user.username.toLowerCase());
    }
    usersBySocketId.delete(socket.id);
  });
});

app.use(express.static(path.join(__dirname, '..', 'frontend')));

server.listen(PORT, () => {
  console.log(`SuckSexFull running at http://localhost:${PORT}`);
});