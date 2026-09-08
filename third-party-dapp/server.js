const server = Bun.serve({
  port: 4000,

  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === "/") {
      const file = Bun.file("index.html");

      return new Response(file, {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
        },
      });
    }

    return new Response("Not Found", {
      status: 404,
    });
  },
});

console.log(`NFTceria running at ${server.url}`);
