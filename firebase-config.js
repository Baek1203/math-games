/* ============================================================
   학급 서버(Firebase) 설정: 이 저장소의 모든 게임이 함께 씁니다.

   Firebase 콘솔 > 프로젝트 설정(톱니바퀴) > 일반 > 내 앱(웹 앱)에 나오는
   firebaseConfig 값을 아래 null 자리에 붙여 넣으세요. 예:

   window.CLASS_FIREBASE_CONFIG = {
     apiKey: "AIza...",
     authDomain: "프로젝트ID.firebaseapp.com",
     databaseURL: "https://프로젝트ID-default-rtdb.asia-southeast1.firebasedatabase.app",
     projectId: "프로젝트ID",
     appId: "1:...:web:..."
   };

   이 값들은 공개 저장소에 올라가도 괜찮습니다. 기록은 Firebase 규칙이 지킵니다.
   null로 두면 각 게임이 노트북마다 따로 기록을 저장합니다.
   ============================================================ */
window.CLASS_FIREBASE_CONFIG = {
  apiKey: "AIzaSyDiZcz7eqZ8uwfzW80UkQ0G-hvFyKjLT1I",
  authDomain: "math-games-260924.firebaseapp.com",
  projectId: "math-games-260924",
  storageBucket: "math-games-260924.firebasestorage.app",
  messagingSenderId: "413496858814",
  appId: "1:413496858814:web:5c317fcc2ad8a5a6cfa6ef"
};
/* 게임 화면 아래쪽에 '게임 목록' 링크를 보여 줍니다. */
window.CLASS_GAMES_HUB = true;
