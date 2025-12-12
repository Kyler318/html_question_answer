// server/index.js

// ... 前面的 code 不變 ...

io.on('connection', (socket) => {
    console.log('User Connected:', socket.id);

    // 加入房間
    socket.on('joinRoom', ({ mode, playerName, photoURL }) => {
        let roomId = null;
        
        // 找房間邏輯... (維持原本)
        for (let id in rooms) {
            if (rooms[id].mode === mode && rooms[id].players.length < mode && !rooms[id].isPlaying) {
                roomId = id;
                break;
            }
        }

        if (!roomId) {
            roomId = Math.random().toString(36).substring(7);
            rooms[roomId] = {
                id: roomId,
                mode: mode,
                players: [],
                readyStatus: {},
                scores: {},
                isPlaying: false,
                currentQuestion: null,
                roundAnswers: {},   // ✨ 新增：記錄這一題誰答了
                roundTimer: null    // ✨ 新增：記錄計時器
            };
        }

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
    });

    // 玩家準備 (維持原本)
    socket.on('playerReady', (roomId) => {
        if (!rooms[roomId]) return;
        rooms[roomId].readyStatus[socket.id] = true;
        io.to(roomId).emit('updateRoom', rooms[roomId]);

        const allReady = rooms[roomId].players.every(p => rooms[roomId].readyStatus[p.id]);
        if (allReady && rooms[roomId].players.length > 1) {
            rooms[roomId].isPlaying = true;
            io.to(roomId).emit('gameStart');
            startRound(roomId); // 改名函式
        }
    });

    // ✨✨✨ 重點修改：提交答案 ✨✨✨
    socket.on('submitAnswer', ({ roomId, answerIndex }) => {
        const room = rooms[roomId];
        if (!room || !room.isPlaying) return;

        // 1. 記錄這個玩家的答案 (先不計分，只記錄)
        room.roundAnswers[socket.id] = answerIndex;

        // 2. 檢查是否「所有玩家」都回答了
        const totalPlayers = room.players.length;
        const answeredCount = Object.keys(room.roundAnswers).length;

        // 如果大家都回答了，立刻結算
        if (answeredCount === totalPlayers) {
            finishRound(roomId);
        }
    });

    socket.on('disconnect', () => {
        // ... 斷線處理 (建議加上清除 Timer 邏輯)
    });
});

// ✨✨✨ 新增：開始新的一回合 ✨✨✨
function startRound(roomId) {
    const room = rooms[roomId];
    if (!room) return;

    // 1. 隨機選題
    const randomQ = questions[Math.floor(Math.random() * questions.length)];
    room.currentQuestion = randomQ;
    room.roundAnswers = {}; // 清空上一題答案

    // 2. 發送題目給前端
    io.to(roomId).emit('newQuestion', randomQ);

    // 3. 設定伺服器計時器 (例如 12 秒後強制結算)
    // 稍微比前端倒數久一點點 (buffer)，以免網路延遲
    if (room.roundTimer) clearTimeout(room.roundTimer);
    
    room.roundTimer = setTimeout(() => {
        finishRound(roomId); // 時間到，強制結算
    }, 12000); // 12秒
}

// ✨✨✨ 新增：結算回合 ✨✨✨
function finishRound(roomId) {
    const room = rooms[roomId];
    if (!room) return;

    // 清除計時器 (避免重複執行)
    if (room.roundTimer) clearTimeout(room.roundTimer);

    const correctIndex = room.currentQuestion.correct;

    // 1. 計算分數
    room.players.forEach(player => {
        const playerAnswer = room.roundAnswers[player.id];
        
        // 如果有回答 且 答對
        if (playerAnswer !== undefined && playerAnswer === correctIndex) {
            room.scores[player.id] += 100;
        }
        // 沒回答或答錯就不加分
    });

    // 2. 發送結果給前端 (包含正確答案、所有人的新分數)
    io.to(roomId).emit('roundResult', {
        scores: room.scores,
        correctAnswer: correctIndex,
        playerAnswers: room.roundAnswers // (選擇性) 可以傳給前端顯示誰選了什麼
    });

    // 3. 等待幾秒後，進入下一題 或 結束遊戲
    setTimeout(() => {
        // 檢查是否有人達到獲勝分數 (例如 500)
        const isGameOver = Object.values(room.scores).some(score => score >= 500);

        if (isGameOver) {
            io.to(roomId).emit('gameOver', room.scores);
            room.isPlaying = false;
        } else {
            startRound(roomId); // 下一題
        }
    }, 4000); // 4秒展示結果時間
}

// 題目資料 (維持原本)
const questions = [
    { id: 1, category: 'HTML', question: '哪個標籤用於定義超連結？', options: ['<link>', '<a>', '<href>', '<url>'], correct: 1 },
    { id: 2, category: 'CSS', question: '如何改變文字顏色？', options: ['font-color', 'text-color', 'color', 'background'], correct: 2 },
    { id: 3, category: 'JS', question: 'console.log 輸出在哪裡？', options: ['瀏覽器視窗', '控制台', '伺服器日誌', '資料庫'], correct: 1 },
];

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`SERVER RUNNING ON PORT ${PORT}`);
});