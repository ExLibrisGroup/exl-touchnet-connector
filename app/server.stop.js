const io = require('socket.io-client');
const PORT = process.env.PORT || 3002;
const socketClient = io.connect(`http://localhost:${PORT}`); 

socketClient.on('connect', () => {
  socketClient.emit('npmStop');
  setTimeout(() => {
    process.exit(0);
  }, 1000);
});