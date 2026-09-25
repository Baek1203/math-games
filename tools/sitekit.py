"""수학 게임 시험 도구: 가짜 Firebase(mock_firebase.js)와 시험 서버(mock_server.py)로 실제 페이지를 브라우저에서 시험한다.
이 파일과 mock_firebase.js, mock_server.py를 한 폴더에 둔다.

준비 (한 번):
  pip install playwright --break-system-packages   # 이미 있으면 건너뜀
  python3 -m playwright install chromium            # 이미 있으면 건너뜀

시험할 사이트 폴더는 저장소와 같은 모양으로 만든다:
  SITE/repo/index.html              게임 목록 (사용자가 올린 최신본)
  SITE/repo/gate.js
  SITE/repo/firebase-config.js      시험용: test_config(SITE)가 만들어 준다 (진짜 설정을 쓰지 않는다)
  SITE/repo/<게임 폴더>/index.html

쓰는 법:
  import sys; sys.path.insert(0, '이 폴더'); from sitekit import *
  test_config(SITE); BASE = start(SITE)                 # 가짜 서버를 켜고 주소를 받는다 (http://127.0.0.1:8801/repo/)
  with sync_playwright() as p:
      b = p.chromium.launch()
      room = seed_room('kim@school.kr', '김지현', '전주중앙중학교', '1학년 3반', 'MATH2026')  # 승인된 선생님·학교·교실
      S, errs = page(b)                                  # 학생 브라우저 (errs에 페이지 오류가 모인다)
      S.goto(BASE); S.evaluate(join_js('10523', '김민준', room))    # 이 교실 학생으로 등록 (test=True면 테스트 계정)
      S.goto(BASE + 'my-game/')
      check(get(db(), f"r/{room['key']}/apps/my-game/players/10523_김민준") is not None, '진행 기록 저장')
      K, _ = page(b, email='kim@school.kr')             # 선생님 브라우저: Google 로그인 단추를 누르면 이 계정으로
  stop()
가짜 Firebase는 firebase-rules.json의 규칙을 손으로 옮겨 흉내 낸다. 규칙을 바꾸면 mock_firebase.js의 canRead/canWrite도 같이 고친다.
주의: 가짜 서버는 빈 폴더를 지우지 않는다(진짜 Firebase는 지운다). 시험에서 '없음'을 볼 때는 `not (get(...) or {})`로 본다."""
import os, sys, subprocess, time, json, urllib.request, urllib.parse, re, secrets
from playwright.sync_api import sync_playwright
KIT = os.path.dirname(os.path.abspath(__file__))
MOCK = open(os.path.join(KIT, 'mock_firebase.js'), encoding='utf-8').read()
PORT, BASE, SRV = 8801, 'http://127.0.0.1:8801/repo/', None
fails = []

def check(c, m):
    print(('PASS ' if c else 'FAIL ') + m)
    if not c: fails.append(m)
def test_config(site):
    os.makedirs(os.path.join(site, 'repo'), exist_ok=True)
    open(os.path.join(site, 'repo', 'firebase-config.js'), 'w', encoding='utf-8').write(
        'window.CLASS_FIREBASE_CONFIG = { apiKey: "test", authDomain: "mock.firebaseapp.com", databaseURL: "https://mock.firebaseio.com", projectId: "mock" };\n')
def start(site, port=8801):
    global PORT, BASE, SRV
    PORT, BASE = port, f'http://127.0.0.1:{port}/repo/'
    SRV = subprocess.Popen([sys.executable, os.path.join(KIT, 'mock_server.py'), str(port), site, 'noinit'])
    time.sleep(0.8)
    return BASE
def stop():
    if SRV: SRV.terminate()
def db():
    return json.load(urllib.request.urlopen(f'http://127.0.0.1:{PORT}/mock/db'))
def get(d, path):
    for k in [x for x in path.split('/') if x]:
        d = (d or {}).get(k) if isinstance(d, dict) else None
    return d
