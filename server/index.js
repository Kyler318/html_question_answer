const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors({ origin: "*", methods: ["GET", "POST"] }));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST"] } });

const rooms = {};

// 1. 載入所有題庫
const questionBanks = {
    microbit: [],
    python: [],
    html: [],
    brain: []
};

// 輔助載入函式
function loadQuestions(filename, key) {
    try {
        const filePath = path.join(__dirname, 'data', filename);
        const data = fs.readFileSync(filePath, 'utf8');
        questionBanks[key] = JSON.parse(data);
        console.log(`✅ 載入 ${key} 題庫: ${questionBanks[key].length} 題`);
    } catch (err) {
        console.error(`❌ 載入 ${key} 失敗:`, err.message);
        // 預設空題目防止崩潰
        questionBanks[key] = [{ id: 0, category: 'ERROR', question: '題庫載入失敗', options: ['A','B','C','D'], answer: 0 }];
    }
}

// 執行載入
loadQuestions('microbit.json', 'microbit');
loadQuestions('python.json', 'python');
loadQuestions('html.json', 'html');
loadQuestions('brain.json', 'brain');

function generateRoomId() {
    let id;
    do { id = Math.floor(1000 + Math.random() * 9000).toString(); } while (rooms[id]); 
    return id;
}

function calculateScore(totalTimeSeconds, elapsedMs) {
    const totalMs = totalTimeSeconds * 1000;
    const remaining = Math.max(0, totalMs - elapsedMs);
    return Math.ceil((remaining / totalMs) * 1000);
}

io.on('connection', (socket) => {
    console.log('User Connected:', socket.id);

    // 2. 創建房間 (新增 subject 參數)
    socket.on('createRoom', ({ mode, subject, playerName, photoURL }) => {
        const roomId = generateRoomId();

        // 檢查科目是否存在，預設 html
        const validSubject = questionBanks[subject] ? subject : 'html';

        rooms[roomId] = {
            id: roomId,
            mode: mode,
            subject: validSubject, // 綁定科目
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

    socket.on('joinRoom', ({ roomId, playerName, photoURL }) => {
        const room = rooms[roomId];
        if (!room) { socket.emit('errorMsg', '錯誤：房間不存在'); return; }
        if (room.players.length >= room.mode) { socket.emit('errorMsg', '錯誤：房間已滿'); return; }
        if (room.isPlaying) { socket.emit('errorMsg', '錯誤：遊戲已開始'); return; }

        joinRoomLogic(socket, room.id, playerName, photoURL);
    });

    function joinRoomLogic(socket, roomId, playerName, photoURL) {
        socket.join(roomId);
        const newPlayer = {
            id: socket.id,
            name: playerName || `Player ${socket.id.substr(0,4)}`,
            photoURL: photoURL || null,
            score: 0
        };
        rooms[roomId].players.push(newPlayer);
        rooms[roomId].scores[socket.id] = 0;
        rooms[roomId].readyStatus[socket.id] = false;

        io.to(roomId).emit('updateRoom', rooms[roomId]);
    }

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

    socket.on('submitAnswer', ({ roomId, answerIndex }) => {
        const room = rooms[roomId];
        if (!room || !room.isPlaying) return;

        // 防止重複回答
        if (room.roundAnswers[socket.id] !== undefined) return;

        room.roundAnswers[socket.id] = answerIndex;
        room.roundSubmissionTimes[socket.id] = Date.now();

        const totalPlayers = room.players.length;
        const answeredCount = Object.keys(room.roundAnswers).length;

        if (answeredCount === totalPlayers) {
            finishRound(roomId);
        }
    });

    socket.on('disconnect', () => {
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
                } else {
                    io.to(roomId).emit('updateRoom', room);
                }
                break;
            }
        }
    });
});

const ROUND_DURATION_SEC = 15; 

function startRound(roomId) {
    const room = rooms[roomId];
    if (!room) return;

    // 3. 根據房間科目出題
    const bank = questionBanks[room.subject];
    const randomQ = bank[Math.floor(Math.random() * bank.length)];
    
    room.currentQuestion = randomQ;
    room.roundAnswers = {}; 
    room.roundSubmissionTimes = {}; 

    io.to(roomId).emit('newQuestion', randomQ);
    room.roundStartTime = Date.now();

    if (room.roundTimer) clearTimeout(room.roundTimer);
    room.roundTimer = setTimeout(() => { finishRound(roomId); }, ROUND_DURATION_SEC * 1000);
}

function finishRound(roomId) {
    const room = rooms[roomId];
    if (!room) return;
    if (room.roundTimer) clearTimeout(room.roundTimer);

    // 4. 修正判定：使用 JSON 中的 "answer" 欄位
    const correctIndex = room.currentQuestion.answer; 

    room.players.forEach(player => {
        const ans = room.roundAnswers[player.id];
        if (ans !== undefined && ans === correctIndex) {
            const submitTime = room.roundSubmissionTimes[player.id] || Date.now();
            const elapsed = submitTime - room.roundStartTime;
            room.scores[player.id] += calculateScore(ROUND_DURATION_SEC, elapsed);
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

server.listen(3000, () => console.log('SERVER RUNNING ON PORT 3000'));