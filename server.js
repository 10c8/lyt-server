const path = require("path");
const hapi = require("@hapi/hapi");
const StaticFilePlugin = require("@hapi/inert");
const { Server } = require("socket.io");

const Routes = require("./core/routes");
const Queue = require("./core/queue");


// Main code
void async function main() {
  // Initialize the web-server
  const webServer = new hapi.Server({
    port: process.env.PORT || 4000,
    host: process.env.HOST || "192.168.192.10",
    compression: false,
    routes: {
      files: {
        relativeTo: path.join(__dirname, "/lyt-client/build")
      }
    }
  });

  await webServer.register(StaticFilePlugin);

  webServer.route({
    method: "GET",
    path: "/",
    handler: (_, h) => h.file("index.html")
  });

  webServer.route({
    method: "GET",
    path: "/{param*}",
    handler: {
      directory: {
        path: ".",
        redirectToSlash: true
      }
    }
  });

  webServer.route({
    method: "GET",
    path: "/stream/{sinkId}",
    handler: (request, h) => {
      const sink = queue.getSink(request.params.sinkId);

      if (sink) {
        return h.response(sink).type("audio/mpeg");
      }
    }
  });

  webServer.route({
    method: 'GET',
    path: '/sink',
    handler: (request, h) => {
      const { id, responseSink } = queue.makeSink();
      request.app.sinkId = id;
      return h.response(responseSink).type('audio/mpeg');
    },
    options: {
      ext: {
        onPreResponse: {
          method: (request, h) => {
            request.events.once('disconnect', () => {
              queue.removeSink(request.app.sinkId);
            });
            return h.continue;
          }
        }
      }
    }
  });

  await webServer.start();
  console.log(`Web-server listening on port 4000.`);

  // Initialize the Socket.io server
  const io = new Server({
    serveClient: false,
    cors: {
      origin: "*"
    }
  });
  io.listen(4001);

  console.log(`Socket server listening on port 4001.`);

  // Socket events
  io.on("connection", (sock) => {
    console.log(`[SOCK] User connected: ${sock.id}.`);

    let sinkId;

    sock.on("join", (data) => {
      console.log(`[SOCK] User joined: ${data.username}.`);

      // Create audio stream for user
      const { id, _ } = queue.makeSink();
      sinkId = id;

      sock.emit("welcome", {
        username: data.username,
        sinkId
      });

      if (queue.isPlaying) {
        const song = queue.getCurrentSong();

        io.emit("songReady", {
          title: song.title,
          artist: song.artist,
          album: song.album
        });
      }
    });

    sock.on("disconnect", () => {
      console.log(`[SOCK] User disconnected.`);

      // Delete the user's audio stream
      queue.removeSink(sinkId);
    });
  });

  // Start the song queue
  const queue = new Queue();
  queue.init();
  queue.update((song) => {
    io.emit("songReady", {
      title: song.title,
      artist: song.artist,
      album: song.album
    });
  });
}();
