const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const questions = require('./data/questions.json');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

let rooms = {};
const QUESTION_DURATION = 10000; // 10秒作答
const REVEAL_DURATION = 3000;    // 3秒揭曉答案時間

io.on('connection', (socket) => {
  // 1. 加入房間
  socket.on('joinRoom', ({ mode, playerName }) => {
    let roomId = findAvailableRoom(mode);
    socket.join(roomId);

    if (!rooms[roomId]) {
      rooms[roomId] = {
        id: roomId,
        mode: mode,
        players: [],
        scores: {},
        readyStatus: {},
        status: 'waiting',
        currentQuestionIndex: 0,
        questionStartTime: 0,
        playerAnswers: {}, // 新增：紀錄本回合誰回答了
        timer: null        // 新增：計時器ID
      };
    }

    rooms[roomId].players.push({ id: socket.id, name: playerName });
    rooms[roomId].scores[socket.id] = 0;
    rooms[roomId].readyStatus[socket.id] = false;

    io.to(roomId).emit('updateRoom', rooms[roomId]);
  });

  // 2. 玩家準備
  socket.on('playerReady', (roomId) => {
    if (!rooms[roomId]) return;
    rooms[roomId].readyStatus[socket.id] = true;
    io.to(roomId).emit('updateRoom', rooms[roomId]);

    const allReady = rooms[roomId].players.every(p => rooms[roomId].readyStatus[p.id]);
    if (rooms[roomId].players.length === rooms[roomId].mode && allReady) {
      startGame(roomId);
    }
  });

  // 3. 提交答案 (只紀錄，不廣播結果)
  socket.on('submitAnswer', ({ roomId, answerIndex }) => {
    const room = rooms[roomId];
    if (!room || room.status !== 'playing') return;

    // 防止重複回答
    if (room.playerAnswers[socket.id] !== undefined) return;

    // 紀錄答案與時間
    const timeTaken = Date.now() - room.questionStartTime;
    room.playerAnswers[socket.id] = {
      index: answerIndex,
      time: timeTaken
    };

    // 檢查是否所有人都回答了
    const answeredCount = Object.keys(room.playerAnswers).length;
    if (answeredCount === room.players.length) {
      clearTimeout(room.timer); // 提早結束倒數
      endRound(roomId);         // 進入結算
    }
  });

  socket.on('disconnect', () => { /* 斷線邏輯略 */ });
});

function findAvailableRoom(mode) {
  for (let id in rooms) {
    if (rooms[id].mode === mode && rooms[id].players.length < mode && rooms[id].status === 'waiting') {
      return id;
    }
  }
  return 'room_' + Math.random().toString(36).substr(2, 9);
}

function startGame(roomId) {
  const room = rooms[roomId];
  room.status = 'playing';
  io.to(roomId).emit('gameStart');
  nextQuestion(roomId);
}

function nextQuestion(roomId) {
  const room = rooms[roomId];
  if (!room) return;

  if (room.currentQuestionIndex >= questions.length) {
    io.to(roomId).emit('gameOver', room.scores);
    delete rooms[roomId];
    return;
  }

  // 重置回合數據
  room.playerAnswers = {};
  room.questionStartTime = Date.now();

  const questionData = { ...questions[room.currentQuestionIndex] };
  delete questionData.answer; // 隱藏答案
  
  io.to(roomId).emit('newQuestion', questionData);

  // 設定計時器：時間到強制結算
  room.timer = setTimeout(() => {
    endRound(roomId);
  }, QUESTION_DURATION);
}

function endRound(roomId) {
  const room = rooms[roomId];
  if (!room) return;

  const currentQ = questions[room.currentQuestionIndex];
  
  // 計算分數
  for (let playerId in room.playerAnswers) {
    const { index, time } = room.playerAnswers[playerId];
    if (index === currentQ.answer) {
      const timeLeft = Math.max(0, QUESTION_DURATION - time);
      const speedRatio = timeLeft / QUESTION_DURATION;
      let points = Math.floor(speedRatio * 1000);
      if (points < 100) points = 100;
      room.scores[playerId] += points;
    }
  }

  // 廣播結果 (正確答案 + 最新分數)
  io.to(roomId).emit('roundResult', {
    correctAnswer: currentQ.answer,
    scores: room.scores
  });

  // 休息一下，進入下一題
  room.currentQuestionIndex++;
  setTimeout(() => {
    nextQuestion(roomId);
  }, REVEAL_DURATION);
}

server.listen(3000, () => console.log('Server *:3000'));