#!/usr/bin/env python3
"""Local-only static server. Optional QA intake writes exclusively to --qa-dir."""
import argparse
import base64
import json
import re
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import cast
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent

class GameServer(ThreadingHTTPServer):
    qa_dir: Path | None = None


class Handler(SimpleHTTPRequestHandler):
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map, '.js': 'text/javascript', '.css': 'text/css'}
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        super().end_headers()

    def do_GET(self):
        if urlsplit(self.path).path == '/__health':
            data = json.dumps({'ok': True, 'game': 'TIDE SUP Racing', 'root': str(ROOT)}).encode()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return
        if urlsplit(self.path).path.startswith('/__qa'):
            self.send_error(404)
            return
        super().do_GET()

    def do_POST(self):
        dest = cast(GameServer, self.server).qa_dir
        if not dest or urlsplit(self.path).path != '/__qa':
            self.send_error(404)
            return
        # No cross-origin posting, path traversal, arbitrary file writes or unbounded payloads.
        origin = self.headers.get('Origin', '')
        expected = 'http://' + self.headers.get('Host', '')
        if origin and origin != expected:
            self.send_error(403)
            return
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if not 0 < length <= 6_000_000:
                raise ValueError('Invalid payload length')
            payload = json.loads(self.rfile.read(length))
            name = payload.get('name', '')
            if not re.fullmatch('[a-z][a-z0-9_-]{0,40}', name):
                raise ValueError('Invalid name')
            if 'image' in payload:
                value = payload['image']
                if not value.startswith('data:image/png;base64,'):
                    raise ValueError('PNG required')
                raw = base64.b64decode(value.split(',', 1)[1], validate=True)
                if not raw.startswith(b'\x89PNG\r\n\x1a\n'):
                    raise ValueError('Invalid PNG')
                (dest / (name+'.png')).write_bytes(raw)
                payload = {k:v for k,v in payload.items() if k != 'image'}
            (dest / (name+'.json')).write_text(json.dumps(payload, indent=2, ensure_ascii=False))
        except (ValueError, TypeError, KeyError) as error:
            self.send_error(400, str(error))
            return
        self.send_response(204)
        self.end_headers()


def main():
    parser = argparse.ArgumentParser(description='TIDE SUP Racing — local game server')
    parser.add_argument('--port', type=int, default=8765)
    parser.add_argument('--qa-dir', type=Path, help='Enable same-origin, bounded browser QA capture')
    args = parser.parse_args()
    if args.qa_dir:
        args.qa_dir.mkdir(parents=True, exist_ok=True)
        args.qa_dir = args.qa_dir.resolve()
    server = GameServer(('127.0.0.1', args.port), partial(Handler, directory=str(ROOT)))
    server.qa_dir = args.qa_dir
    print(f'TIDE: http://127.0.0.1:{args.port}/', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()

if __name__ == '__main__':
    main()
