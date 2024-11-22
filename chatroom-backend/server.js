const express = require('express');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');
const fs = require('fs');

dotenv.config();
const app = express();
const server = http.createServer(app);
const port = process.env.PORT || 5000;

// Enhanced CORS configuration
app.use(cors({
    origin: [
        'https://online-chatroom-hod6.vercel.app', 
        'http://localhost:3000'  // For local development
    ],
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads'))); 

// MongoDB Connection with better error handling
mongoose.connect(process.env.MONGO_URI, { 
    useNewUrlParser: true, 
    useUnifiedTopology: true 
})
.then(() => console.log('✅ MongoDB Connected Successfully'))
.catch((err) => {
    console.error('❌ MongoDB Connection Error:', err);
    process.exit(1);
});

// Enhanced Multer storage configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, 'uploads');
        fs.mkdirSync(uploadDir, { recursive: true });
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: { 
        fileSize: 5 * 1024 * 1024 // 5MB file size limit
    }
});

// MongoDB Message Schema
const messageSchema = new mongoose.Schema({
    username: { 
        type: String, 
        required: true 
    },
    content: String,
    fileUrl: String,
    timestamp: { 
        type: Date, 
        default: Date.now 
    }
});

const Message = mongoose.model('Message', messageSchema);

// Fetch message history with pagination
app.get('/history', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 50;
        const skip = (page - 1) * limit;

        const messages = await Message.find()
            .sort({ timestamp: -1 })
            .skip(skip)
            .limit(limit);

        const total = await Message.countDocuments();

        res.json({
            messages: messages.reverse(),
            totalPages: Math.ceil(total / limit),
            currentPage: page
        });
    } catch (err) {
        res.status(500).json({ 
            message: 'Error fetching history', 
            error: err.message 
        });
    }
});

// File upload endpoint with validation
app.post('/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const newFile = new Message({
            username: req.body.username || 'Anonymous',
            fileUrl: `/uploads/${req.file.filename}`,
            content: `Uploaded file: ${req.file.originalname}`
        });

        await newFile.save();
        res.json({ 
            fileUrl: `/uploads/${req.file.filename}`,
            message: 'File uploaded successfully' 
        });
    } catch (error) {
        console.error('File upload error:', error);
        res.status(500).json({ 
            message: 'Error uploading file', 
            error: error.message 
        });
    }
});

// Socket.IO Configuration
const io = socketIo(server, {
    cors: {
        origin: [
            'https://online-chatroom-hod6.vercel.app', 
            'http://localhost:3000'
        ],
        methods: ['GET', 'POST']
    }
});

io.on('connection', (socket) => {
    console.log('🔗 User connected:', socket.id);

    socket.on('message', async (data) => {
        try {
            if (!data.username) {
                return console.error('Invalid username');
            }

            const newMessage = new Message({
                username: data.username,
                content: data.content,
                fileUrl: data.fileUrl
            });

            await newMessage.save();
            io.emit('message', newMessage);
        } catch (error) {
            console.error('Message save error:', error);
        }
    });

    socket.on('disconnect', () => {
        console.log('🔌 User disconnected:', socket.id);
    });
});

server.listen(port, () => {
    console.log(`🚀 Server running on port ${port}`);
});
