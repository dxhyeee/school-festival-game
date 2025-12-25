/**
 * ============================================
 * [2D Top-Down] 모여봐요 코딩의 숲 - 최종 통합본 (레온+벌 게임 포함)
 * ============================================
 */

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// 이미지 에셋 가져오기
const imgNook = document.getElementById('npc-nook');
const imgIsabelle = document.getElementById('npc-isabelle');
const imgBlathers = document.getElementById('npc-blathers');
const imgLeon = document.getElementById('npc-leon'); // 레온 이미지
const imgTree = document.getElementById('tree-img');
const imgPlayer = document.getElementById('player-img');
const imgSchool = document.getElementById('school-building-img');
const imgPond = document.getElementById('pond-img');

// 전역 변수
let playerName = "익명";
let startTime = 0;
let isGameStarted = false;
let timerInterval = null;

let gameState = 'roaming';
let frameCount = 0;
let fossilHitCount = 0;

// 벌 피하기 관련 변수
let bees = [];
let beeTimer = 0;
const BEE_SURVIVE_TIME = 10; // 10초 버티기

const player = { x: 400, y: 300, size: 30, speed: 5, moving: false, dir: 1, type: 'player' };

// 미션 완료 여부 (꿀단지 추가됨)
const missions = { quiz: false, fish: false, fossil: false, honey: false };

const environment = [
    { id: 'school', img: imgSchool, x: 400, y: 90, type: 'building', width: 500, height: 300 },
    { id: 'pond', img: imgPond, x: 150, y: 500, type: 'pond', width: 300, height: 200 },
];

// NPC 데이터 (레온 추가)
const npcs = [
    {
        id: 'nook', name: "너굴", img: imgNook, x: 600, y: 250,
        script: ["어서오게구리! 퀴즈를 맞히면 자금을 주지!", "학교 상식 퀴즈라네!"],
        doneScript: "대단하구리! 퀴즈는 완벽해!",
        type: 'npc', quizType: 'quiz'
    },
    {
        id: 'isabelle', name: "여울", img: imgIsabelle, x: 192, y: 453,
        script: ["안녕하세요! 강에서 물고기 3마리만 잡아주세요.", "어렵지 않아요, 타이밍이 중요해요!"],
        doneScript: "싱싱한 물고기 정말 고마워요!",
        type: 'npc', quizType: 'fish'
    },
    {
        id: 'blathers', name: "부엉", img: imgBlathers, x: 700, y: 550,
        script: ["부르르... 땅속 깊은 곳에 '별모양 화석'이 있습니다!", "스페이스바를 열심히 눌러 발굴해주세요! ⛏️"],
        doneScript: "호오! 박물관에 전시하겠습니다!",
        type: 'npc', quizType: 'fossil'
    },
    {
        // [신규] 레온: 벌 나무(50, 50) 근처 100, 100 위치
        id: 'leon', name: "레온", img: imgLeon, x: 100, y: 100,
        script: ["...이 나무에서 웅웅거리는 소리가 들려.", "엄청난 벌떼가 나올 것 같아. 10초 동안 버틸 수 있겠어? (꿀꺽)"],
        doneScript: "대단해... 벌들이 남기고 간 꿀이야.",
        type: 'npc', quizType: 'honey'
    }
];

// 나무 (첫 번째 나무는 벌 나오는 나무)
const trees = [
    { x: 50, y: 50, type: 'tree', isBeeTree: true },
    { x: 90, y: 60, type: 'tree' },
    { x: 750, y: 80, type: 'tree' },
    { x: 30, y: 550, type: 'tree' },
    { x: 700, y: 200, type: 'tree' }
];

// 화석
const FOSSIL_AREA = { x1: 50, y1: 250, x2: 750, y2: 550 };
const fossil = {
    x: FOSSIL_AREA.x1 + Math.random() * (FOSSIL_AREA.x2 - FOSSIL_AREA.x1),
    y: FOSSIL_AREA.y1 + Math.random() * (FOSSIL_AREA.y2 - FOSSIL_AREA.y1),
    found: false,
    type: 'fossil'
};

