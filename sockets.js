// Simple socket emitter helper. The io instance is set during server start.
let io = null;
module.exports = {
  init: (serverIo) => { io = serverIo; },
  emit: (event, payload) => { if (io) io.emit(event, payload); }
};
