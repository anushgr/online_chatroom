require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const { Server } = require('socket.io');
const http = require('http');
const cors = require('cors');
const multer = require('multer');
const { GridFsStorage } = require('multer-gridfs-storage');
const { GridFSBucket } = require('mongodb');
const path = require('path');

// Initialize the app
const app = express();

console.log('MongoDB URI:', process.env.MONGODB_URI);
console.log('Backend URL:', process.env.BACKEND_URL);

// CORS configuration
const corsOptions = {
    origin: [
        'https://online-chatroom-hod6.vercel.app',
        'http://localhost:3000', // Local development
    ],
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
};

// Apply CORS middleware
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Middleware configuration
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// MongoDB connection and GridFS setup
let gfs;
const connectDB = async () => {
    try {
        const connection = await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB successfully');

        const db = connection.connection.db;
        gfs = new GridFSBucket(db, { bucketName: 'uploads' });
    } catch (error) {
        console.error('MongoDB connection error:', error);
        process.exit(1);
    }
};

// GridFS storage for multer
const storage = new GridFsStorage({
    url: process.env.MONGODB_URI,
    file: (req, file) => ({
        filename: `${Date.now()}-${file.originalname}`,
        bucketName: 'uploads',
    }),
});

const upload = multer({ storage });

// Message Schema and Model
const MessageSchema = new mongoose.Schema({
    username: { type: String, required: true },
    content: { type: String },
    fileUrl: { type: String },
    timestamp: { type: Date, default: Date.now },
});
const Message = mongoose.model('Message', MessageSchema);

// File upload route
app.post('/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileUrl = `${process.env.BACKEND_URL}/file/${req.file.id}`;
    res.json({ fileUrl });
});

// Serve files from MongoDB
app.get('/file/:id', async (req, res) => {
    try {
        const fileId = new mongoose.Types.ObjectId(req.params.id);

        gfs.openDownloadStream(fileId).pipe(res).on('error', (err) => {
            console.error('Error streaming file:', err);
            res.status(500).json({ error: 'Failed to retrieve file' });
        });
    } catch (error) {
        console.error('Error retrieving file:', error);
        res.status(500).json({ error: 'Invalid file ID' });
    }
});

// Fetch message history route
app.get('/history', async (req, res) => {
    try {
        const messages = await Message.find().sort({ timestamp: 1 }).limit(100);
        res.json(messages);
    } catch (error) {
        console.error('Failed to fetch message history:', error);
        res.status(500).json({ error: 'Failed to fetch message history' });
    }
});

// Create HTTP and WebSocket servers
const server = http.createServer(app);
const io = new Server(server, {
    cors: corsOptions,
    pingTimeout: 60000,
});

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    Message.find().sort({ timestamp: 1 }).limit(100)
        .then((messages) => {
            socket.emit('message-history', messages);
        })
        .catch((error) => console.error('Error fetching message history:', error));

    socket.on('message', async (data) => {
        try {
            if (!data.username || (!data.content && !data.fileUrl)) {
                return console.error('Invalid message data');
            }

            const newMessage = new Message(data);
            await newMessage.save();
            io.emit('message', newMessage);
        } catch (error) {
            console.error('Error saving message:', error);
        }
    });

    socket.on('disconnect', () => {
        console.log('A user disconnected:', socket.id);
    });
});

// Connect to MongoDB and start server
const PORT = process.env.PORT || 5000;
const startServer = async () => {
    await connectDB();
    server.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
};

startServer();
