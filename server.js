const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);

// maxHttpBufferSize increased to 50MB to handle large binary video chunks
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
  maxHttpBufferSize: 5e7 
});

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join-room', (roomId) => {
    socket.join(roomId);
    socket.to(roomId).emit('user-connected', socket.id);
    socket.on('disconnect', () => socket.to(roomId).emit('user-disconnected', socket.id));
  });

  // --- WEBRTC MESH (CAMERAS ONLY) ---
  socket.on('webrtc-offer', ({ target, caller, offer }) => io.to(target).emit('webrtc-offer', { caller, offer }));
  socket.on('webrtc-answer', ({ target, caller, answer }) => io.to(target).emit('webrtc-answer', { caller, answer }));
  socket.on('webrtc-ice-candidate', ({ target, caller, candidate }) => io.to(target).emit('webrtc-ice-candidate', { caller, candidate }));

  // --- PLAYBACK SYNC ---
  socket.on('play-video', (roomId, time) => socket.to(roomId).emit('sync-play', time));
  socket.on('pause-video', (roomId) => socket.to(roomId).emit('sync-pause'));
  socket.on('seek-video', (roomId, time) => socket.to(roomId).emit('sync-seek', time));
  socket.on('send-message', (roomId, message) => io.to(roomId).emit('receive-message', message));

  // --- THE RELAY: BINARY VIDEO CHUNKS ---
  socket.on('video-chunk', (roomId, chunk) => {
    socket.to(roomId).emit('video-chunk', chunk);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Relay Server running on port ${PORT}`));