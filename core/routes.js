const RoomManager = require("../managers/RoomManager");

function setupRoutes(app) {
  // app.all('*', (req, res, next) => {
  //   res.cookie('XSRF-TOKEN', req.csrfToken());
  //   next();
  // });

  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '/lyt-client/build/index.html'));
  });

  app.get('/stream/:rid/:uid', (req, res) => {
    const { uid, rid } = req.params;

    const room = RoomManager.getRoom(rid);
    const sink = room.getQueue().getSink(uid);

    if (sink) {
      res.type('audio/mpeg');
      sink.pipe(res);
    }
  });
}

module.exports = { setupRoutes };
