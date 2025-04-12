const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());

// Endpoint dịch hiện tại
app.post('/api/translate', async (req, res) => {
  // Code hiện tại...
});

// Thêm endpoint mới để xác định từ loại
app.post('/api/pos', async (req, res) => {
  try {
    const { word } = req.body;
    if (!word) {
      return res.status(400).json({ error: 'Missing word parameter' });
    }
    
    // Cách 1: Gọi đến Dictionary API
    const response = await axios.get(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
    
    if (response.data && response.data.length > 0 && response.data[0].meanings && response.data[0].meanings.length > 0) {
      const pos = response.data[0].meanings[0].partOfSpeech;
      return res.json({ partOfSpeech: pos });
    } else {
      // Fallback khi không tìm thấy
      return res.json({ partOfSpeech: determineDefaultPOS(word) });
    }
  } catch (error) {
    console.error('Error determining part of speech:', error);
    // Trả về POS mặc định nếu có lỗi
    return res.json({ partOfSpeech: determineDefaultPOS(req.body.word) });
  }
});

// Hàm xác định POS mặc định (chỉ một số quy tắc đơn giản)
function determineDefaultPOS(word) {
  if (!word) return 'noun';
  
  word = word.toLowerCase();
  
  if (word.endsWith('ly')) return 'adverb';
  if (word.endsWith('ment') || word.endsWith('tion') || word.endsWith('ness')) return 'noun';
  if (word.endsWith('ful') || word.endsWith('ous') || word.endsWith('able')) return 'adjective';
  
  // Mặc định là noun
  return 'noun';
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Proxy server running on port ${PORT}`);
}); 