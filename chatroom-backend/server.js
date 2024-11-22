const express = require('express');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const dotenv = require('dotenv');
const fs = require('fs');

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

app.use(cors({
    origin: 'https://online-chatroom-hod6.vercel.app',
    credentials: true, // Allow cookies and credentials
})); // Enable CORS for the frontend to communicate with the backend
app.use(express.json()); // To parse JSON requests
app.use(express.static('uploads')); // Serve uploaded files

// Set up MongoDB connection
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('Connected to MongoDB'))
    .catch((err) => console.error('Failed to connect to MongoDB:', err));

// File upload setup using Multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname)); // Save files with timestamp to avoid name collisions
    },
});
const upload = multer({ storage: storage });

// MongoDB schema for messages
const messageSchema = new mongoose.Schema({
    username: String,
    content: String,
    fileUrl: String,
    timestamp: { type: Date, default: Date.now },
});

const Message = mongoose.model('Message', messageSchema);

// Serve message history (for new users)
app.get('/history', async (req, res) => {
    try {
        const messages = await Message.find().sort({ timestamp: 1 }).limit(100); // Get the last 100 messages
        res.json(messages);
    } catch (err) {
        res.status(500).json({ message: 'Error fetching history', error: err });
    }
});

// File upload endpoint
app.post('/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        // Save file info to MongoDB
        const newFile = new Message({
            username: req.body.username,  // You may use a username or session info here
            fileUrl: `/uploads/${req.file.filename}`,
        });
        await newFile.save();

        res.json({ fileUrl: `/uploads/${req.file.filename}` });
    } catch (error) {
        console.error('File upload error:', error);
        res.status(500).json({ message: 'Error uploading file', error });
    }
});

// Create HTTP server and integrate with Socket.io
const server = app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});

const io = socketIo(server);

// Socket.IO events
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Send message history to the newly connected user
    Message.find().sort({ timestamp: 1 }).limit(100)
        .then((messages) => {
            socket.emit('message-history', messages);  // Send history to the new user
        })
        .catch((error) => {
            console.error('Error fetching message history:', error);
        });

    // Handle incoming messages
    socket.on('message', async (data) => {
        try {
            if (!data.username || (!data.content && !data.fileUrl)) {
                return console.error('Invalid message data');
            }

            const newMessage = new Message(data);
            await newMessage.save();
            io.emit('message', newMessage); // Broadcast the new message to all users
        } catch (error) {
            console.error('Error saving message:', error);
        }
    });

    // Handle user disconnect
    socket.on('disconnect', () => {
        console.log('A user disconnected:', socket.id);
    });
});
