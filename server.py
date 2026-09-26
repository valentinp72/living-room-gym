#!/usr/bin/env python3

import functools
import http.server
import ssl

DIRECTORY = "./www"
HOST = "0.0.0.0"
PORT = 8443

class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    # Make the browser check for a newer version of every file on each load
    # (it gets a quick 304 when nothing changed). Without this, the Quest
    # Browser can mix cached old modules with new ones after an update.
    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()


handler = functools.partial(NoCacheHandler, directory=DIRECTORY)

server = http.server.ThreadingHTTPServer((HOST, PORT), handler)

context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
context.load_cert_chain("cert.pem", "key.pem")

server.socket = context.wrap_socket(server.socket, server_side=True)

print(f"Serving the current directory at https://localhost:{PORT}")
server.serve_forever()
