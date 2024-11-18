// Load environment variables from .env file
require('dotenv').config();

// Import dependencies
const express = require('express');
const mongoose = require('mongoose');
const { Server } = require('socket.io');
const http = require('http');
const cors = require('cors');
const multer = require('multer');
const path = require('path');

// Initialize the app
const app = express();

// Middleware configuration
app.use(cors({
    origin: '*', // Allow specific frontend URL
    methods: ['GET', 'POST'],
    credentials: true, // Allow cookies if needed
}));
app.use(express.json());

// Configure file upload storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads'), // Local uploads folder
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({ storage });

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// File upload route
app.post('/upload', upload.single('file'), (req, res) => {
    const fileUrl = `${process.env.BACKEND_URL}/uploads/${req.file.filename}`;
    res.json({ fileUrl });
});

// MongoDB connection
const dbURI = "mongodb+srv://ccreator02:anushgr@5321@mycluster.jddlw.mongodb.net/chatdata/chats?retryWrites=true&w=majority&appName=mycluster";
mongoose.connect(dbURI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('Error connecting to MongoDB:', err));

// Message Schema and Model
const MessageSchema = new mongoose.Schema({
    username: { type: String, required: true },
    content: { type: String },
    fileUrl: { type: String },
    timestamp: { type: Date, default: Date.now },
});
const Message = mongoose.model('Message', MessageSchema);

// Fetch message history route
app.get('/history', async (req, res) => {
    try {
        const messages = await Message.find().sort({ timestamp: 1 });
        res.json(messages);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch message history' });
    }
});

// Create HTTP and WebSocket servers
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: process.env.FRONTEND_URL || '*',
        methods: ['GET', 'POST'],
    },
});

// Socket.IO events
io.on('connection', (socket) => {
    console.log('A user connected');

    // Send message history to the newly connected user
    Message.find().sort({ timestamp: 1 }).then((messages) => {
        socket.emit('message-history', messages);
    });

    // Handle incoming messages
    socket.on('message', async (data) => {
        try {
            const newMessage = new Message(data);
            await newMessage.save();
            io.emit('message', data); // Broadcast to all users
        } catch (error) {
            console.error('Error saving message:', error);
        }
    });

    // Handle user disconnect
    socket.on('disconnect', () => {
        console.log('A user disconnected');
    });
});

// Start the server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
