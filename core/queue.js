const fs = require('fs');
const { PassThrough } = require('stream');
const throttle = require('throttle');

const { generateRandomId } = require('./utils');
const Song = require('./song');


const QueueStatus = {
  IDLE: 0,
  PLAYING: 1,
  PAUSED: 2
};

class Queue {
  constructor(rid, callbacks) {
    this.status = QueueStatus.IDLE;
    this.rid = rid;
    this._sinks = new Map();
    this._songs = [];
    this._currentSongIndex = 0;
    this._currentSong = null;
    this._throttled = null;

    this.onQueueStarted = callbacks.onQueueStarted;
    this.onQueuePaused = callbacks.onQueuePaused;
    this.onQueueUnpaused = callbacks.onQueueUnpaused;
    this.onQueueSkipped = callbacks.onQueueSkipped;
    this.onQueueUpdated = callbacks.onQueueUpdated;
    this.onQueueFinished = callbacks.onQueueFinished;
    this.onSongUpdated = callbacks.onSongUpdated;
    this.onSongPreparing = callbacks.onSongPreparing;
    this.onSongReady = callbacks.onSongReady;
  }

  play() {
    switch (this.status) {
      case QueueStatus.IDLE:
        this.status = QueueStatus.PLAYING;
        this.update();
        this.onQueueStarted(this.rid);
        break;

      case QueueStatus.PLAYING:
        this.pause();
        break;

      case QueueStatus.PAUSED:
        this.unpause();
        break;

      default:
        return;
    }
  }

  isPlaying() {
    return this.status === QueueStatus.PLAYING;
  }

  update() {
    this.onSongPreparing(this.rid);

    this._currentSong = this._songs[this._currentSongIndex];
    console.log(`[QUEUE] Preparing song '${this._currentSong.url}'...`);

    this._currentSong.prepare((filename) => {
      const bitRate = this._currentSong.bitrate;
      this._readable = fs.createReadStream(filename);

      console.log(`[QUEUE] Now playing: '${this._currentSong.artist} - ${this._currentSong.title}'.`);

      // Prepare old sinks for new data
      for (const [id, _] of this._sinks) {
        this._sinks.set(id, PassThrough());
      }

      // Initialize a Throttle transformable stream
      this._throttled = new throttle(bitRate / 8);

      this._throttled.on('data', (chunk) => {
        this._broadcast(chunk);
      });

      this._throttled.on('end', () => {
        // TODO: Delete temporary files.
        console.log('[QUEUE] Song is over.');

        if (this._currentSongIndex == this._songs.length - 1) {
          this.stop();
        } else {
          this._currentSongIndex++;
          this.update();
        }
      });

      this._readable.pipe(this._throttled);

      this.onSongUpdated(this.rid, this._currentSong);
      this.onSongReady(this.rid);
    });
  }

  pause() {
    this.status = QueueStatus.PAUSED;

    if (this._readable) {
      if (!this._readable.isPaused()) {
        this._readable.pause();
      }
    }

    this.onQueuePaused(this.rid);
  }

  unpause() {
    this.status = QueueStatus.PLAYING;

    if (this._readable.isPaused()) {
      this._readable.resume();
    }

    this.onQueueUnpaused(this.rid);
  }

  kill() {
    if (this._readable) {
      this._readable.close();
    }

    if (this._throttled) {
      this._throttled.removeAllListeners('data');
      this._throttled.removeAllListeners('end');
    }
  }

  stop() {
    this.status = QueueStatus.IDLE;
    this._currentSongIndex = 0;

    this.kill();
    this.onQueueFinished(this.rid);
  }

  addSong(songInfo) {
    this._songs.push(new Song(songInfo));
    this.onQueueUpdated(this.rid);

    // DEBUG
    if (!this.isPlaying()) {
      this.play();
    }
  }

  getCurrentSong() {
    return this._currentSong;
  }

  removeSong(index) {
    this._songs.splice(index, 1);
    this.onQueueUpdated(this.rid);
  }

  skipSong() {
    this.kill();

    if (this._currentSongIndex < this._songs.length - 1) {
      this._currentSongIndex++;
      this.update();
    }

    this.onQueueSkipped(this.rid);
  }

  makeSink(uid) {
    const responseSink = PassThrough();
    this._sinks.set(uid, responseSink);

    return uid;
  }

  getSink(uid) {
    return this._sinks.get(uid);
  }

  removeSink(uid) {
    this._sinks.delete(uid);
  }

  getCurrentSong() {
    return this._currentSong;
  }

  getSongs() {
    return this._songs;
  }

  _broadcast(chunk) {
    for (const [, sink] of this._sinks) {
      sink.write(chunk);
    }
  }
}

module.exports = Queue;
