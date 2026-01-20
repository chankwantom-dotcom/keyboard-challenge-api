const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// ========== 調試信息 ==========
console.log('🚀 === 伺服器啟動 ===');
console.log('📁 當前目錄:', __dirname);
console.log('📄 檔案列表:', fs.readdirSync(__dirname));
console.log('⚙️  環境變數 NODE_ENV:', process.env.NODE_ENV);
console.log('🔌 端口:', PORT);
console.log('========================');

// 中間件
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

// 3. 健康檢查 - 這個必須有！
app.get('/health', (req, res) => {
  console.log('✅ 健康檢查通過');
  res.json({ 
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
    memoryUsage: process.memoryUsage()
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

// 5. 內存存儲的排行榜
let leaderboard = [];

// 6. 提交分數
app.post('/api/score', (req, res) => {
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
    
    const scoreData = {
      id: Date.now(),
      name: name.substring(0, 20),
      time: parseFloat(time),
      accuracy: accuracy || 100,
      date: new Date().toISOString()
    };
    
    leaderboard.push(scoreData);
    leaderboard.sort((a, b) => a.time - b.time);
    
    if (leaderboard.length > 50) {
      leaderboard = leaderboard.slice(0, 50);
    }
    
    console.log('✅ 分數已記錄:', scoreData);
    
    res.status(201).json({
      success: true,
      message: '分數已記錄',
      data: scoreData,
      rank: leaderboard.findIndex(s => s.id === scoreData.id) + 1,
      totalPlayers: leaderboard.length
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
app.get('/api/leaderboard', (req, res) => {
  console.log('📊 獲取排行榜');
  res.json({
    leaderboard: leaderboard.slice(0, 20),
    count: leaderboard.length,
    timestamp: new Date().toISOString(),
    message: leaderboard.length === 0 ? '暫無紀錄，成為第一個挑戰者！' : '排行榜加載成功'
  });
});

// 8. 清空排行榜（僅用於測試）
app.delete('/api/leaderboard', (req, res) => {
  console.log('🧹 清空排行榜');
  leaderboard = [];
  res.json({ 
    success: true, 
    message: '排行榜已清空',
    timestamp: new Date().toISOString()
  });
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
🌐 本地: http://localhost:${PORT}
📡 健康檢查: http://localhost:${PORT}/health
🎮 遊戲入口: http://localhost:${PORT}/
=================================
  `);
});

module.exports = app;