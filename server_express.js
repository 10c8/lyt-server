const path = require('path');
const express = require('express');
const socket = require('socket.io');
const cors = require('cors');
// const admin = require('firebase-admin');

const { setupRoutes } = require('./core/routes');
const RoomManager = require('./managers/RoomManager');


// Globals
const PORT = process.env.PORT || 4000;

// Main code
const app = express();
app
  .use(cors())
  .use(express.static(path.join(__dirname, '/lyt-client/build')));

// Setup web routes
setupRoutes(app);

// Setup Socket.io server
const server = app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}.`);
});

const io = socket(server, {
  cors: {
    origin: '*'
  }
});

// Configure the RoomManager
RoomManager.setCallbacks({
  onQueueStarted: (rid) => {
    console.log(`onQueueStarted ${rid}`);
    io.to(rid).emit('room:events:queue-started');
  },

  onQueuePaused: (rid) => {
    console.log(`onQueuePaused ${rid}`);
    io.to(rid).emit('room:events:queue-paused');
  },

  onQueueUnpaused: (rid) => {
    console.log(`onQueueUnpaused ${rid}`);
    io.to(rid).emit('room:events:queue-unpaused');
  },

  onQueueSkipped: (rid) => {
    console.log(`onQueueSkipped ${rid}`);
    io.to(rid).emit('room:events:queue-skipped');
  },

  onQueueUpdated: (rid) => {
    console.log(`onQueueUpdated ${rid}`);
    const room = RoomManager.getRoom(rid);
    const queue = room.getQueue().getSongs().map((song) => song.getMetadata());

    io.to(rid).emit('room:events:queue-updated', {
      queue
    });
  },

  onQueueFinished: (rid) => {
    console.log(`onQueueFinished ${rid}`);
    io.to(rid).emit('room:events:queue-finished');
  },

  onSongUpdated: (rid, song) => {
    console.log(`onSongUpdated ${rid}`, song);
    io.to(rid).emit('room:events:song-updated', {
      title: song.title,
      artist: song.artist,
      album: song.album,
      coverUrls: song.coverUrls,
      dj: 'ellu'
    });
  },

  onSongPreparing: (rid) => {
    console.log(`onSongPreparing ${rid}`);
    io.to(rid).emit('room:events:song-preparing');
  },

  onSongReady: (rid) => {
    console.log(`onSongReady ${rid}`);
    io.to(rid).emit('room:events:song-ready');
  },

  onRoomDestroyed: (rid) => {
    console.log(`onRoomDestroyed ${rid}`);
    io.to(rid).emit('room:events:room-destroyed');
  }
});

// Socket events
io.on('connection', (sock) => {
  console.log(`[SOCK] User connected: ${sock.id}.`);

  // Room actions
  sock.on('room:actions:create', (data) => {
    // TODO: Error handling
    const { uid, roomName } = data;
    console.log(`create`, data);

    const rid = RoomManager.makeRoom(uid, sock.id, roomName);
    console.log(`  rid`, rid);

    if (rid) {
      sock.join(rid);

      const room = RoomManager.getRoom(rid);
      const queue = room.getQueue().getSongs().map((song) => song.getMetadata());
      const sinkId = room.getQueue().makeSink(uid);

      sock.emit('user:events:joined-room', {
        rid,
        sinkId,
        level: 2,
        queue
      });
    }
  });

  sock.on('room:actions:join', (data) => {
    const { uid, roomName } = data;
    console.log(`join`, data);

    const search = RoomManager.searchByName(roomName);
    if (search) {
      console.log(`  rid`, search.rid);
      const room = RoomManager.joinRoom(search.rid, sock.id);
      if (room) {
        const songList = room.getQueue().getSongs().map((song) => song.getMetadata());
        const sinkId = room.getQueue().makeSink(uid);
        const level = room.isDJ(uid) ? 1 : 0;

        sock.join(search.rid);

        sock.emit('user:events:joined-room', {
          rid: search.rid,
          sinkId,
          level,
          queue: songList
        });

        io.to(search.rid).emit('room:events:user-joined', {
          uid
        });

        // If the queue is already playing something, let them know
        if (room.getQueue().isPlaying()) {
          const song = room.getQueue().getCurrentSong();
          if (song) {
            sock.emit('room:events:song-updated', {
              title: song.title,
              artist: song.artist,
              album: song.album,
              coverUrls: song.coverUrls,
              dj: 'ellu'
            });

            sock.emit('room:events:song-ready');
          }
        }
      }
    }
  });

  sock.on('room:actions:leave', (data) => {
    const { uid, rid } = data;

    RoomManager.leaveRoom(rid, uid);

    sock.emit('user:events:left-room');
  });

  sock.on('room:actions:queue-add', (data) => {
    const { uid, rid, songInfo } = data;

    console.log(`room:actions:queue-add ${uid} ${rid}`, songInfo);

    const room = RoomManager.getRoom(rid);
    if (room && room.isDJ(uid)) {
      room.getQueue().addSong(songInfo);
    }
  });

  sock.on('room:actions:queue-skip', (data) => {
    const { uid, rid } = data;

    const room = RoomManager.getRoom(rid);
    if (room && room.isDJ(uid)) {
      room.getQueue().skipSong();
    }
  });

  // Socket events
  sock.on('disconnect', () => {
    RoomManager.disconnectSocket(sock.id);
  });

  // let sinkId;

  // sock.on('join', (data) => {
  //   console.log(`[SOCK] User joined: ${data.username}.`);

  //   // Create audio stream for user
  //   const { id, _ } = queue.makeSink();
  //   sinkId = id;

  //   sock.emit('welcome', {
  //     username: data.username,
  //     sinkId,
  //     version: '0.0.1'
  //   });

  //   if (queue.isPlaying) {
  //     const song = queue.getCurrentSong();

  //     sock.emit('songChanged', {
  //       title: song.title,
  //       artist: song.artist,
  //       album: song.album,
  //       cover: song.cover,
  //       dj: ' • ellu'
  //     });

  //     sock.emit('sinkStatus', {
  //       status: 1
  //     });
  //   }
  // });

  // sock.on('queueSkip', () => {
  //   console.log(`[QUEUE] Skipping song...`);

  //   io.emit('songChanged', {
  //     title: 'Skipping song...',
  //     artist: ':)',
  //     album: '',
  //     cover: 'https://production.listennotes.com/podcasts/big-chungus-rayyan-gepJz1k8wU2-qIXGUbnm_OD.1400x1400.jpg',
  //     dj: ''
  //   });

  //   queue.skipSong();
  // });

  // sock.on('disconnect', () => {
  //   console.log(`[SOCK] User disconnected.`);

  //   // Delete the user's audio stream
  //   queue.removeSink(sinkId);
  // });
});
