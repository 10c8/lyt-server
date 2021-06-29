const path = require("path");


const Routes = {
  name: 'streamServer',
  register: async (server) => {
    server.route({
      method: "GET",
      path: "/",
      handler: (_, h) => h.file("index.html")
    });

    server.route({
      method: "GET",
      path: "/{param*}",
      handler: {
        directory: {
          path: ".",
          redirectToSlash: true
        }
      }
    });

    server.route({
      method: "GET",
      path: "/stream/{sinkId}",
      handler: (request, h) => {
        const sink = queue.getSink(request.params.sinkId);

        if (sink) {
          return h.response(sink).type("audio/mpeg");
        }
      }
    })
  }
};

module.exports = Routes;
