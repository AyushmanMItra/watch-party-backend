const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const path = require('path');

const app = express();
app.use(cors());
const server = http.createServer(app);

// --- 1. FILE UPLOAD SETUP (MULTER) ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, './uploads');
    },
    filename: (req, file, cb) => {
        cb(null, 'party-video' + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

app.post('/upload', upload.single('video'), (req, res) => {
    console.log('Admin uploaded a new video!');
    res.json({
        message: 'Upload successful',
        downloadUrl: `http://localhost:3001/uploads/party-video${path.extname(req.file.originalname)}`
    });
});

app.use('/uploads', express.static('uploads'));

// --- 2. SOCKET.IO SETUP (REAL-TIME SYNC, CHAT, & WEBRTC) ---
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

io.on('connection', (socket) => {
    console.log(`A user connected! Their ID is: ${socket.id}`);

    // Join Room
    socket.on('join-room', (roomId) => {
        socket.join(roomId);
        console.log(`User ${socket.id} joined room: ${roomId}`);
    });

    // Video Sync Events
    socket.on('video-uploaded', (roomId, videoUrl) => {
        socket.to(roomId).emit('sync-video-url', videoUrl);
    });

    socket.on('play-video', (roomId, currentTime) => {
        socket.to(roomId).emit('sync-play', currentTime);
    });

    socket.on('pause-video', (roomId) => {
        socket.to(roomId).emit('sync-pause');
    });

    socket.on('seek-video', (roomId, currentTime) => {
        socket.to(roomId).emit('sync-seek', currentTime);
    });

    // Chat Event (Using io.to so the sender also sees it)
    socket.on('send-message', (roomId, messageData) => {
        io.to(roomId).emit('receive-message', messageData);
    });

    // WebRTC Signaling Events (For Peer-to-Peer Video/Voice)
    socket.on('user-ready-for-video', (roomId) => {
        socket.to(roomId).emit('user-ready-for-video');
    });
    
    socket.on('webrtc-offer', (roomId, offer) => {
        socket.to(roomId).emit('webrtc-offer', offer);
    });
    
    socket.on('webrtc-answer', (roomId, answer) => {
        socket.to(roomId).emit('webrtc-answer', answer);
    });
    
    socket.on('webrtc-ice-candidate', (roomId, candidate) => {
        socket.to(roomId).emit('webrtc-ice-candidate', candidate);
    });

    // Disconnect Event
    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
    });
});

// --- 3. START THE SERVER ---
app.get('/', (req, res) => {
    res.send('Watch Party Server is fully operational!');
});

const PORT = 3001;
server.listen(PORT, () => {
    console.log(`Server is up and listening on http://localhost:${PORT}`);
});