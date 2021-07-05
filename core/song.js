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
  constructor(songInfo) {
    this.url = `ytsearch:${songInfo.title} - ${songInfo.artist}`;
    this.title = songInfo.title;
    this.artist = songInfo.artist;
    this.album = songInfo.album;
    this.coverUrls = songInfo.coverUrls;
    this.bitrate = 0;
  }

  getMetadata() {
    return {
      title: this.title,
      artist: this.artist,
      album: this.album,
      coverUrls: this.coverUrls
    }
  }

  /**
   * Tries to download the song from YouTube and populate the object with the song's metadata.
   * @param {Function} cb The callback function.
   */
  prepare(cb) {
    // Generate a random ID for the song file
    const randomId = generateRandomId();

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
