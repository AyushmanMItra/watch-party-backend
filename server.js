const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join-room', (roomId) => {
    socket.join(roomId);
    
    // Notify all other users in the room that a new user joined
    socket.to(roomId).emit('user-connected', socket.id);

    socket.on('disconnect', () => {
      // Notify other users to clean up WebRTC connections
      socket.to(roomId).emit('user-disconnected', socket.id);
    });
  });

  // --- WEBRTC MESH SIGNALING ROUTING ---
  socket.on('webrtc-offer', ({ target, caller, offer }) => {
    io.to(target).emit('webrtc-offer', { caller, offer });
  });

  socket.on('webrtc-answer', ({ target, caller, answer }) => {
    io.to(target).emit('webrtc-answer', { caller, answer });
  });

  socket.on('webrtc-ice-candidate', ({ target, caller, candidate }) => {
    io.to(target).emit('webrtc-ice-candidate', { caller, candidate });
  });

  // --- WEBTORRENT MAGNET & PLAYBACK CONTROL SYNC ---
  socket.on('sync-magnet', (roomId, magnetURI) => {
    socket.to(roomId).emit('sync-magnet', magnetURI);
  });
  
  socket.on('play-video', (roomId, time) => socket.to(roomId).emit('sync-play', time));
  socket.on('pause-video', (roomId) => socket.to(roomId).emit('sync-pause'));
  socket.on('seek-video', (roomId, time) => socket.to(roomId).emit('sync-seek', time));
  socket.on('send-message', (roomId, message) => io.to(roomId).emit('receive-message', message));
  // --- VIDEO CHUNK RELAY ---
  // The Admin sends binary fMP4 chunks here, and the server blasts them to the room
  socket.on('video-chunk', (roomId, chunk) => {
    socket.to(roomId).emit('video-chunk', chunk);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Mesh Signaling Server running on port ${PORT}`));