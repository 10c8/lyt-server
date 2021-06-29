const fs = require("fs");
const { PassThrough } = require("stream");
const throttle = require("throttle");

const Song = require("./song");


class Queue {
  constructor() {
    this._sinks = new Map();
    this._songs = [];
    this._currentSong = null;
    this.isPlaying = false;
  }

  init() {
    this._songs.push(new Song("rena laine pigstep"));
    this._songs.push(new Song("grimes flesh without blood"));
    this._songs.push(new Song("why won't they talk to me tame impala"));
    this._songs.push(new Song("phospholipid blood cultures"));

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

  update(callback) {
    console.log(`[QUEUE] Preparing song "${this._currentSong.searchString}"...`);

    this._currentSong.prepare((filename) => {
      this.isPlaying = true;

      const bitRate = this._currentSong.bitrate;
      const songReadable = fs.createReadStream(filename);

      console.log(`[QUEUE] Now playing: "${this._currentSong.title} - ${this._currentSong.artist}" at ${bitRate}b/s.`);

      const throttleTransformable = new throttle(bitRate / 8);

      throttleTransformable.on("data", (chunk) => {
        this._broadcast(chunk);
      });

      throttleTransformable.on("end", () => {
        // TODO: Delete temporary file
        console.log(`[QUEUE] Song is over.`);

        if (this._songs.length == 0) {
          this.isPlaying = false;
        } else {
          this._currentSong = this._songs.pop();
          this.update(callback);
        }
      });

      songReadable.pipe(throttleTransformable);

      callback(this._currentSong);
    });
  }
}

function generateRandomId() {
  return Math.random().toString(36).slice(2);
}

module.exports = Queue;
