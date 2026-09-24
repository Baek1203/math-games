/* ============================================================
   게임 목록의 '수업에 연 게임' 설정을 따르게 하는 한 줄 도우미
   이미 만든 게임의 index.html에서 </body> 바로 앞에 아래 한 줄을 넣으세요.
     <script src="../gate.js"></script>
   - 선생님이 수업 관리에서 '고른 게임만 보이기'로 두고 이 게임을 끄면
     "지금은 닫혀 있어요" 화면이 게임 위를 덮습니다. 켜면 저절로 사라져요.
   - 주소 끝에 #teacher가 붙은 선생님 화면은 가리지 않습니다.
   - 게임 폴더 이름이 게임 목록의 id와 다르면 이렇게 적어 주세요.
     <script src="../gate.js" data-game="게임id"></script>
   - 학급 서버에 닿지 않으면 아무것도 가리지 않습니다.
   ============================================================ */
(function () {
  const me = document.currentScript;
  const base = me && me.src ? me.src.replace(/[^/]*$/, '') : '../';
  const slug = (me && me.dataset.game) || (() => {
    const parts = location.pathname.split('/').filter(Boolean);
    if (parts.length && /\.html?$/i.test(parts[parts.length - 1])) parts.pop();
    try { return parts.length ? decodeURIComponent(parts[parts.length - 1]) : ''; } catch (e) { return ''; }
  })();
  let cover = null;

  function show(closed) {
    if (location.hash === '#teacher') closed = false;
    if (closed && !cover) {
      cover = document.createElement('div');
      cover.setAttribute('role', 'dialog');
      cover.setAttribute('aria-modal', 'true');
      cover.style.cssText = 'position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;padding:1.5rem;'
        + 'background:rgba(247,249,252,.97);font-family:"Gowun Dodum","Apple SD Gothic Neo","Malgun Gothic",sans-serif;color:#1b2440;text-align:center;';
      cover.innerHTML = '<div style="max-width:28rem">'
        + '<p style="margin:0 0 .6rem;font-size:2rem;font-weight:700">지금은 닫혀 있어요</p>'
        + '<p style="margin:0 0 1.4rem;line-height:1.6;color:#5a6480">선생님이 이번 수업에서 이 게임을 열어 두지 않았어요. 게임 목록에서 열린 게임을 확인해 보세요. 선생님이 열면 이 화면은 저절로 사라져요.</p>'
        + '<a href="' + base + '" style="display:inline-block;padding:.7rem 1.4rem;border-radius:12px;background:#2d5bd1;color:#fff;text-decoration:none;font-weight:700">게임 목록으로</a>'
        + '</div>';
      document.body.appendChild(cover);
    } else if (!closed && cover) {
      cover.remove();
      cover = null;
    }
  }

  async function check(cfg) {
    try {
      const res = await fetch(cfg.databaseURL.replace(/\/+$/, '') + '/hub.json', { cache: 'no-store' });
      if (!res.ok) return;
      const hub = await res.json();
      show(!!hub && hub.mode === 'selected' && !(hub.open && hub.open[slug]));
    } catch (e) { /* 서버에 닿지 않으면 가리지 않는다 */ }
  }

  function start() {
    const cfg = window.CLASS_FIREBASE_CONFIG;
    if (!cfg || !cfg.databaseURL || !slug) return;
    check(cfg);
    setInterval(() => check(cfg), 10000);
    window.addEventListener('hashchange', () => check(cfg));
  }

  if (window.CLASS_FIREBASE_CONFIG !== undefined) start();
  else {
    const s = document.createElement('script');
    s.src = base + 'firebase-config.js';
    s.onload = start;
    document.head.appendChild(s);
  }
})();
