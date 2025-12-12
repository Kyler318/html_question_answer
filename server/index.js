const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();

// 允許跨域連線
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

// 輔助函式：產生不重複的 4 位數房間號
function generateRoomId() {
    let id;
    do {
        // 產生 1000 ~ 9999 之間的亂數
        id = Math.floor(1000 + Math.random() * 9000).toString();
    } while (rooms[id]); // 如果已存在，就重跑迴圈
    return id;
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
            roundAnswers: {},   // 記錄該回合誰回答了
            roundTimer: null    // 伺服器端倒數計時器
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

        // 通知房間所有人更新列表
        io.to(roomId).emit('updateRoom', rooms[roomId]);
    }

    // --- 3. 玩家準備 ---
    socket.on('playerReady', (roomId) => {
        if (!rooms[roomId]) return;
        rooms[roomId].readyStatus[socket.id] = true;
        io.to(roomId).emit('updateRoom', rooms[roomId]);

        // 檢查是否所有人都準備好了
        const allReady = rooms[roomId].players.every(p => rooms[roomId].readyStatus[p.id]);
        
        // 至少兩人才能開始 (或是 1v1 模式下等到兩人)
        if (allReady && rooms[roomId].players.length > 1) { 
            rooms[roomId].isPlaying = true;
            io.to(roomId).emit('gameStart');
            startRound(roomId);
        }
    });

    // --- 4. 提交答案 (回合制邏輯) ---
    socket.on('submitAnswer', ({ roomId, answerIndex }) => {
        const room = rooms[roomId];
        if (!room || !room.isPlaying) return;

        // 記錄答案 (暫不計分)
        room.roundAnswers[socket.id] = answerIndex;

        // 檢查是否「所有人」都回答了
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
                // 移除玩家
                room.players.splice(playerIndex, 1);
                delete room.readyStatus[socket.id];
                delete room.scores[socket.id];
                delete room.roundAnswers[socket.id]; // 移除答案記錄
                
                if (room.players.length === 0) {
                    // 房間空了，刪除房間
                    if (room.roundTimer) clearTimeout(room.roundTimer);
                    delete rooms[roomId];
                    console.log(`Room ${roomId} deleted.`);
                } else {
                    // 通知剩餘玩家
                    io.to(roomId).emit('updateRoom', room);
                    // 如果遊戲中有人斷線，可能會觸發提早結算(視需求而定，這裡暫不處理)
                }
                break;
            }
        }
    });
});

// --- 遊戲流程控制函式 ---

function startRound(roomId) {
    const room = rooms[roomId];
    if (!room) return;

    // 1. 隨機選題
    const randomQ = questions[Math.floor(Math.random() * questions.length)];
    room.currentQuestion = randomQ;
    room.roundAnswers = {}; // 清空上一題答案

    // 2. 發送題目
    io.to(roomId).emit('newQuestion', randomQ);

    // 3. 設定強制結算計時器 (15秒)
    if (room.roundTimer) clearTimeout(room.roundTimer);
    room.roundTimer = setTimeout(() => {
        finishRound(roomId);
    }, 15000);
}

function finishRound(roomId) {
    const room = rooms[roomId];
    if (!room) return;

    if (room.roundTimer) clearTimeout(room.roundTimer);

    const correctIndex = room.currentQuestion.correct;

    // 計算分數
    room.players.forEach(player => {
        const ans = room.roundAnswers[player.id];
        if (ans !== undefined && ans === correctIndex) {
            room.scores[player.id] += 100;
        }
    });

    // 發送結果
    io.to(roomId).emit('roundResult', {
        scores: room.scores,
        correctAnswer: correctIndex
    });

    // 4秒後下一題或結束
    setTimeout(() => {
        if (!rooms[roomId]) return; // 防止房間已刪除
        
        const isGameOver = Object.values(room.scores).some(score => score >= 500); // 500分獲勝
        if (isGameOver) {
            io.to(roomId).emit('gameOver', room.scores);
            room.isPlaying = false;
        } else {
            startRound(roomId);
        }
    }, 4000);
}

// 題庫
const questions = [
    { id: 1, category: 'HTML', question: '哪個標籤用於定義超連結？', options: ['<link>', '<a>', '<href>', '<url>'], correct: 1 },
    { id: 2, category: 'CSS', question: '如何改變文字顏色？', options: ['font-color', 'text-color', 'color', 'background'], correct: 2 },
    { id: 3, category: 'JS', question: 'console.log 輸出在哪？', options: ['瀏覽器視窗', '控制台', '伺服器日誌', '資料庫'], correct: 1 },
    { id: 4, category: 'CSS', question: 'Flexbox 的主軸對齊是？', options: ['align-items', 'justify-content', 'flex-direction', 'gap'], correct: 1 },
    { id: 5, category: 'HTML', question: '最大的標題標籤是？', options: ['<h1>', '<h6>', '<header>', '<head>'], correct: 0 },
];

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`SERVER RUNNING ON PORT ${PORT}`);
});