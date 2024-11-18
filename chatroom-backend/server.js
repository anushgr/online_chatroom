const express = require('express');
const mongoose = require('mongoose');
const { Server } = require('socket.io');
const http = require('http');
const cors = require('cors');
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({ storage });

app.post('/upload', upload.single('file'), (req, res) => {
    res.json({ fileUrl: `http://localhost:5000/uploads/${req.file.filename}` });
});

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());

// MongoDB connection
mongoose.connect('mongodb://localhost:27017/chatroom', { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.log(err));

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
    
    socket.on('message', async (data) => {
        const newMessage = new Message(data);
        await newMessage.save();
        io.emit('message', data); // Broadcast the message
    });

    socket.on('disconnect', () => {
        console.log('A user disconnected');
    });
});

server.listen(5000, () => console.log('Server running on port 5000'));
