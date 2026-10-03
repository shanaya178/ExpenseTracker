const http = require("http");
const fs = require("fs");
const path = require("path");

const port = Number(process.env.PORT) || 43123;
const root = __dirname;

const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".txt": "text/plain; charset=utf-8",
  ".rules": "text/plain; charset=utf-8",
};

const server = http.createServer(function (request, response) {
  const url = new URL(request.url, "http://" + request.headers.host);
  let pathname = decodeURIComponent(url.pathname);

  if (pathname.endsWith("/")) {
    pathname += "index.html";
  }

  const filePath = path.normalize(path.join(root, pathname));

  if (filePath !== root && !filePath.startsWith(root + path.sep)) {
    response.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Forbidden");
    return;
  }

  fs.readFile(filePath, function (error, data) {
    if (error) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }

    const type = types[path.extname(filePath)] || "application/octet-stream";
    response.writeHead(200, { "Content-Type": type });
    response.end(data);
  });
});

server.listen(port, "0.0.0.0", function () {
  console.log("Dashboard running at http://127.0.0.1:" + port);
});