def post(path, value):
    """규칙을 거치지 않고 서버에 값을 넣는다 (시험 준비용)"""
    req = urllib.request.Request(f'http://127.0.0.1:{PORT}/mock/db', data=json.dumps({'op': 'set', 'path': path, 'value': value}).encode(), method='POST')
    urllib.request.urlopen(req).read()
def _rest(route):
    path = urllib.parse.urlparse(route.request.url).path.replace('.json', '')
    route.fulfill(status=200, content_type='application/json', body=json.dumps(get(db(), path)))
def page(b, email=None, clock=False, w=1280, h=860):
    """가짜 Firebase가 들어간 새 브라우저 창. email을 주면 그 선생님 Google 계정으로 로그인된다. clock=True면 시간을 빨리 돌릴 수 있다(pg.clock.run_for)."""
    ctx = b.new_context(viewport={'width': w, 'height': h})
    pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.route('**/fonts.g*/**', lambda r: r.abort())
    js = lambda body: (lambda route: route.fulfill(status=200, content_type='application/javascript', body=body))
    for f in ['app', 'auth', 'database']:
        pg.route(f'https://www.gstatic.com/firebasejs/10.12.2/firebase-{f}-compat.js', js(MOCK if f == 'app' else '/* mock */'))
    pg.route('https://mock.firebaseio.com/**', _rest)
    if email: pg.add_init_script(f"window.__mockTeacherEmail = '{email}';")
    if clock: pg.clock.install()
    return pg, errs
uid = lambda email: 'u_' + re.sub(r'[^a-z0-9]', '_', email, flags=re.I)
def seed_school(email, school):
    u, sid, skey = uid(email), 'sch' + secrets.token_hex(4), 'S' + secrets.token_hex(14)
    post(f'schools/{sid}', {'name': school, 'owner': u})
    post(f'skeys/{skey}', {'school': sid})
    post(f'schoolSecrets/{sid}', {'skey': skey})
    return {'schoolId': sid, 'skey': skey, 'school': school}
def seed_room(email, name, school, label, code, in_school=None):
    """승인된 선생님과 교실. in_school(seed_school이나 다른 seed_room의 결과)을 주면 그 학교에 교실을 더한다."""
    u, rid, key = uid(email), 'room' + secrets.token_hex(4), 'K' + secrets.token_hex(14)
    post(f'teachers/{u}', {'name': name, 'school': school, 'email': email, 'status': 'approved'})
    sc = in_school or seed_school(email, school)
    post(f'rooms/{rid}', {'school': sc['school'], 'schoolId': sc['schoolId'], 'label': label, 'teacher': name, 'owner': u})
    post(f'keys/{key}', {'room': rid, 'owner': u})
    post(f'doors/{rid}/{code}', {'key': key, 'skey': sc['skey']})
    post(f'views/{key}', {'mode': 'all'})
    post(f'teacherRooms/{u}/{rid}', {'key': key, 'skey': sc['skey'], 'school': sc['school'], 'schoolId': sc['schoolId'], 'label': label, 'code': code})
    return {'id': rid, 'key': key, 'code': code, 'school': sc['school'], 'schoolId': sc['schoolId'], 'skey': sc['skey'], 'label': label, 'teacher': name, 'uid': u}
def join_js(sid, name, room, test=False):
    """페이지에서 evaluate하면 그 브라우저가 이 교실의 학생이 된다 (게임 목록의 교실 입장과 같은 결과)"""
    r = {k: room[k] for k in ('id', 'key', 'skey', 'school', 'schoolId', 'label', 'teacher')}
    who = {'sid': sid, 'name': name}
    if test: who['test'] = True
    return f"localStorage.setItem('mathgames.student', JSON.stringify({json.dumps(who, ensure_ascii=False)})); localStorage.setItem('mathgames.room', JSON.stringify({json.dumps(r, ensure_ascii=False)}));"
