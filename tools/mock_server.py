import json, threading, time, sys
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

DB = {}
LOCK = threading.Lock()

def resolve_ts(v):
    if isinstance(v, dict):
        if v.get('.sv') == 'timestamp':
            return int(time.time() * 1000)
        return {k: resolve_ts(x) for k, x in v.items()}
    if isinstance(v, list):
        return [resolve_ts(x) for x in v]
    return v

def prune(v):
    if v is None:
        return None
    if isinstance(v, list):
        v = {str(i): x for i, x in enumerate(v)}
    if isinstance(v, dict):
        out = {}
        for k, x in v.items():
            px = prune(x)
            if px is not None:
                out[k] = px
        return out or None
    return v

def set_at(db, path, value):
    ks = [k for k in path.split('/') if k]
    value = prune(resolve_ts(value))
    if not ks:
        return value or {}
    cur = db
    for k in ks[:-1]:
        if not isinstance(cur.get(k), dict):
            cur[k] = {}
        cur = cur[k]
    if value is None:
        cur.pop(ks[-1], None)
    else:
        cur[ks[-1]] = value
    return db

class H(SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=ROOT, **k)
    def log_message(self, *a):
        pass
    def send_json(self, obj):
        body = json.dumps(obj).encode()
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(body)
    def do_GET(self):
        if self.path.startswith('/__/firebase/init.json'):
            if not INIT:
                self.send_error(404); return
            return self.send_json({'apiKey': 'test', 'authDomain': 'mock.firebaseapp.com', 'databaseURL': 'https://mock.firebaseio.com', 'projectId': 'mock'})
        if self.path.startswith('/mock/db'):
            with LOCK:
                return self.send_json(DB)
        return super().do_GET()
    def do_POST(self):
        global DB
        if not self.path.startswith('/mock/db'):
            self.send_error(404); return
        n = int(self.headers.get('Content-Length', 0))
        op = json.loads(self.rfile.read(n) or b'{}')
        with LOCK:
            if op['op'] == 'set':
                DB = set_at(DB, op['path'], op['value'])
            elif op['op'] == 'update':
                for k, v in op['value'].items():
                    DB = set_at(DB, (op['path'] + '/' + k) if op['path'] else k, v)
            elif op['op'] == 'reset':
                DB = {}
        return self.send_json({'ok': True})

port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
ROOT = sys.argv[2] if len(sys.argv) > 2 else '/mnt/user-data/outputs'
INIT = (sys.argv[3] != 'noinit') if len(sys.argv) > 3 else True
ThreadingHTTPServer(('127.0.0.1', port), H).serve_forever()
