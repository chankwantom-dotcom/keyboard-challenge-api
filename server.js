const mongoose = require('mongoose');

// MongoDB 連接字符串 - 從環境變數獲取
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/typing-game';

// 連接 MongoDB
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => {
  console.log('✅ MongoDB 連接成功');
  console.log('  數據庫:', mongoose.connection.name);
  console.log('  主機:', mongoose.connection.host);
  console.log('  端口:', mongoose.connection.port);
})
.catch(err => {
  console.error('❌ MongoDB 連接失敗:', err.message);
  console.log('⚠️  使用內存存儲模式');
});

// 定義數據模型
const scoreSchema = new mongoose.Schema({
  name: { type: String, required: true },
  time: { type: Number, required: true },
  accuracy: { type: Number, default: 100 },
  date: { type: Date, default: Date.now }
});

const Score = mongoose.model('Score', scoreSchema);

// 提交分數的 API
app.post('/api/score', async (req, res) => {
  try {
    const { name, time, accuracy } = req.body;
    
    // 創建新分數記錄
    const score = new Score({
      name: name.substring(0, 20),
      time: parseFloat(time),
      accuracy: accuracy || 100
    });
    
    // 保存到 MongoDB
    const savedScore = await score.save();
    
    console.log('✅ 分數已保存到 MongoDB:', savedScore._id);
    
    res.status(201).json({
      success: true,
      message: '分數已保存',
      data: savedScore
    });
    
  } catch (error) {
    console.error('❌ MongoDB 保存錯誤:', error);
    res.status(500).json({ error: '保存分數失敗' });
  }
});