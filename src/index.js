const path = require('path');
const http = require('http');
const express = require('express');
const socketio = require('socket.io');
const Filter = require('bad-words');

const {
  generateMessage,
  generateLocationMessage,
} = require('./utils/messages');
const {
  addUser,
  removeUser,
  getUser,
  getUsersInRoom,
} = require('./utils/users');

const app = express();
const server = http.createServer(app);
const io = socketio(server);

const port = process.env.PORT || 3000;
const publicDirectoryPath = path.join(__dirname, '../public');

// Using express static middleware to serve up whatever is in the public directory
app.use(express.static(publicDirectoryPath));

let count = 0;

io.on('connection', (socket) => {
  console.log('New Websocket connection');

  // socket.emit('countUpdated', count);
  // socket.on('increment', () => {
  //   count++;
  //   // .emit emmits the event to a particluar/single connection
  //   // socket.emit('countUpdated', count);
  //   io.emit('countUpdated', count);
  // });

  socket.on('join', (options, callback) => {
    const { error, user } = addUser({ id: socket.id, ...options });

    if (error) {
      return callback(error);
    }

    socket.join(user.room);

    socket.emit('message', generateMessage('Admin', 'Welcome!'));

    // when we broadcast an event we send it to everybody except the current client
    socket.broadcast
      .to(user.room)
      .emit(
        'message',
        generateMessage('Admin', `${user.username} has joined!`)
      );
    io.to(user.room).emit('roomData', {
      room: user.room,
      users: getUsersInRoom(user.room),
    });

    callback();
  });

  socket.on('sendMessage', (message, callback) => {
    const user = getUser(socket.id);
    const filter = new Filter();

    if (filter.isProfane(message)) {
      return callback('Profanity is not allowed!');
    }

    // socket.emit('message', message)
    io.to(user.room).emit('message', generateMessage(user.username, message));
    // using the callback function to acknoledge the event
    // now when the server sent the acknowledgement back to the client we can also choose to provide some data like args
    callback(''); // for now we are simply sending a messgae back to the client
  });

  socket.on('sendLocation', ({ latitude, longitude }, callback) => {
    const user = getUser(socket.id);
    // io.emit('message', `Location: ${latitude}, ${longitude}`);
    io.to(user.room).emit(
      'locationMessage',
      generateLocationMessage(
        user.username,
        `http://google.com/maps?q=${latitude},${longitude}`
      )
    );
    callback();
  });

  socket.on('locationMessage', () => {});

  socket.on('disconnect', () => {
    const user = removeUser(socket.id);

    if (user) {
      io.to(user.room).emit(
        'message',
        generateMessage('Admin', `${user.username} has left!`)
      );
      io.to(user.room).emit('roomData', {
        room: user.room,
        users: getUsersInRoom(user.room),
      });
    }
  });
});

server.listen(port, () => {
  console.log(`Server is up on port ${port}!`);
});
