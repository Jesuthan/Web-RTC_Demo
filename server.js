const path = require('path');
const fs = require('fs');
const express = require('express');
const socketio = require('socket.io');
const https = require('https');

const formatMessage = require('./utils/messages');
const {
  userJoin,
  getCurrentUser,
  userLeave,
  getRoomUsers
} = require('./utils/users');

const app = express();

// HTTPS credentials
const privateKey = fs.readFileSync('key.pem');
const certificate = fs.readFileSync('cert.pem');
const credentials = { key: privateKey, cert: certificate };

// Create HTTPS server
const server = https.createServer(credentials, app);

// Initialize socket.io
const io = socketio(server);

// Serve static files (e.g., index.html, CSS, JS)
app.use(express.static(path.join(__dirname, 'public')));

const botName = 'SquashCord Bot';

// Handle socket connections
io.on('connection', socket => {
  socket.on('joinRoom', ({ username, room }) => {
    const user = userJoin(socket.id, username, room);
    socket.join(user.room);

    socket.emit('message', formatMessage(botName, 'Welcome to SquashCord!'));

    socket.broadcast.to(user.room).emit(
      'message',
      formatMessage(botName, `${user.username} has joined the chat`)
    );

    io.to(user.room).emit('roomUsers', {
      room: user.room,
      users: getRoomUsers(user.room)
    });
  });

  socket.on('full_room', msg => {
    socket.emit('room_full', msg);
  });

  socket.on('chatMessage', msg => {
    const user = getCurrentUser(socket.id);
    io.to(user.room).emit('message', formatMessage(user.username, msg));
  });

  socket.on('videomessage', msg => {
    const user = getCurrentUser(socket.id);
    socket.broadcast.to(user.room).emit('vmessage', msg);
  });

  socket.on('disconnect', () => {
    const user = userLeave(socket.id);
    if (user) {
      io.to(user.room).emit(
        'message',
        formatMessage(botName, `${user.username} has left the chat`)
      );

      io.to(user.room).emit('roomUsers', {
        room: user.room,
        users: getRoomUsers(user.room)
      });
    }
  });
});

// Start the server
const PORT = process.env.PORT || 8443;
server.listen(PORT, () => console.log(`✅ Server running on https://localhost:${PORT}`));
