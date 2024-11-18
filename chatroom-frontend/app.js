import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';

const socket = io('http://localhost:5000');

const App = () => {
    const [messages, setMessages] = useState([]);
    const [message, setMessage] = useState('');
    const [file, setFile] = useState(null);

    useEffect(() => {
        // Fetch message history
        fetch('http://localhost:5000/history')
            .then(res => res.json())
            .then(data => setMessages(data));

        // Listen for new messages
        socket.on('message', (newMessage) => {
            setMessages((prev) => [...prev, newMessage]);
        });
    }, []);

    const sendMessage = () => {
        if (!message && !file) return;

        const newMessage = {
            username: 'Anonymous', // Add user support later
            content: message,
            fileUrl: file ? URL.createObjectURL(file) : null,
        };

        socket.emit('message', newMessage);
        setMessage('');
        setFile(null);
    };

    return (
        <div>
            <h1>Chatroom</h1>
            <div>
                {messages.map((msg, index) => (
                    <div key={index}>
                        <p><strong>{msg.username}</strong>: {msg.content}</p>
                        {msg.fileUrl && <a href={msg.fileUrl} target="_blank" rel="noopener noreferrer">View File</a>}
                    </div>
                ))}
            </div>
            <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type a message..."
            />
            <input
                type="file"
                onChange={(e) => setFile(e.target.files[0])}
            />
            <button onClick={sendMessage}>Send</button>
        </div>
    );
};

export default App;
