const path = require("path");
const express = require("express");
const socket = require("socket.io");
const cors = require("cors");

const Queue = require("./core/queue");


// Globals
const PORT = process.env.PORT || 4000;

// Main code
const app = express();
app
  .use(cors())
  .use(express.static(path.join(__dirname, "/lyt-client/build")));

const server = app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}.`);

  queue.init();
  queue.update((song) => {
    io.emit("songReady", {
      cover: "https://archive.org/download/mbid-20d17549-6ed0-479b-bf98-2c71b9869ff3/mbid-20d17549-6ed0-479b-bf98-2c71b9869ff3-22549937983_thumb250.jpg",
      title: song.title,
      artist: song.artist,
      album: song.album
    });
  });
});

const io = socket(server, {
  cors: {
    origin: "*"
  }
});

const queue = new Queue();

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

      sock.emit("songReady", {
        cover: "https://archive.org/download/mbid-20d17549-6ed0-479b-bf98-2c71b9869ff3/mbid-20d17549-6ed0-479b-bf98-2c71b9869ff3-22549937983_thumb250.jpg",
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

// Web routes
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "/lyt-client/build/index.html"));
});

app.get("/stream/:sinkId", (req, res) => {
  const sink = queue.getSink(req.params.sinkId);

  if (sink) {
    res.type("audio/mpeg");
    sink.pipe(res);
  }
});
