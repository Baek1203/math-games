/* 테스트용 가짜 Firebase: 규칙을 흉내 내고, 자료는 테스트 서버(/mock/db)에 둔다 */
(function () {
  const TEACHER = 'teacher@test.kr';
  const parts = p => String(p || '').split('/').filter(Boolean);
  let cache = {};
  async function pull() { const r = await fetch('/mock/db', { cache: 'no-store' }); cache = await r.json(); return cache; }
  async function post(op) { await fetch('/mock/db', { method: 'POST', body: JSON.stringify(op) }); await pull(); fireAll(); }
  function getAt(db, path) { let cur = db; for (const k of parts(path)) { if (cur == null || typeof cur !== 'object') return null; cur = cur[k]; } return cur === undefined ? null : cur; }
  function toVal(v) {
    if (v === null || typeof v !== 'object') return v;
    const keys = Object.keys(v);
    if (keys.length && keys.every(k => /^\d+$/.test(k))) {
      const max = Math.max(...keys.map(Number));
      if (keys.length * 2 > max) { const arr = []; for (let i = 0; i <= max; i++) arr.push(v[i] === undefined ? null : toVal(v[i])); return arr; }
    }
    const o = {}; keys.forEach(k => { o[k] = toVal(v[k]); }); return o;
  }
  const mainCtx = { user: null, subs: new Set() };
  /* 새 규칙 흉내: 관리자 한 명, 승인된 선생님, 방마다 비밀 열쇠 */
  const ADMIN = TEACHER;
  const isAdmin = u => !!u && !u.isAnonymous && u.email === ADMIN;
  const approved = u => !!u && !u.isAnonymous && getAt(cache, 'teachers/' + u.uid + '/status') === 'approved';
  const keyOwner = k => getAt(cache, 'keys/' + k + '/owner');
  function canRead(path, ctx) {
    const ks = parts(path), u = (ctx || mainCtx).user;
    if (ks[0] === '.info' || ks[0] === 'hub' || ks[0] === 'rooms' || ks[0] === 'schools') return true;
    if ((ks[0] === 'views' && ks.length >= 2) || (ks[0] === 'doors' && ks.length >= 3)) return true;
    if (isAdmin(u)) return true;
    if (!u) return false;
    if ((ks[0] === 'teachers' || ks[0] === 'teacherRooms') && ks.length >= 2 && ks[1] === u.uid) return true;
    if (ks[0] === 'keys' && ks.length >= 2) return keyOwner(ks[1]) === u.uid;
    if (ks[0] === 'schoolSecrets' && ks.length >= 2) return approved(u);
    if (ks[0] === 'sb' && ks.length >= 2) return getAt(cache, 'skeys/' + ks[1]) != null;
    if (ks[0] === 'gb' && ks.length >= 2) return true;
    if (ks[0] === 'r' && ks.length >= 2) {
      if (keyOwner(ks[1]) === u.uid) return true;
      if (getAt(cache, 'keys/' + ks[1]) == null || ks[2] !== 'apps') return false;
      if (ks[4] === 'players' && ks.length === 6) return true;
      if (ks[4] === 'board' && ks.length >= 5) return true;
    }
    return false;
  }
  function canWrite(path, value, ctx) {
    const u = (ctx || mainCtx).user, ks = parts(path), cur = getAt(cache, path);
    if (ks[0] === 'teachers' && ks.length === 2) {
      const self = !!u && !u.isAnonymous && ks[1] === u.uid && (!cur || cur.status === 'pending');
      if (!isAdmin(u) && !self) return false;
      if (value === null) return isAdmin(u);
      if (typeof value !== 'object' || typeof value.name !== 'string' || typeof value.school !== 'string' || typeof value.email !== 'string') return false;
      if (value.status === 'pending') return isAdmin(u) || value.email === u.email;
      return isAdmin(u) && (value.status === 'approved' || value.status === 'rejected');
    }
    if (isAdmin(u)) return true;
    if (!u) return false;
    const ok = approved(u);
    const scoreOk = v => !!v && typeof v === 'object' && typeof v.name === 'string' && v.name.length <= 20 && typeof v.score === 'number' && v.score >= 0 && v.score <= 100000 && !(cur && typeof cur.score === 'number' && v.score < cur.score);
    if (ks[0] === 'schools' && ks.length === 2) {
      if (!ok) return false;
      if (cur) return cur.owner === u.uid && (value === null || value.owner === u.uid);
      return !!value && value.owner === u.uid && typeof value.name === 'string';
    }
    if (ks[0] === 'schoolSecrets' && ks.length === 2) {
      if (!ok || getAt(cache, 'schools/' + ks[1] + '/owner') !== u.uid || (cur && value !== null)) return false;
      return value === null || getAt(cache, 'skeys/' + value.skey + '/school') === ks[1];
    }
    if (ks[0] === 'skeys' && ks.length === 2) {
      if (!ok) return false;
      if (cur) return value === null && getAt(cache, 'schools/' + cur.school + '/owner') === u.uid;
      return !!value && /^[A-Za-z0-9]{20,40}$/.test(ks[1]) && getAt(cache, 'schools/' + value.school + '/owner') === u.uid;
    }
    if (ks[0] === 'sb' && ks.length === 4) return value === null ? ok : getAt(cache, 'skeys/' + ks[1]) != null && scoreOk(value);
    if (ks[0] === 'gb' && ks.length === 3) return value === null ? ok : scoreOk(value) && typeof value.school === 'string';
    if (ks[0] === 'rooms' && ks.length === 2) {
      if (!ok) return false;
      if (cur) return cur.owner === u.uid && (value === null || value.owner === u.uid);
      return !!value && value.owner === u.uid && typeof value.school === 'string' && getAt(cache, 'schools/' + value.schoolId) != null;
    }
    if (ks[0] === 'keys' && ks.length === 2) {
      if (!ok) return false;
      if (cur) return cur.owner === u.uid && value === null;
      return !!value && /^[A-Za-z0-9]{20,40}$/.test(ks[1]) && value.owner === u.uid && getAt(cache, 'rooms/' + value.room + '/owner') === u.uid;
    }
    if (ks[0] === 'doors' && ks.length === 3) {
      if (!ok || getAt(cache, 'rooms/' + ks[1] + '/owner') !== u.uid || !/^[0-9A-Z]{4,12}$/.test(ks[2])) return false;
      return value === null || (keyOwner(value.key) === u.uid && getAt(cache, 'keys/' + value.key + '/room') === ks[1] && getAt(cache, 'skeys/' + value.skey + '/school') === getAt(cache, 'rooms/' + ks[1] + '/schoolId'));
    }
    if (ks[0] === 'views' && ks.length >= 2) return ok && keyOwner(ks[1]) === u.uid;
    if (ks[0] === 'teacherRooms' && ks.length >= 2) return ok && ks[1] === u.uid;
    if (ks[0] === 'r' && ks.length >= 2) {
      if (keyOwner(ks[1]) === u.uid) return true;
      if (getAt(cache, 'keys/' + ks[1]) == null || ks[2] !== 'apps') return false;
      const kind = ks[4];
      if ((kind === 'players' || kind === 'live') && ks.length === 6) return value !== null;
      if (kind === 'plays' && ks.length === 6) return value !== null && cur == null;
      if (kind === 'board' && ks.length === 6) return scoreOk(value) && typeof value.sid === 'string';
    }
    return false;
  }
  const denied = () => Object.assign(new Error('permission_denied'), { code: 'PERMISSION_DENIED' });
  const listeners = [];
  function evalQuery(path, q) {
    let v = toVal(getAt(cache, path));
    if (q && v && typeof v === 'object') {
      const o = {}; Object.entries(v).forEach(([k, x]) => { if (x && x[q.child] === q.equal) o[k] = x; });
      v = Object.keys(o).length ? o : null;
    }
    return v;
  }
  function snap(v) { return { val: () => (v === undefined ? null : v), exists: () => v != null }; }
  function deliver(l) {
    if (l.path === '.info/connected') return;
    if (!canRead(l.path, l.ctx)) { if (!l.denied) { l.denied = true; if (l.err) l.err(denied()); } return; }
    const v = evalQuery(l.path, l.query), s = JSON.stringify(v);
    if (s !== l.last) { l.last = s; l.cb(snap(v)); }
  }
  function fireAll() { listeners.slice().forEach(deliver); }
  setInterval(() => { if (listeners.some(l => l.path !== '.info/connected')) pull().then(fireAll).catch(() => {}); }, 250);
  window.__mockWrites = [];
  function makeRef(path, query, ctx) {
    ctx = ctx || mainCtx;
    const r = {
      key: parts(path).slice(-1)[0] || null,
      orderByChild: c => ({ equalTo: v => makeRef(path, { child: c, equal: v }, ctx) }),
      async once() { await pull(); if (!canRead(path, ctx)) throw denied(); return snap(evalQuery(path, query)); },
      on(ev, cb, err) {
        const l = { path, query, cb, err, last: undefined, ctx };
        listeners.push(l);
        if (path === '.info/connected') setTimeout(() => cb(snap(true)), 0);
        else pull().then(() => deliver(l));
        return cb;
      },
      off(ev, cb) { const i = listeners.findIndex(l => l.path === path && l.cb === cb); if (i >= 0) listeners.splice(i, 1); },
      async set(v) { await pull(); if (!canWrite(path, v, ctx)) throw denied(); window.__mockWrites.push(['set', path]); await post({ op: 'set', path, value: v }); },
      async update(obj) { await pull(); const cur0 = toVal(getAt(cache, path)); const merged = Object.assign({}, cur0 && typeof cur0 === 'object' ? cur0 : {}, obj); if (!canWrite(path, merged, ctx)) throw denied(); window.__mockWrites.push(['update', path]); await post({ op: 'update', path, value: obj }); },
      push(v) {
        const id = 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
        const child = makeRef(path + '/' + id, null, ctx);
        if (v === undefined) return child;
        const pr = child.set(v);
        child.then = pr.then.bind(pr); child.catch = pr.catch.bind(pr);
        return child;
      },
      async remove() { return r.set(null); },
      async transaction(fn) {
        await pull();
        if (!canRead(path, ctx)) throw denied();
        const cur = getAt(cache, path);
        const next = fn(cur == null ? null : toVal(cur));
        if (next === undefined) return { committed: false, snapshot: snap(cur) };
        await r.set(next);
        return { committed: true, snapshot: snap(next) };
      },
      child: k => makeRef(path + '/' + k, null, ctx),
      onDisconnect: () => ({ update: async () => {}, set: async () => {}, cancel: async () => {} }),
    };
    return r;
  }
  function makeAuth(ctx) {
    const setUser = u => { ctx.user = u; ctx.subs.forEach(f => f(u)); };
    return {
      get currentUser() { return ctx.user; },
      onAuthStateChanged(cb) { ctx.subs.add(cb); setTimeout(() => cb(ctx.user), 0); return () => ctx.subs.delete(cb); },
      async signInAnonymously() {
        if (window.__mockAnonOff) throw Object.assign(new Error('operation-not-allowed'), { code: 'auth/operation-not-allowed' });
        setUser({ uid: 'anon' + Math.random().toString(36).slice(2, 6), isAnonymous: true });
        return { user: ctx.user };
      },
      async setPersistence() {},
      async signInWithPopup() { const email = window.__mockTeacherEmail || TEACHER; setUser({ uid: 'u_' + email.replace(/[^a-z0-9]/gi, '_'), isAnonymous: false, email }); return { user: ctx.user }; },
      async signOut() { setUser(null); },
    };
  }
  const auth = makeAuth(mainCtx);
  const dbFor = ctx => ({ ref: p => makeRef(p ? String(p).replace(/^\/+|\/+$/g, '') : '', null, ctx) });
  const database = () => dbFor(mainCtx);
  database.ServerValue = { TIMESTAMP: { '.sv': 'timestamp' } };
  const authFn = () => auth;
  authFn.GoogleAuthProvider = function GoogleAuthProvider() {};
  authFn.Auth = { Persistence: { SESSION: 'session', LOCAL: 'local' } };
  window.firebase = {
    initializeApp: (cfg, name) => {
      if (!name) return { cfg };
      const ctx = { user: null, subs: new Set() };
      const a = makeAuth(ctx);
      return { cfg, name, auth: () => a, database: () => dbFor(ctx), delete: async () => {} };
    },
    auth: authFn, database, apps: [],
  };
  const init0 = window.firebase.initializeApp;
  window.firebase.initializeApp = (cfg, name) => { const a = init0(cfg, name); if (!name) window.firebase.apps.push(a); return a; };
  window.firebase.app = () => window.firebase.apps[0];
})();
