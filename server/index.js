const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
// ✨ 新增：引入 fs 和 path 模組來讀取檔案
const fs = require('fs');
const path = require('path');

const app = express();

app.use(cors({
    origin: "*", 
    methods: ["GET", "POST"]
}));

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// 遊戲房間資料
const rooms = {};

// ✨✨✨ 修改：從 JSON 檔案載入題目 ✨✨✨
let questions = [];
try {
    // 取得 questions.json 的絕對路徑
    const questionsPath = path.join(__dirname, 'data', 'questions.json');
    // 讀取檔案內容
    const data = fs.readFileSync(questionsPath, 'utf8');
    // 將 JSON 字串轉換為 JavaScript 物件
    questions = JSON.parse(data);
    console.log(`✅ 成功載入 ${questions.length} 題題庫！`);
} catch (err) {
    console.error('❌ 載入題庫失敗:', err.message);
    // 如果讀取失敗，提供一個預設題目避免伺服器崩潰
    questions = [
        { id: 0, category: 'ERROR', question: '題庫載入失敗', options: ['A', 'B', 'C', 'D'], correct: 0 }
    ];
}

// 輔助函式：產生不重複的 4 位數房間號
function generateRoomId() {
    let id;
    do {
        id = Math.floor(1000 + Math.random() * 9000).toString();
    } while (rooms[id]); 
    return id;
}

// 輔助函式：計算時間分數
function calculateScore(totalTimeSeconds, elapsedMs) {
    const totalMs = totalTimeSeconds * 1000;
    const remaining = Math.max(0, totalMs - elapsedMs);
    return Math.ceil((remaining / totalMs) * 1000);
}

io.on('connection', (socket) => {
    console.log('User Connected:', socket.id);

    // --- 1. 創建房間 ---
    socket.on('createRoom', ({ mode, playerName, photoURL }) => {
        const roomId = generateRoomId();

        rooms[roomId] = {
            id: roomId,
            mode: mode,
            players: [],
            readyStatus: {},
            scores: {},
            isPlaying: false,
            currentQuestion: null,
            roundAnswers: {},           
            roundStartTime: 0,          
            roundSubmissionTimes: {},   
            roundTimer: null            
        };

        joinRoomLogic(socket, roomId, playerName, photoURL);
    });

    // --- 2. 加入房間 ---
    socket.on('joinRoom', ({ roomId, playerName, photoURL }) => {
        const room = rooms[roomId];

        if (!room) {
            socket.emit('errorMsg', '錯誤：房間不存在 (ROOM NOT FOUND)');
            return;
        }
        if (room.players.length >= room.mode) {
            socket.emit('errorMsg', '錯誤：房間已滿 (ROOM FULL)');
            return;
        }
        if (room.isPlaying) {
            socket.emit('errorMsg', '錯誤：遊戲已開始 (GAME STARTED)');
            return;
        }

        joinRoomLogic(socket, room.id, playerName, photoURL);
    });

    // 共用的加入邏輯
    function joinRoomLogic(socket, roomId, playerName, photoURL) {
        socket.join(roomId);

        const newPlayer = {
            id: socket.id,
            name: playerName || `Player ${socket.id.substr(0, 4)}`,
            photoURL: photoURL || null,
            score: 0
        };

        rooms[roomId].players.push(newPlayer);
        rooms[roomId].scores[socket.id] = 0;
        rooms[roomId].readyStatus[socket.id] = false;

        io.to(roomId).emit('updateRoom', rooms[roomId]);
    }

    // --- 3. 玩家準備 ---
    socket.on('playerReady', (roomId) => {
        if (!rooms[roomId]) return;
        rooms[roomId].readyStatus[socket.id] = true;
        io.to(roomId).emit('updateRoom', rooms[roomId]);

        const allReady = rooms[roomId].players.every(p => rooms[roomId].readyStatus[p.id]);
        
        if (allReady && rooms[roomId].players.length > 1) { 
            rooms[roomId].isPlaying = true;
            io.to(roomId).emit('gameStart');
            startRound(roomId);
        }
    });

    // --- 4. 提交答案 ---
    socket.on('submitAnswer', ({ roomId, answerIndex }) => {
        const room = rooms[roomId];
        if (!room || !room.isPlaying) return;

        room.roundAnswers[socket.id] = answerIndex;

        if (!room.roundSubmissionTimes[socket.id]) {
            room.roundSubmissionTimes[socket.id] = Date.now();
        }

        const totalPlayers = room.players.length;
        const answeredCount = Object.keys(room.roundAnswers).length;

        if (answeredCount === totalPlayers) {
            finishRound(roomId);
        }
    });

    // --- 5. 斷線處理 ---
    socket.on('disconnect', () => {
        console.log('User Disconnected', socket.id);
        
        for (let roomId in rooms) {
            const room = rooms[roomId];
            const playerIndex = room.players.findIndex(p => p.id === socket.id);
            
            if (playerIndex !== -1) {
                room.players.splice(playerIndex, 1);
                delete room.readyStatus[socket.id];
                delete room.scores[socket.id];
                delete room.roundAnswers[socket.id];
                delete room.roundSubmissionTimes[socket.id];
                
                if (room.players.length === 0) {
                    if (room.roundTimer) clearTimeout(room.roundTimer);
                    delete rooms[roomId];
                    console.log(`Room ${roomId} deleted.`);
                } else {
                    io.to(roomId).emit('updateRoom', room);
                }
                break;
            }
        }
    });
});

// --- 遊戲流程控制 ---

const ROUND_DURATION_SEC = 15; 

function startRound(roomId) {
    const room = rooms[roomId];
    if (!room) return;

    // 從載入的 JSON questions 中隨機選題
    const randomQ = questions[Math.floor(Math.random() * questions.length)];
    room.currentQuestion = randomQ;
    
    room.roundAnswers = {}; 
    room.roundSubmissionTimes = {}; 

    io.to(roomId).emit('newQuestion', randomQ);

    room.roundStartTime = Date.now();

    if (room.roundTimer) clearTimeout(room.roundTimer);
    room.roundTimer = setTimeout(() => {
        finishRound(roomId);
    }, ROUND_DURATION_SEC * 1000);
}

function finishRound(roomId) {
    const room = rooms[roomId];
    if (!room) return;

    if (room.roundTimer) clearTimeout(room.roundTimer);

    const correctIndex = room.currentQuestion.correct;

    room.players.forEach(player => {
        const ans = room.roundAnswers[player.id];
        
        if (ans !== undefined && ans === correctIndex) {
            const submitTime = room.roundSubmissionTimes[player.id] || Date.now();
            const elapsed = submitTime - room.roundStartTime;
            const scoreToAdd = calculateScore(ROUND_DURATION_SEC, elapsed);
            room.scores[player.id] += scoreToAdd;
        }
    });

    io.to(roomId).emit('roundResult', {
        scores: room.scores,
        correctAnswer: correctIndex
    });

    setTimeout(() => {
        if (!rooms[roomId]) return; 
        
        const isGameOver = Object.values(room.scores).some(score => score >= 3000); 
        
        if (isGameOver) {
            io.to(roomId).emit('gameOver', room.scores);
            room.isPlaying = false;
        } else {
            startRound(roomId);
        }
    }, 4000);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`SERVER RUNNING ON PORT ${PORT}`);
});