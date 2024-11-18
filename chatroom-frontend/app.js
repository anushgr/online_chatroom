import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';

// Replace 'https://online-chatroom.onrender.com' with your backend's live URL
const socket = io('https://online-chatroom.onrender.com');

const App = () => {
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState('');
  const [file, setFile] = useState(null);
  const [username, setUsername] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    // Fetch message history from the live backend
    fetch('https://online-chatroom.onrender.com/history')
      .then((res) => res.json())
      .then((data) => setMessages(data))
      .catch((err) => console.error('Error fetching history:', err));

    // Listen for new messages
    socket.on('message', (newMessage) => {
      setMessages((prev) => [...prev, newMessage]);
    });

    // Clean up the socket connection
    return () => {
      socket.disconnect();
    };
  }, []);

  const sendMessage = () => {
    if (!message && !file) return;

    const newMessage = {
      username,
      content: message,
      fileUrl: file ? URL.createObjectURL(file) : null,
    };

    // Emit the new message to the server
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
                  <a href={msg.fileUrl} target="_blank" rel="noopener noreferrer">
                    View File
                  </a>
                )}
              </div>
            ))}
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