const keys = {};

window.addEventListener('keydown', e => {
    keys[e.code] = true;
    if (!isGameStarted) return;
    if (e.code === 'Space') {
        if (gameState === 'dialog') nextDialog();
        else if (gameState === 'roaming') checkInteraction();
        else if (gameState === 'fishing') catchFish();
    }
});
window.addEventListener('keyup', e => { keys[e.code] = false; });

function startGame() {
    const input = document.getElementById('player-name-input');
    if (input.value.trim() === "") { alert("이름을 입력해줘구리!"); return; }
    playerName = input.value.trim();
    isGameStarted = true;
    document.getElementById('intro-screen').style.display = 'none';
    document.getElementById('timer-display').style.display = 'block';

    startTime = Date.now();
    timerInterval = setInterval(() => {
        const elapsed = (Date.now() - startTime) / 1000;
        document.getElementById('timer-display').innerText = `시간: ${elapsed.toFixed(2)}초`;
    }, 50);
    gameLoop();
}

function gameLoop() {
    if (!isGameStarted) return;
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

function update() {
    frameCount++;

    // 1. 이동 로직 (일반 + 벌 피하기 모드 공통)
    if (gameState === 'roaming' || gameState === 'avoiding') {
        let dx = 0, dy = 0;
        if (keys.ArrowUp) dy = -1;
        if (keys.ArrowDown) dy = 1;
        if (keys.ArrowLeft) dx = -1;
        if (keys.ArrowRight) dx = 1;

        if (dx !== 0 || dy !== 0) {
            player.moving = true;
            if (dx !== 0) player.dir = dx;

            // 벌 피할 땐 플레이어 속도가 약간 빨라짐 (긴장감)
            const moveSpeed = (gameState === 'avoiding') ? player.speed * 1.1 : player.speed;

            let nextX = player.x + dx * moveSpeed;
            let nextY = player.y + dy * moveSpeed;
            if(nextX > 20 && nextX < 780) player.x = nextX;
            if(nextY > 20 && nextY < 580) player.y = nextY;
        } else { player.moving = false; }
    }

    // 2. 벌 피하기 게임 업데이트
    if (gameState === 'avoiding') {
        updateBeeGame();
    } else {
        // 일반 상태일 때 힌트 표시
        const distToFossil = Math.hypot(player.x - fossil.x, player.y - fossil.y);
        const helpText = document.getElementById('help-text');

        if (!missions.fossil && !fossil.found && distToFossil < 70) {
            helpText.style.display = 'block';
            helpText.innerText = `⛏️ 발굴 중... (${fossilHitCount}/10)`;
        } else {
            helpText.style.display = 'none';
        }
    }

    if (gameState === 'fishing') updateFishing();

    // 엔딩 체크 (4가지 미션 모두 완료 시)
    if (missions.quiz && missions.fish && missions.fossil && missions.honey) {
        endGame();
    }
}

// --- [벌 피하기 미니게임 로직] ---
function initBeeGame() {
    if(missions.honey) return;

    gameState = 'avoiding';
    bees = [];
    beeTimer = BEE_SURVIVE_TIME;

    // 대화창 숨기고 게임 UI 표시
    document.getElementById('dialog-box').style.display = 'none';
    document.getElementById('bee-timer-ui').style.display = 'block';

    // 벌 5마리 생성 (랜덤 위치)
    for(let i=0; i<5; i++) {
        bees.push({
            x: Math.random() < 0.5 ? 0 : 800,
            y: Math.random() * 600,
            speed: 2.5 + Math.random() * 1.5
        });
    }
}

function updateBeeGame() {
    // 타이머 감소
    beeTimer -= 1/60;
    if (beeTimer <= 0) { endBeeGame(true); return; }
    document.getElementById('bee-timer-ui').innerText = beeTimer.toFixed(2);

    // 벌 이동 (플레이어 추적)
    for (let bee of bees) {
        let dx = player.x - bee.x;
        let dy = player.y - bee.y;
        let dist = Math.hypot(dx, dy);

        if (dist > 0) {
            bee.x += (dx / dist) * bee.speed;
            bee.y += (dy / dist) * bee.speed;
        }

        // 충돌 체크
        if (dist < 20) {
            endBeeGame(false); // 실패
            return;
        }
    }
}

function endBeeGame(success) {
    document.getElementById('bee-timer-ui').style.display = 'none';
    gameState = 'roaming';
    bees = [];

    if (success) {
        alert("성공! 레온이 꿀단지를 건네줬어! 🍯");
        completeMission('honey');
    } else {
        alert("따끔! 벌에 쏘였다...\n다시 레온에게 말을 걸어봐.");
        // 실패 시 플레이어를 안전한 곳으로 이동
        player.x = 400; player.y = 300;
    }
}

function endGame() {
    if (!isGameStarted) return;
    isGameStarted = false;
    clearInterval(timerInterval);
    const finalTime = (Date.now() - startTime) / 1000;
    document.getElementById('final-time-text').innerText = `${playerName}님의 기록: ${finalTime.toFixed(2)}초`;
    saveAndShowRanking(playerName, finalTime);
    document.getElementById('ending-screen').style.display = 'flex';
}

function saveAndShowRanking(name, time) {
    let ranks = JSON.parse(localStorage.getItem('festivalRanks')) || [];
    ranks.push({ name, time });
    ranks.sort((a, b) => a.time - b.time);
    ranks = ranks.slice(0, 5);
    localStorage.setItem('festivalRanks', JSON.stringify(ranks));
    document.getElementById('ranking-list').innerHTML = ranks.map((r, i) => {
        let medal = i===0 ? "🥇" : (i===1 ? "🥈" : (i===2 ? "🥉" : "⚪"));
        return `<div>${medal} ${i+1}위 : ${r.name} <span>(${r.time.toFixed(2)}s)</span></div>`;
    }).join('');
}

// --- 그리기 함수 (Draw) ---
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#d8b88d"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "white"; ctx.lineWidth = 4;
    ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);

    const renderList = [...environment, ...npcs, ...trees, player];
    if (fossil.found) renderList.push(fossil);
    renderList.sort((a, b) => a.y - b.y);

    renderList.forEach(obj => {
        if (obj.type === 'building') drawBuilding(obj);
        else if (obj.type === 'pond') drawPond(obj);
        else if (obj.type === 'tree') drawTree(obj);
        else if (obj.type === 'npc') drawNPC(obj);
        else if (obj.type === 'player') drawPlayer(obj);
        else if (obj.type === 'fossil') drawFossil(obj);
    });

    if (!fossil.found && !missions.fossil && frameCount % 120 < 20) {
        ctx.fillStyle = "gold"; ctx.beginPath(); ctx.arc(fossil.x, fossil.y, 4, 0, Math.PI*2); ctx.fill();
    }

    // 벌 피하기 게임 중일 때 벌 그리기
    if (gameState === 'avoiding') {
        for(let bee of bees) {
            ctx.font = "24px Arial"; ctx.textAlign = "center"; ctx.fillText("🐝", bee.x, bee.y);
        }
    }
}

