#!/usr/bin/env python3

import functools
import http.server
import ssl

DIRECTORY = "./www"
HOST = "0.0.0.0"
PORT = 8443

handler = functools.partial(
    http.server.SimpleHTTPRequestHandler,
    directory=DIRECTORY,
)

server = http.server.ThreadingHTTPServer((HOST, PORT), handler)

context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
context.load_cert_chain("cert.pem", "key.pem")

server.socket = context.wrap_socket(server.socket, server_side=True)

print(f"Serving the current directory at https://localhost:{PORT}")
server.serve_forever()
