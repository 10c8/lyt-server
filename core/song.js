const fs = require('fs');
const path = require('path');
const youtubeDlWrap = require('youtube-dl-wrap');
const { ffprobe } = require('@dropb/ffprobe');
const MusicBrainzApi = require('musicbrainz-api').MusicBrainzApi;

const { generateRandomId } = require('./utils');


// Utility for figuring out the project's root directory
const __root = require('app-root-path').toString();

// Initialize the youtube-dl wrapper
const ytdl = new youtubeDlWrap(path.join(__root, '/bin/youtube-dl.exe'));

// Initialize the MusicBrainz API wrapper
const mbapi = new MusicBrainzApi({
  appName: 'test',
  appVersion: '0.1.0',
  appContactInfo: 'test@test.org'
});

// Fix the `ffprobe` path
ffprobe.path = path.join(__root, '/bin/ffprobe.exe');

// Main code
class Song {
  constructor(url) {
    this.url = url;
    this.mbid = '';
    this.title = '';
    this.artist = '';
    this.album = '';
    this.cover = '';
    this.bitrate = 0;

    if (!this.url.startsWith('http')) {
      this.url = 'ytsearch:' + this.url;
    }
  }

  /**
   * Tries to download the song from YouTube and populate the object with the song's metadata.
   * @param {Function} cb The callback function.
   */
  async prepare(cb) {
    // Generate a random ID for the song file
    const randomId = generateRandomId();

    // Get video metadata
    console.log('[SONG] Fetching YouTube metadata...');
    const meta = await ytdl.getVideoInfo(`ytsearch:${this.url}`);

    // Then fetch actual metadata from MusicBrainz
    console.log('[SONG] Searching MusicBrainz...');
    const query = await mbapi.searchRelease(meta.fulltitle);
    const release = query.releases[0];

    this.mbid = release.id;
    this.title = release.title;
    this.cover = `http://coverartarchive.org/release/${this.mbid}/front`;

    release['artist-credit'].forEach(credit => {
      if (this.artist != '')
        this.artist += ', ';

      this.artist += credit.artist.name;
    });

    this.album = release['release-group'].title;

    // Download song data
    const fullFilename = path.join(__root, `/temp/${randomId}.mp3`);

    console.log('[SONG] Downloading song...');
    ytdl.exec([
      `${this.url}`,
      '-q',
      '-x',
      '--audio-quality', '0',
      '--audio-format', 'mp3',
      '-f', 'bestaudio/best',
      '-o', path.join(__root, `/temp/${randomId}.%(ext)s`)
    ])
    .on('error', (error) => {
      console.log(`[SONG] ${error}`);
    })
    .on('close', async () => {
      console.log('[SONG] Download finished.');

      // Read the song's bitrate from the file metadata
      console.log('[SONG] Reading bitrate...');
      const fileMeta = await ffprobe(fullFilename);
      this.bitrate = fileMeta.format.bit_rate;

      console.log('[SONG] Done.');

      // Return to the callback
      cb(fullFilename);
    });
  }
}

module.exports = Song;