function drawBuilding(obj) { if (obj.img.complete) ctx.drawImage(obj.img, obj.x - obj.width / 2, obj.y - obj.height / 2, obj.width, obj.height); else { ctx.fillStyle = "#A7D2C4"; ctx.fillRect(obj.x - obj.width/2, obj.y - obj.height/2, obj.width, obj.height); } }
function drawPond(obj) { if (obj.img.complete) ctx.drawImage(obj.img, obj.x - obj.width / 2, obj.y - obj.height / 2, obj.width, obj.height); else { ctx.fillStyle = "#6495ED"; ctx.beginPath(); ctx.ellipse(obj.x, obj.y, obj.width/2, obj.height/2, 0, 0, Math.PI*2); ctx.fill(); } }
function drawTree(t) {
    drawShadow(t.x, t.y, 2.0);
    // 벌 피하기 게임 중이면 벌 나무가 흔들림
    let shakeX = 0;
    if (t.isBeeTree && gameState === 'avoiding') shakeX = (Math.random() - 0.5) * 10;
    ctx.drawImage(imgTree, t.x - 50 + shakeX, t.y - 100, 100, 120);
}
function drawNPC(npc) {
    drawShadow(npc.x, npc.y, 1.5);
    // 이미지가 로드되면 이미지, 아니면 붉은 박스(레온)
    if (npc.img && npc.img.complete && npc.img.naturalHeight !== 0) {
        ctx.drawImage(npc.img, npc.x - 30, npc.y - 50, 60, 60);
    } else {
        ctx.fillStyle = "#ff6347"; ctx.fillRect(npc.x - 20, npc.y - 50, 40, 50); // 이미지 없을 때 대체
    }

    ctx.fillStyle = "white"; ctx.font = "bold 14px Gaegu"; ctx.textAlign = "center";
    ctx.fillText(npc.name, npc.x, npc.y - 65);

    // 상태 아이콘
    if (missions[npc.quizType]) ctx.fillText("❤️", npc.x, npc.y - 80);
    else if (npc.quizType === 'fossil' && fossil.found) ctx.fillText("!", npc.x, npc.y - 80);
}
function drawPlayer(p) { drawShadow(p.x, p.y, 1.2); ctx.save(); ctx.translate(p.x, p.y); ctx.scale(p.dir, 1); let bobY = p.moving ? Math.sin(frameCount * 0.2) * 3 : 0; ctx.drawImage(imgPlayer, -30, -50 + bobY, 60, 60); ctx.restore(); }
function drawFossil(f) { drawShadow(f.x, f.y, 0.8); ctx.font = "30px Arial"; ctx.fillText("⭐", f.x, f.y); }
function drawShadow(x, y, scale) { ctx.fillStyle = "rgba(0, 0, 0, 0.2)"; ctx.beginPath(); ctx.ellipse(x, y + 5, 15 * scale, 8 * scale, 0, 0, Math.PI * 2); ctx.fill(); }

