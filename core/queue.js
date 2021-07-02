const fs = require('fs');
const { PassThrough } = require('stream');
const throttle = require('throttle');

const { generateRandomId } = require('./utils');
const Song = require('./song');


class Queue {
  constructor() {
    this._sinks = new Map();
    this._songs = [];
    this._currentSong = null;
    this._throttled = null;
    this.isPlaying = false;

    this.onSongUpdated = (song) => false;
    this.onSongPreparing = () => false;
    this.onSongReady = () => false;
    this.onQueueFinished = () => false;
  }

  init() {
    this._songs.push(new Song('grimes flesh without blood'));
    this._songs.push(new Song('dream steppin two people'));
    this._songs.push(new Song('unknown mortal multi-love'));
    this._songs.push(new Song('lorn perfekt dark'));
    this._songs.push(new Song('amor de que miku hatsune'));

    this._currentSong = this._songs.pop();
  }

  makeSink() {
    const id = generateRandomId();
    const responseSink = PassThrough();

    this._sinks.set(id, responseSink);

    return { id, responseSink };
  }

  getSink(id) {
    return this._sinks.get(id);
  }

  removeSink(id) {
    this._sinks.delete(id);
  }

  getCurrentSong() {
    return this._currentSong;
  }

  _broadcast(chunk) {
    for (const [, sink] of this._sinks) {
      sink.write(chunk);
    }
  }

  update() {
    console.log(`[QUEUE] Preparing song '${this._currentSong.url}'...`);

    this.onSongPreparing();

    this._currentSong.prepare((filename) => {
      this.isPlaying = true;

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

        if (this._songs.length == 0) {
          this.isPlaying = false;
          this.onQueueFinished();
        } else {
          this._currentSong = this._songs.pop();
          this.update();
        }
      });

      this._readable.pipe(this._throttled);

      this.onSongUpdated(this._currentSong);
      this.onSongReady();
    });
  }

  skipSong() {
    if (this._readable) {
      this._readable.close();
    }

    if (this._throttled) {
      this._throttled.removeAllListeners('data');
      this._throttled.removeAllListeners('end');
    }

    if (this._songs.length > 0) {
      this._currentSong = this._songs.pop();
      this.update();
    }
  }
}

module.exports = Queue;
