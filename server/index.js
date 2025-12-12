const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();

// 1. 設定 CORS：允許任何來源連線 (為了避免部署後網域對不上的問題，先開全權限)
app.use(cors({
    origin: "*", 
    methods: ["GET", "POST"]
}));

const server = http.createServer(app);

// 2. 設定 Socket.io 的 CORS
const io = new Server(server, {
    cors: {
        origin: "*", // 允許任何前端網址連線
        methods: ["GET", "POST"]
    }
});

// 遊戲狀態變數
const rooms = {};

// Socket 連線邏輯
io.on('connection', (socket) => {
    console.log('User Connected:', socket.id);

    // 加入房間邏輯
    socket.on('joinRoom', ({ mode, playerName, photoURL }) => { // 接收 photoURL
        let roomId = null;

        // 尋找是否有缺人的房間
        for (let id in rooms) {
            if (rooms[id].mode === mode && rooms[id].players.length < mode && !rooms[id].isPlaying) {
                roomId = id;
                break;
            }
        }

        // 如果沒房間，建立新房間
        if (!roomId) {
            roomId = Math.random().toString(36).substring(7);
            rooms[roomId] = {
                id: roomId,
                mode: mode,
                players: [],
                readyStatus: {},
                scores: {},
                isPlaying: false
            };
        }

        socket.join(roomId);

        // 加入玩家資訊 (包含頭像)
        const newPlayer = {
            id: socket.id,
            name: playerName || `Player ${socket.id.substr(0, 4)}`,
            photoURL: photoURL || null, // 儲存頭像
            score: 0
        };

        rooms[roomId].players.push(newPlayer);
        rooms[roomId].scores[socket.id] = 0;
        rooms[roomId].readyStatus[socket.id] = false;

        // 廣播房間資訊
        io.to(roomId).emit('updateRoom', rooms[roomId]);
    });

    // 玩家準備
    socket.on('playerReady', (roomId) => {
        if (!rooms[roomId]) return;
        rooms[roomId].readyStatus[socket.id] = true;
        io.to(roomId).emit('updateRoom', rooms[roomId]);

        // 檢查是否所有人都準備好了
        const allReady = rooms[roomId].players.every(p => rooms[roomId].readyStatus[p.id]);
        if (allReady && rooms[roomId].players.length > 1) { // 至少兩人才能開始
            rooms[roomId].isPlaying = true;
            io.to(roomId).emit('gameStart');
            sendNewQuestion(roomId);
        }
    });

    // 提交答案
    socket.on('submitAnswer', ({ roomId, answerIndex }) => {
        if (!rooms[roomId]) return;
        
        // 簡單計分邏輯：答對 +100
        const currentQ = rooms[roomId].currentQuestion;
        if (currentQ && answerIndex === currentQ.correct) {
            rooms[roomId].scores[socket.id] += 100;
        }

        // 這裡可以做更複雜的邏輯，例如大家都答完才下一題
        // 目前範例先簡單回傳結果
        io.to(roomId).emit('roundResult', {
            scores: rooms[roomId].scores,
            correctAnswer: currentQ.correct
        });

        // 延遲 3 秒出下一題
        setTimeout(() => {
            if (rooms[roomId] && rooms[roomId].scores[socket.id] < 500) { // 500分結束
                 sendNewQuestion(roomId);
            } else {
                 io.to(roomId).emit('gameOver', rooms[roomId].scores);
            }
        }, 3000);
    });

    socket.on('disconnect', () => {
        console.log('User Disconnected', socket.id);
        // 清理房間邏輯 (這裡簡化，實際上要移除玩家並通知房間其他人)
    });
});

// 模擬題目
const questions = [
    { id: 1, category: 'HTML', question: '哪個標籤用於定義超連結？', options: ['<link>', '<a>', '<href>', '<url>'], correct: 1 },
    { id: 2, category: 'CSS', question: '如何改變文字顏色？', options: ['font-color', 'text-color', 'color', 'background'], correct: 2 },
    // 你可以增加更多題目
];

function sendNewQuestion(roomId) {
    if (!rooms[roomId]) return;
    const randomQ = questions[Math.floor(Math.random() * questions.length)];
    rooms[roomId].currentQuestion = randomQ;
    io.to(roomId).emit('newQuestion', randomQ);
}

// 3. 【關鍵修改】使用環境變數的 PORT，如果沒有才用 3000
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`SERVER RUNNING ON PORT ${PORT}`);
});