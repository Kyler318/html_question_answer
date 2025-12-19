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

// --- 1. 載入題庫 (保持不變) ---
const questionBanks = {
    microbit: [],
    python: [],
    html: [],
    brain: []
};

function loadQuestions(filename, key) {
    try {
        const filePath = path.join(__dirname, 'data', filename);
        const data = fs.readFileSync(filePath, 'utf8');
        questionBanks[key] = JSON.parse(data);
        console.log(`✅ 載入 ${key} 題庫: ${questionBanks[key].length} 題`);
    } catch (err) {
        console.error(`❌ 載入 ${key} 失敗:`, err.message);
        questionBanks[key] = [{ id: 0, category: 'ERROR', question: '題庫載入失敗', options: ['A','B','C','D'], answer: 0 }];
    }
}

loadQuestions('microbit.json', 'microbit');
loadQuestions('python.json', 'python');
loadQuestions('html.json', 'html');
loadQuestions('brain.json', 'brain');

function generateRoomId() {
    let id;
    do { id = Math.floor(1000 + Math.random() * 9000).toString(); } while (rooms[id]); 
    return id;
}

// --- Socket 連線處理 ---
io.on('connection', (socket) => {
    console.log('User Connected:', socket.id);

    // 2. 創建房間
    socket.on('createRoom', ({ mode, subject, playerName, photoURL }) => {
        const roomId = generateRoomId();
        const validSubject = questionBanks[subject] ? subject : 'html';

        rooms[roomId] = {
            id: roomId,
            mode: mode,
            subject: validSubject,
            players: [],
            readyStatus: {},
            isPlaying: false,
            currentQuestion: null,
            roundAnswers: [], // 改為陣列，儲存詳細答題資訊
            roundStartTime: 0,
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
            hp: 100,      // ✨ 改動：初始 HP
            maxHp: 100
        };
        rooms[roomId].players.push(newPlayer);
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

    // 3. 提交答案 (核心改動)
    socket.on('submitAnswer', ({ roomId, answerIndex }) => {
        const room = rooms[roomId];
        if (!room || !room.isPlaying) return;

        // 防止重複回答
        const existing = room.roundAnswers.find(a => a.playerId === socket.id);
        if (existing) return;

        // 計算答題耗時
        const timeSpent = Date.now() - room.roundStartTime;
        const isCorrect = (answerIndex === room.currentQuestion.answer);

        room.roundAnswers.push({
            playerId: socket.id,
            answerIndex: answerIndex,
            isCorrect: isCorrect,
            timeSpent: timeSpent
        });

        // 檢查是否所有人都回答了
        if (room.roundAnswers.length === room.players.length) {
            finishRound(roomId); // 雙方都答完，結算
        }
    });

    socket.on('disconnect', () => {
        for (let roomId in rooms) {
            const room = rooms[roomId];
            const playerIndex = room.players.findIndex(p => p.id === socket.id);
            if (playerIndex !== -1) {
                room.players.splice(playerIndex, 1);
                delete room.readyStatus[socket.id];
                
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

    // 出題
    const bank = questionBanks[room.subject];
    const randomQ = bank[Math.floor(Math.random() * bank.length)];
    
    room.currentQuestion = randomQ;
    room.roundAnswers = []; // 重置答案
    room.roundStartTime = Date.now();

    io.to(roomId).emit('newQuestion', randomQ);

    if (room.roundTimer) clearTimeout(room.roundTimer);
    // 時間到強制結算 (處理有人沒回答的情況)
    room.roundTimer = setTimeout(() => { finishRound(roomId); }, ROUND_DURATION_SEC * 1000);
}

// 4. 結算回合 (戰鬥邏輯核心)
function finishRound(roomId) {
    const room = rooms[roomId];
    if (!room) return;
    if (room.roundTimer) clearTimeout(room.roundTimer);

    // 根據耗時排序 (快的人在前)
    room.roundAnswers.sort((a, b) => a.timeSpent - b.timeSpent);

    // 處理只有一人回答的情況 (補上未回答者的錯誤記錄)
    room.players.forEach(p => {
        if (!room.roundAnswers.find(a => a.playerId === p.id)) {
            room.roundAnswers.push({
                playerId: p.id,
                isCorrect: false,
                timeSpent: 999999 // 最慢
            });
        }
    });

    // 重新排序確保完整
    room.roundAnswers.sort((a, b) => a.timeSpent - b.timeSpent);

    const p1 = room.roundAnswers[0]; // 較快者 (Attacker candidate)
    const p2 = room.roundAnswers[1]; // 較慢者 (Defender candidate)

    // 戰鬥數值設定
    const BASE_DAMAGE = 20;
    const CHIP_DAMAGE = 5; // 防禦成功時的傷害

    let logMessage = "";
    let damage = 0;
    let victimId = null;

    // --- 戰鬥判定邏輯 ---
    if (p1 && p2) {
        if (p1.isCorrect) {
            // 快者答對 -> 發動攻擊
            victimId = p2.playerId;
            if (p2.isCorrect) {
                // 慢者也答對 -> 防禦成功
                damage = CHIP_DAMAGE;
                logMessage = "防禦成功！傷害減半！";
            } else {
                // 慢者答錯 -> 直接命中
                damage = BASE_DAMAGE;
                logMessage = "攻擊命中！";
            }
        } else if (p2.isCorrect) {
            // 快者答錯，慢者答對 -> 反擊
            victimId = p1.playerId;
            damage = BASE_DAMAGE;
            logMessage = "反擊成功！對手失誤！";
        } else {
            // 兩人都錯
            logMessage = "雙方都錯失了機會...";
        }
    } else {
        // 例外狀況處理
        logMessage = "回合結束";
    }

    // 執行扣血
    if (victimId) {
        const victim = room.players.find(p => p.id === victimId);
        if (victim) {
            victim.hp = Math.max(0, victim.hp - damage);
        }
    }

    // 發送結果
    io.to(roomId).emit('roundResult', {
        players: room.players, // 更新後的血量
        correctAnswer: room.currentQuestion.answer,
        logMessage: logMessage,
        damage: damage,
        victimId: victimId
    });

    // 檢查遊戲結束
    const isGameOver = room.players.some(p => p.hp <= 0);

    setTimeout(() => {
        if (!rooms[roomId]) return; 
        if (isGameOver) {
            io.to(roomId).emit('gameOver', room.players); // 傳送最終狀態
            room.isPlaying = false;
        } else {
            startRound(roomId);
        }
    }, 3000); // 3秒後下一題
}

server.listen(3000, () => console.log('SERVER RUNNING ON PORT 3000'));