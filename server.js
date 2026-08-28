require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const { v2: cloudinary } = require('cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');

const app = express();
app.use(cors());
const server = http.createServer(app);

// --- 1. CLOUDINARY & MULTER SETUP ---
// This connects your server securely to your Cloudinary account
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'watch-party-videos',
        resource_type: 'video', // This is critical so Cloudinary knows it is a video, not an image
        allowed_formats: ['mp4', 'mov', 'avi', 'mkv', 'webm']
    }
});

const upload = multer({ storage: storage });

// The upload route now automatically sends the file to Cloudinary
app.post('/upload', upload.single('video'), (req, res) => {
    console.log('Admin uploaded a new video to Cloudinary!');
    res.json({
        message: 'Upload successful',
        downloadUrl: req.file.path // Cloudinary automatically generates the live URL here
    });
});

// --- 2. SOCKET.IO SETUP (REAL-TIME SYNC, CHAT, & WEBRTC) ---
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

io.on('connection', (socket) => {
    console.log(`A user connected! Their ID is: ${socket.id}`);

    socket.on('join-room', (roomId) => {
        socket.join(roomId);
    });

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

    socket.on('send-message', (roomId, messageData) => {
        io.to(roomId).emit('receive-message', messageData);
    });

    // WebRTC Signaling Events
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

    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
    });
});

// --- 3. START THE SERVER ---
app.get('/', (req, res) => {
    res.send('Watch Party Server is fully operational with Cloud Storage!');
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Server is up and listening on port ${PORT}`);
});