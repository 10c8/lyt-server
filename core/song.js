const fs = require("fs");
const path = require("path");
const youtubeDlWrap = require("youtube-dl-wrap");
const { ffprobe } = require("@dropb/ffprobe");
const MusicBrainzApi = require("musicbrainz-api").MusicBrainzApi;


const __root = require("app-root-path").toString();

const ytdl = new youtubeDlWrap(path.join(__root, "/bin/youtube-dl.exe"));

const mbapi = new MusicBrainzApi({
  appName: "test",
  appVersion: "0.1.0",
  appContactInfo: "test@test.org"
});

ffprobe.path = path.join(__root, "/bin/ffprobe.exe");

class Song {
  constructor(searchString) {
    this.searchString = searchString;
    this.cover = "";
    this.title = "";
    this.artist = "";
    this.album = "";
    this.bitrate = 0;
  }

  async prepare(callback) {
    // Get video metadata
    console.log(`[SONG] Fetching YouTube metadata...`);
    const meta = await ytdl.getVideoInfo(`ytsearch:${this.searchString}`);

    // Then fetch actual metadata from MusicBrainz
    console.log(`[SONG] Searching MusicBrainz...`);
    const query = await mbapi.searchRelease(meta.fulltitle);
    const release = query.releases[0];

    this.title = release.title;

    release["artist-credit"].forEach(credit => {
      if (this.artist != "")
        this.artist += ", ";

      this.artist += credit.artist.name;
    });

    this.album = release["release-group"].title;

    // Download song data
    const fullFilename = path.join(__root, `/temp/${meta.id}.mp3`);

    console.log(`[SONG] Downloading song...`);
    ytdl.exec([
      `ytsearch:${this.searchString}`,
      "-q",
      "-x",
      "--audio-quality", "0",
      "--audio-format", "mp3",
      "-f", "bestaudio/best",
      "-o", path.join(__root, `/temp/%(id)s.%(ext)s`)
    ])
    .on("error", (error) => {
      console.log(`[SONG] ${error}`);
    })
    .on("close", async () => {
      console.log("[SONG] Download finished.");

      // Get file metadata
      console.log("[SONG] Reading bitrate...");
      const fileMeta = await ffprobe(fullFilename);
      this.bitrate = fileMeta.format.bit_rate;

      console.log("[SONG] Done.");
      callback(fullFilename);
    });
  }
}

module.exports = Song;
