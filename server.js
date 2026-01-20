const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

// 創建 Express 應用程式
const app = express();
const PORT = process.env.PORT || 3000;

// ========== 調試信息 ==========
console.log('🚀 === 伺服器啟動 ===');
console.log('📁 當前目錄:', __dirname);
console.log('📄 檔案列表:', fs.readdirSync(__dirname));
console.log('⚙️  環境變數 NODE_ENV:', process.env.NODE_ENV);
console.log('🔌 端口:', PORT);
console.log('========================');

// ========== MongoDB 連接 ==========
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/typing-game';

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => {
  console.log('✅ MongoDB 連接成功');
  console.log('  數據庫:', mongoose.connection.name);
  console.log('  主機:', mongoose.connection.host);
})
.catch(err => {
  console.error('❌ MongoDB 連接失敗:', err.message);
  console.log('⚠️  使用內存存儲模式');
});

// ========== 數據模型 ==========
const scoreSchema = new mongoose.Schema({
  name: { type: String, required: true },
  time: { type: Number, required: true },
  accuracy: { type: Number, default: 100 },
  date: { type: Date, default: Date.now }
});

const Score = mongoose.models.Score || mongoose.model('Score', scoreSchema);

// ========== 中間件 ==========
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// 請求日誌（用於調試）
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// ========== 路由定義 ==========

// 1. 根路徑 - 主頁
app.get('/', (req, res) => {
  const indexPath = path.join(__dirname, 'index.html');
  if (fs.existsSync(indexPath)) {
    console.log('✅ 提供主頁:', indexPath);
    res.sendFile(indexPath);
  } else {
    console.error('❌ 找不到 index.html');
    res.status(404).json({ 
      error: '找不到主頁',
      currentDir: __dirname,
      files: fs.readdirSync(__dirname),
      timestamp: new Date().toISOString()
    });
  }
});

// 2. 遊戲頁面
app.get('/game', (req, res) => {
  const gamePath = path.join(__dirname, 'game.html');
  if (fs.existsSync(gamePath)) {
    console.log('✅ 提供遊戲頁面:', gamePath);
    res.sendFile(gamePath);
  } else {
    console.error('❌ 找不到 game.html');
    res.status(404).json({ 
      error: '找不到遊戲頁面',
      timestamp: new Date().toISOString()
    });
  }
});

