import React, { useState, useEffect, useCallback } from 'react';
import io from 'socket.io-client';

const BACKEND_URL = 'https://online-chatroom.onrender.com';
const socket = io(BACKEND_URL, {
    withCredentials: true,
    transports: ['websocket', 'polling']
});

const App = () => {
    const [messages, setMessages] = useState([]);
    const [message, setMessage] = useState('');
    const [file, setFile] = useState(null);
    const [username, setUsername] = useState('');
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    const fetchMessageHistory = useCallback(async (currentPage = 1) => {
        try {
            const response = await fetch(`${BACKEND_URL}/history?page=${currentPage}`, {
                credentials: 'include'
            });
            const data = await response.json();
            setMessages(data.messages);
            setTotalPages(data.totalPages);
            setPage(currentPage);
        } catch (err) {
            console.error('Error fetching history:', err);
        }
    }, []);

    useEffect(() => {
        fetchMessageHistory();

        socket.on('message', (newMessage) => {
            setMessages((prev) => [...prev, newMessage]);
        });

        return () => {
            socket.disconnect();
        };
    }, [fetchMessageHistory]);

    const sendMessage = async () => {
        if (!message && !file) return;

        let fileUrl = null;
        if (file) {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('username', username);

            try {
                const response = await fetch(`${BACKEND_URL}/upload`, {
                    method: 'POST',
                    body: formData
                });
                const data = await response.json();
                fileUrl = data.fileUrl;
            } catch (error) {
                console.error('File upload error:', error);
                return;
            }
        }

        const newMessage = {
            username,
            content: message,
            fileUrl: fileUrl,
        };

        socket.emit('message', newMessage);
        setMessage('');
        setFile(null);
    };

    const handleLogin = () => {
        if (username.trim()) {
            setIsLoggedIn(true);
        } else {
            alert('Please enter a valid name');
        }
    };

    const handleLoadMore = () => {
        if (page < totalPages) {
            fetchMessageHistory(page + 1);
        }
    };

    return (
        <div>
            {!isLoggedIn ? (
                <div>
                    <h1>Welcome to the Chatroom</h1>
                    <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="Enter your name"
                    />
                    <button onClick={handleLogin}>Join Chat</button>
                </div>
            ) : (
                <div>
                    <h1>Chatroom</h1>
                    <div>
                        {messages.map((msg, index) => (
                            <div key={index}>
                                <p>
                                    <strong>{msg.username}</strong>: {msg.content}
                                </p>
                                {msg.fileUrl && (
                                    <div>
                                        <a
                                            href={`${BACKEND_URL}${msg.fileUrl}`}
                                            download
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            {msg.fileUrl.split('/').pop()}
                                        </a>
                                    </div>
                                )}
                            </div>
                        ))}
                        {page < totalPages && (
                            <button onClick={handleLoadMore}>Load More</button>
                        )}
                    </div>
                    <input
                        type="text"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="Type a message..."
                    />
                    <input type="file" onChange={(e) => setFile(e.target.files[0])} />
                    <button onClick={sendMessage}>Send</button>
                </div>
            )}
        </div>
    );
};

export default App;
