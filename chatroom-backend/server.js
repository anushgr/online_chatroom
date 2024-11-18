require('dotenv').config(); // Load environment variables from .env file
const express = require('express');
const mongoose = require('mongoose');
const { Server } = require('socket.io');
const http = require('http');
const cors = require('cors');
const multer = require('multer');
const path = require('path');

// Initialize the app
const app = express();

// Configure file upload storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, '/mnt/data/uploads'),  // Use Render's persistent disk path
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({ storage });

// Setup routes
app.post('/upload', upload.single('file'), (req, res) => {
    res.json({ fileUrl: `https://<your-render-app-name>.onrender.com/uploads/${req.file.filename}` });
});

app.use('/uploads', express.static(path.join(__dirname, '/mnt/data/uploads')));  // Serve uploaded files

// Setup server
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());

// Connect to MongoDB using the environment variable
const dbURI = process.env.MONGO_URI;

mongoose.connect(dbURI)
    .then(() => console.log('Connected to MongoDB Atlas'))
    .catch(err => console.log('Error connecting to MongoDB:', err));

// Message Schema
const MessageSchema = new mongoose.Schema({
    username: String,
    content: String,
    fileUrl: String,
    timestamp: { type: Date, default: Date.now },
});
const Message = mongoose.model('Message', MessageSchema);

// API route to fetch message history
app.get('/history', async (req, res) => {
    const messages = await Message.find().sort({ timestamp: 1 });
    res.json(messages);
});

// Socket.io connection for real-time chat
io.on('connection', (socket) => {
    console.log('A user connected');

    // Send message history when a new user connects
    Message.find().sort({ timestamp: 1 }).then((messages) => {
        socket.emit('message-history', messages); // Send message history to new user
    });

    socket.on('message', async (data) => {
        // Save message to DB
        const newMessage = new Message(data);
        await newMessage.save();

        // Broadcast the message to all users
        io.emit('message', data);
    });

    socket.on('disconnect', () => {
        console.log('A user disconnected');
    });
});

// Start server
server.listen(5000, () => console.log('Server running on port 5000'));