// --- 상호작용 ---
function checkInteraction() {
    for (let npc of npcs) {
        const dist = Math.hypot(player.x - npc.x, player.y - npc.y);
        if (dist < 60) { startDialog(npc); return; }
    }
    // 화석 발굴
    if (!missions.fossil && !fossil.found) {
        if (Math.hypot(player.x - fossil.x, player.y - fossil.y) < 70) {
            if (keys.Space) { fossilHitCount++; if (fossilHitCount >= 10) { fossil.found = true; alert("화석 발견!"); } keys.Space = false; }
            return;
        } else { fossilHitCount = 0; }
    }
}

// --- 대화/미니게임 시작 ---
let currentNpc = null; let dialogIndex = 0;
function startDialog(npc) {
    gameState = 'dialog'; currentNpc = npc; dialogIndex = 0;
    document.getElementById('dialog-box').style.display = 'block';
    document.getElementById('npc-name-tag').innerText = npc.name;
    if (missions[npc.quizType]) { document.getElementById('dialog-content').innerText = npc.doneScript; dialogIndex = -1; }
    else if (npc.quizType === 'fossil' && fossil.found) { document.getElementById('dialog-content').innerText = "화석 감사합니다!"; completeMission('fossil'); dialogIndex = -1; }
    else document.getElementById('dialog-content').innerText = currentNpc.script[0];
}
function nextDialog() {
    if (dialogIndex === -1) { closeDialog(); return; }
    dialogIndex++;
    if (currentNpc && dialogIndex < currentNpc.script.length) document.getElementById('dialog-content').innerText = currentNpc.script[dialogIndex];
    else { closeDialog(); startMinigame(currentNpc.quizType); }
}
function closeDialog() { document.getElementById('dialog-box').style.display = 'none'; gameState = 'roaming'; }

