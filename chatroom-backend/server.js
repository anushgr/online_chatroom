require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const { Server } = require('socket.io');
const http = require('http');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Initialize the app
const app = express();

// MongoDB connection URI
console.log('MongoDB URI:', process.env.MONGODB_URI);

// Comprehensive CORS configuration
const corsOptions = {
    origin: '*', // Allow all origins for testing (can be restricted later)
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: false // Set to true if you handle cookies
};

// Apply CORS middleware
app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // Handle preflight requests for all routes

// Middleware configuration
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// MongoDB connection with enhanced error handling
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

// File upload storage configuration
const storage = multer.memoryStorage(); // Store files in memory temporarily
const upload = multer({ 
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

// Serve uploaded files statically from 'uploads' folder
const uploadDirectory = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDirectory)) {
    fs.mkdirSync(uploadDirectory);
}
app.use('/uploads', express.static(uploadDirectory));

// MongoDB Schema and Model for messages
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

    const fileName = `${Date.now()}-${req.file.originalname}`;
    const filePath = path.join(uploadDirectory, fileName);

    // Save file to disk
    fs.writeFileSync(filePath, req.file.buffer);

    // Store the file URL in MongoDB
    const fileUrl = `${process.env.BACKEND_URL}/uploads/${fileName}`;
    res.json({ fileUrl });
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
    pingTimeout: 60000, // Increased timeout
});

// Socket.IO events with enhanced error handling
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Send message history to the newly connected user
    Message.find().sort({ timestamp: 1 }).limit(100)
        .then((messages) => {
            socket.emit('message-history', messages);
        })
        .catch((error) => {
            console.error('Error fetching message history:', error);
        });

    // Handle incoming messages
    socket.on('message', async (data) => {
        try {
            // Validate message data
            if (!data.username || (!data.content && !data.fileUrl)) {
                return console.error('Invalid message data');
            }

            const newMessage = new Message(data);
            await newMessage.save();
            io.emit('message', newMessage); // Broadcast to all users
        } catch (error) {
            console.error('Error saving message:', error);
        }
    });

    // Handle user disconnect
    socket.on('disconnect', () => {
        console.log('A user disconnected:', socket.id);
    });
});

// Connect to DB and start server
const PORT = process.env.PORT || 5000;
const startServer = async () => {
    await connectDB();
    server.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
};

startServer();

// Error handling for unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Error handling for uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    process.exit(1);
});
