const path = require('path');
const express = require('express');
const socket = require('socket.io');
const cors = require('cors');

const Queue = require('./core/queue');


// Globals
const PORT = process.env.PORT || 4000;

// Main code
const app = express();
app
  .use(cors())
  .use(express.static(path.join(__dirname, '/lyt-client/build')));

const server = app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}.`);

  queue.init();

  queue.onSongUpdated = (song) => {
    io.emit('songChanged', {
      title: song.title,
      artist: song.artist,
      album: song.album,
      cover: song.cover
    });
  };

  queue.onSongPreparing = () => {
    io.emit('sinkStatus', {
      status: 2
    });
  };

  queue.onSongReady = () => {
    io.emit('sinkStatus', {
      status: 1
    });
  };

  queue.onQueueFinished = () => {
    io.emit('sinkStatus', {
      status: 0
    });
  };

  queue.update();
})

const io = socket(server, {
  cors: {
    origin: '*'
  }
});

const queue = new Queue();

// Socket events
io.on('connection', (sock) => {
  console.log(`[SOCK] User connected: ${sock.id}.`);

  let sinkId;

  sock.on('join', (data) => {
    console.log(`[SOCK] User joined: ${data.username}.`);

    // Create audio stream for user
    const { id, _ } = queue.makeSink();
    sinkId = id;

    sock.emit('welcome', {
      username: data.username,
      sinkId,
      version: '0.0.1'
    });

    if (queue.isPlaying) {
      const song = queue.getCurrentSong();

      sock.emit('songChanged', {
        title: song.title,
        artist: song.artist,
        album: song.album,
        cover: song.cover
      });

      sock.emit('sinkStatus', {
        status: 1
      });
    }
  });

  sock.on('queueSkip', () => {
    console.log(`[QUEUE] Skipping song...`);

    io.emit('songChanged', {
      title: 'Skipping song...',
      artist: ':)',
      album: '',
      cover: 'https://production.listennotes.com/podcasts/big-chungus-rayyan-gepJz1k8wU2-qIXGUbnm_OD.1400x1400.jpg'
    });

    queue.skipSong();
  });

  sock.on('disconnect', () => {
    console.log(`[SOCK] User disconnected.`);

    // Delete the user's audio stream
    queue.removeSink(sinkId);
  });
});

// Web routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '/lyt-client/build/index.html'));
});

app.get('/stream/:sinkId', (req, res) => {
  const sink = queue.getSink(req.params.sinkId);

  if (sink) {
    res.type('audio/mpeg');
    sink.pipe(res);
  }
});
