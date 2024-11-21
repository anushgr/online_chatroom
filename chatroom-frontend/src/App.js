import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import './App.css';

const socket = io('https://online-chatroom.onrender.com', {
  withCredentials: true,
  transports: ['websocket', 'polling'],
});

const App = () => {
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState('');
  const [file, setFile] = useState(null);
  const [username, setUsername] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    // Fetch message history from the backend when component mounts
    fetch('https://online-chatroom.onrender.com/history', {
      credentials: 'include',
    })
      .then((res) => res.json())
      .then((data) => setMessages(data))
      .catch((err) => console.error('Error fetching history:', err));

    // Listen for new messages from other users
    socket.on('message', (newMessage) => {
      setMessages((prev) => [...prev, newMessage]);
    });

    // Listen for the initial message history sent on connection
    socket.on('message-history', (history) => {
      setMessages(history);  // Display the full message history
    });

    // Clean up the socket connection on unmount
    return () => {
      socket.disconnect();
    };
  }, []);

  const sendMessage = async () => {
    if (!message && !file) return;

    let fileUrl = null;
    // If file exists, upload it first
    if (file) {
      const formData = new FormData();
      formData.append('file', file);

      try {
        const response = await fetch('https://online-chatroom.onrender.com/upload', {
          method: 'POST',
          body: formData,
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
                      href={msg.fileUrl}
                      download
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {msg.fileUrl.split('/').pop()}  {/* Display file name */}
                    </a>
                  </div>
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