function startMinigame(type) {
    if (type === 'quiz') initQuiz();
    if (type === 'fish') initFishing();
    if (type === 'honey') initBeeGame(); // 레온 대화 끝나면 벌 게임 실행
}

// --- 낚시 (3-2-1 카운트다운 포함) ---
let fishPos = 0, fishSpeed = 4, caughtCount = 0, isQTEActive = false, targetStart = 100; const TARGET_WIDTH = 75;
function initFishing() { gameState = 'fishing'; caughtCount = 0; document.getElementById('fishing-game').style.display = 'block'; document.getElementById('fishing-target').style.width = TARGET_WIDTH + "px"; startWaitingForBite(); }
function startWaitingForBite() { isQTEActive = false; const cd = document.getElementById('fishing-countdown'); const te = document.getElementById('fishing-target'); targetStart = 50 + Math.random() * 250; te.style.left = targetStart + 'px'; te.style.display = 'block'; document.getElementById('fishing-cursor').style.left = '0px'; let count = 3; cd.innerText = `준비... ${count}`; const itv = setInterval(() => { count--; if (count > 0) cd.innerText = `준비... ${count}`; else { clearInterval(itv); cd.innerText = "!! START !!"; isQTEActive = true; fishPos = 0; fishSpeed = 4 + (caughtCount * 0.8); } }, 850); }
function updateFishing() { if (!isQTEActive) return; fishPos += fishSpeed; if (fishPos > 390) { failFish(); return; } document.getElementById('fishing-cursor').style.left = fishPos + 'px'; }
function catchFish() { if (gameState !== 'fishing' || !isQTEActive) return; if (fishPos >= targetStart && fishPos <= targetStart + TARGET_WIDTH) { caughtCount++; if (caughtCount >= 3) { alert("성공!"); completeMission('fish'); closeMinigame(); } else { alert("잡았다!"); startWaitingForBite(); } } else { failFish(); } }
function failFish() { isQTEActive = false; alert("놓쳤다!"); startWaitingForBite(); }

// --- 퀴즈 ---
const QUIZ_DATA = [{q:"교장선생님 성함은 김대중이다?", a:false}, {q:"교목은 동백이다?", a:true}, {q:"1980년 개교?", a:false}, {q:"교가 산이름 신학산?", a:true}, {q:"축제이름 청란제?", a:false}, {q:"운동부 펜싱?", a:true}];
let quizIndex = 0; let currentQuestions = [];
function initQuiz() { gameState = 'quiz'; quizIndex = 0; currentQuestions = [...QUIZ_DATA].sort(() => 0.5 - Math.random()).slice(0, 3); document.getElementById('quiz-game').style.display = 'block'; showQuizQuestion(); }
function showQuizQuestion() { document.getElementById('quiz-progress').innerText = `문제 ${quizIndex + 1} / 3`; document.getElementById('quiz-question').innerText = currentQuestions[quizIndex].q; document.getElementById('quiz-feedback').innerText = ""; }
function answerQuiz(ans) { const f = document.getElementById('quiz-feedback'); if (currentQuestions[quizIndex].a === ans) { f.innerText = "⭕ 정답!"; f.style.color = "green"; setTimeout(() => { quizIndex++; if (quizIndex >= 3) { f.innerText = "🎉 성공!"; setTimeout(() => { completeMission('quiz'); closeMinigame(); }, 1000); } else showQuizQuestion(); }, 1000); } else { f.innerText = "❌ 땡!"; f.style.color = "red"; setTimeout(() => { alert("다시!"); closeMinigame(); }, 1000); } }

// --- 유틸 ---
function completeMission(type) { missions[type] = true; document.getElementById(`badge-${type}`).classList.add('mission-complete'); }
function closeMinigame() { document.querySelectorAll('.ui-panel').forEach(el => el.style.display = 'none'); gameState = 'roaming'; }
function restartGame() { location.reload(); }
window.onload = function() { const scale = Math.min(window.innerWidth / 800, window.innerHeight / 600); document.getElementById('game-wrapper').style.transform = `scale(${scale * 0.95})`; };