// 3. 健康檢查
app.get('/health', (req, res) => {
  console.log('✅ 健康檢查通過');
  res.json({ 
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
    memoryUsage: process.memoryUsage(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// 4. API 狀態
app.get('/api/status', (req, res) => {
  console.log('✅ API 狀態檢查');
  res.json({ 
    status: 'ok',
    message: 'Keyboard Challenge API is running!',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    endpoints: [
      '/ - 主頁',
      '/game - 遊戲頁面',
      '/health - 健康檢查',
      '/api/status - API 狀態',
      '/api/leaderboard - 排行榜',
      '/api/score - 提交分數 (POST)'
    ]
  });
});

// 5. 內存存儲的排行榜（備用）
let memoryLeaderboard = [];

// 6. 提交分數
app.post('/api/score', async (req, res) => {
  try {
    console.log('📝 收到分數提交:', req.body);
    
    const { name, time, accuracy } = req.body;
    
    if (!name || !time) {
      console.log('❌ 缺少必要參數');
      return res.status(400).json({ 
        error: '缺少必要參數',
        required: ['name', 'time'],
        received: req.body
      });
    }
    
    // 如果 MongoDB 已連接，使用 MongoDB
    if (mongoose.connection.readyState === 1) {
      const scoreData = new Score({
        name: name.substring(0, 20),
        time: parseFloat(time),
        accuracy: accuracy || 100
      });
      
      const savedScore = await scoreData.save();
      console.log('✅ 分數已保存到 MongoDB:', savedScore._id);
      
      return res.status(201).json({
        success: true,
        message: '分數已保存到數據庫',
        data: savedScore,
        storage: 'mongodb',
        timestamp: new Date().toISOString()
      });
    }
    
    // 否則使用內存存儲
    const scoreData = {
      id: Date.now(),
      name: name.substring(0, 20),
      time: parseFloat(time),
      accuracy: accuracy || 100,
      date: new Date().toISOString()
    };
    
    memoryLeaderboard.push(scoreData);
    memoryLeaderboard.sort((a, b) => a.time - b.time);
    
    if (memoryLeaderboard.length > 50) {
      memoryLeaderboard = memoryLeaderboard.slice(0, 50);
    }
    
    console.log('✅ 分數已記錄到內存:', scoreData);
    
    res.status(201).json({
      success: true,
      message: '分數已記錄（內存存儲，重啟後會丟失）',
      data: scoreData,
      storage: 'memory',
      rank: memoryLeaderboard.findIndex(s => s.id === scoreData.id) + 1,
      totalPlayers: memoryLeaderboard.length
    });
    
  } catch (error) {
    console.error('❌ 提交分數錯誤:', error);
    res.status(500).json({ 
      error: '提交分數失敗',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// 7. 排行榜
app.get('/api/leaderboard', async (req, res) => {
  try {
    console.log('📊 獲取排行榜');
    
    // 如果 MongoDB 已連接，從 MongoDB 獲取
    if (mongoose.connection.readyState === 1) {
      const scores = await Score.find()
        .sort({ time: 1 }) // 按時間升序（最快在前）
        .limit(20); // 只取前20名
      
      return res.json({
        leaderboard: scores,
        count: await Score.countDocuments(),
        timestamp: new Date().toISOString(),
        storage: 'mongodb',
        message: scores.length === 0 ? '暫無紀錄，成為第一個挑戰者！' : '排行榜加載成功'
      });
    }
    
    // 否則使用內存存儲
    res.json({
      leaderboard: memoryLeaderboard.slice(0, 20),
      count: memoryLeaderboard.length,
      timestamp: new Date().toISOString(),
      storage: 'memory',
      message: memoryLeaderboard.length === 0 ? '暫無紀錄，成為第一個挑戰者！' : '排行榜加載成功'
    });
    
  } catch (error) {
    console.error('❌ 獲取排行榜錯誤:', error);
    res.status(500).json({ 
      error: '獲取排行榜失敗',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// 8. 清空排行榜（僅用於測試）
app.delete('/api/leaderboard', async (req, res) => {
  try {
    console.log('🧹 清空排行榜');
    
    // 如果 MongoDB 已連接，清空 MongoDB
    if (mongoose.connection.readyState === 1) {
      await Score.deleteMany({});
      return res.json({ 
        success: true, 
        message: 'MongoDB 排行榜已清空',
        storage: 'mongodb',
        timestamp: new Date().toISOString()
      });
    }
    
    // 否則清空內存存儲
    memoryLeaderboard = [];
    res.json({ 
      success: true, 
      message: '內存排行榜已清空',
      storage: 'memory',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ 清空排行榜錯誤:', error);
    res.status(500).json({ 
      error: '清空排行榜失敗',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// ========== 錯誤處理 ==========

// 404 錯誤處理
app.use((req, res) => {
  console.log(`❌ 404 錯誤: ${req.method} ${req.url}`);
  res.status(404).json({ 
    error: '找不到頁面',
    path: req.url,
    method: req.method,
    timestamp: new Date().toISOString(),
    availableEndpoints: [
      'GET /',
      'GET /game', 
      'GET /health',
      'GET /api/status',
      'GET /api/leaderboard',
      'POST /api/score'
    ]
  });
});

// 全局錯誤處理
app.use((err, req, res, next) => {
  console.error('🔥 伺服器錯誤:', err);
  res.status(500).json({ 
    error: '伺服器錯誤',
    message: err.message,
    timestamp: new Date().toISOString(),
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack
  });
});

// ========== 啟動伺服器 ==========
app.listen(PORT, () => {
  console.log(`
🎉 =================================
✅ 伺服器啟動成功！
📍 端口: ${PORT}
📁 目錄: ${__dirname}
🕒 時間: ${new Date().toISOString()}
🗄️  MongoDB: ${mongoose.connection.readyState === 1 ? '已連接 ✓' : '未連接 ✗'}
🌐 本地: http://localhost:${PORT}
📡 健康檢查: http://localhost:${PORT}/health
🎮 遊戲入口: http://localhost:${PORT}/
=================================
  `);
});

module.exports = app;