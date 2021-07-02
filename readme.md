# TODO
 - [ ] Cache:
  - [ ] Audio
  - [ ] Album covers
  - [ ] MusicBrainz metadata


## Steps to add a song to a room's playlist:
 1. Search for it
 1. Choose one video/song from the list of results
 1. If our database doesn't have the song's metadata yet:
  1. The server searches the MusicBrainz database for the chosen video's title
  1. The user is shown a list of results and has to choose the most correct option
  1. Once this process has happened a total of 10 times, save the metadata in our database
 1. The information is sent to the server, along with authorization data
 1. The server adds the song to the room's queue
