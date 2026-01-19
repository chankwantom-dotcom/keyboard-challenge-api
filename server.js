const express = require('express');
const cors = require('cors');
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// 中間件
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// MongoDB 連接
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/typing-game';

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('✅ MongoDB 連接成功'))
.catch(err => {
  console.error('❌ MongoDB 連接失敗:', err);
  console.log('⚠️  使用內存存儲模式');
});

// 分數模型
const scoreSchema = new mongoose.Schema({
  name: { type: String, required: true },
  time: { type: Number, required: true },
  accuracy: { type: Number, default: 100 },
  date: { type: Date, default: Date.now }
});

const Score = mongoose.models.Score || mongoose.model('Score', scoreSchema);

// 路由
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/game', (req, res) => {
  res.sendFile(path.join(__dirname, 'game.html'));
});

// API 狀態
app.get('/api/status', async (req, res) => {
  try {
    const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    res.json({ 
      status: 'ok',
      message: 'Keyboard Challenge API is running!',
      database: dbStatus,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// 提交分數
app.post('/api/score', async (req, res) => {
  try {
    const { name, time, accuracy } = req.body;
    
    if (!name || !time) {
      return res.status(400).json({ error: '缺少必要參數' });
    }
    
    const score = new Score({
      name,
      time: parseFloat(time),
      accuracy: accuracy || 100,
      date: new Date()
    });
    
    await score.save();
    
    res.status(201).json({
      success: true,
      message: '分數已記錄',
      data: score
    });
  } catch (error) {
    console.error('提交分數錯誤:', error);
    res.status(500).json({ error: '提交分數失敗' });
  }
});

// 排行榜
app.get('/api/leaderboard', async (req, res) => {
  try {
    // 檢查 MongoDB 是否連接
    if (mongoose.connection.readyState !== 1) {
      return res.json({
        leaderboard: [],
        count: 0,
        message: '使用內存模式，重啟後數據會丟失'
      });
    }
    
    const leaderboard = await Score.find()
      .sort({ time: 1 }) // 按時間升序（最快在前）
      .limit(50); // 只取前50名
    
    res.json({
      leaderboard,
      count: leaderboard.length
    });
  } catch (error) {
    console.error('獲取排行榜錯誤:', error);
    res.status(500).json({ error: '獲取排行榜失敗' });
  }
});

// 清空排行榜（僅用於測試）
app.delete('/api/leaderboard', async (req, res) => {
  try {
    await Score.deleteMany({});
    res.json({ success: true, message: '排行榜已清空' });
  } catch (error) {
    res.status(500).json({ error: '清空排行榜失敗' });
  }
});

// 錯誤處理
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: '伺服器錯誤' });
});

// 404處理
app.use((req, res) => {
  res.status(404).json({ error: '找不到頁面' });
});

// 啟動伺服器
app.listen(PORT, () => {
  console.log(`🚀 伺服器啟動成功！`);
  console.log(`📊 本地訪問: http://localhost:${PORT}`);
  console.log(`🎮 遊戲入口: http://localhost:${PORT}/`);
  console.log(`🎯 遊戲頁面: http://localhost:${PORT}/game`);
  console.log(`📡 API狀態: http://localhost:${PORT}/api/status`);
  console.log(`🗄️  MongoDB: ${mongoose.connection.readyState === 1 ? '已連接' : '未連接'}`);
});