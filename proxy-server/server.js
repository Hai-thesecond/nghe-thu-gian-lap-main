const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");

const app = express();
app.use(cors());
app.use(express.json());

// API keys cho từng chức năng
const TRANSLATION_API_KEY = process.env.HUGGINGFACE_API_KEY || "YOUR_API_KEY";
const POS_TAGGING_API_KEY = process.env.HUGGINGFACE_POS_API_KEY || TRANSLATION_API_KEY;

// Model paths
const TRANSLATION_MODEL = "facebook/nllb-200-distilled-600M";
const POS_TAGGING_MODEL = "vblagoje/bert-english-uncased-finetuned-pos";

// Dictionary từ vựng cơ bản để giảm số lượng API calls
const translations = {
  "water": "nước",
  "built": "xây dựng",
  "turbine": "tuabin",
  "rivers": "sông ngòi",
  "generator": "máy phát điện",
  "explain": "giải thích",
  "needed": "cần thiết",
  "because": "bởi vì",
  "reservoir": "hồ chứa",
  "hydroelectric": "thủy điện",
  "produces": "tạo ra",
  "engineering": "kỹ thuật",
  "construction": "xây dựng",
  "natural": "tự nhiên",
  "different": "khác nhau",
  "mountain": "núi",
  "between": "giữa",
  "through": "thông qua",
  "valley": "thung lũng",
  "station": "trạm", 
  "control": "điều khiển",
  "electricity": "điện",
  "dams": "đập",
  "large": "lớn",
  "small": "nhỏ",
  "pressure": "áp suất",
  "power": "năng lượng",
  "stored": "được lưu trữ",
  "supply": "cung cấp",
  "place": "địa điểm",
  "create": "tạo ra",
  "there": "ở đó",
  "seconds": "giây",
  "conversation": "cuộc trò chuyện",
  "interesting": "thú vị",
  "historic": "lịch sử",
  "time": "thời gian",
  "hello": "xin chào",
  "book": "sách",
  "computer": "máy tính",
  "study": "học tập",
  "school": "trường học",
  "student": "học sinh"
};

// Từ điển từ loại thông dụng (giảm API calls)
const commonPos = {
  "hello": "interjection",
  "book": "noun",
  "run": "verb",
  "happy": "adjective",
  "quickly": "adverb",
  "in": "preposition",
  "and": "conjunction",
  "terminate": "verb",
  "computer": "noun",
  "beautiful": "adjective",
  "study": "verb",
  "dog": "noun",
  "cat": "noun",
  "walk": "verb",
  "fast": "adverb"
};

// Map POS tags to Vietnamese
const posTagsMap = {
  "ADJ": "adjective", // Tính từ
  "ADP": "preposition", // Giới từ
  "ADV": "adverb", // Trạng từ
  "AUX": "auxiliary", // Trợ động từ
  "CCONJ": "conjunction", // Liên từ
  "DET": "determiner", // Từ hạn định
  "INTJ": "interjection", // Thán từ
  "NOUN": "noun", // Danh từ
  "NUM": "numeral", // Số từ
  "PART": "particle", // Tiểu từ
  "PRON": "pronoun", // Đại từ
  "PROPN": "proper_noun", // Danh từ riêng
  "PUNCT": "punctuation", // Dấu câu
  "SCONJ": "subordinating_conjunction", // Liên từ phụ thuộc
  "SYM": "symbol", // Ký hiệu
  "VERB": "verb", // Động từ
  "X": "other" // Khác
};

// Hàm lấy từ loại từ API hoặc cache
async function getPosTag(word) {
  // Kiểm tra từ điển cache trước
  if (commonPos[word.toLowerCase()]) {
    return {
      partOfSpeech: commonPos[word.toLowerCase()],
      confidence: 0.95,
      source: "cached_database"
    };
  }
  
  try {
    console.log(`Calling POS tagging API for "${word}"`);
    
    const response = await fetch(`https://api-inference.huggingface.co/models/${POS_TAGGING_MODEL}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${POS_TAGGING_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        inputs: word
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`POS API error: ${errorText}`);
      return { 
        partOfSpeech: "noun", 
        confidence: 0.7,
        source: "fallback",
        note: "API call failed, using fallback POS" 
      };
    }
    
    const data = await response.json();
    console.log("POS API response:", JSON.stringify(data));
    
    // Process the first result (most significant token)
    let pos = "noun"; // Default fallback
    let confidence = 0.7;
    let source = "huggingface_api";
    
    if (Array.isArray(data)) {
      // Format 1: [{"entity_group":"ADJ","score":0.99,"word":"local","start":0,"end":5}]
      if (data.length > 0 && data[0].entity_group) {
        const firstToken = data[0];
        const tag = firstToken.entity_group;
        pos = posTagsMap[tag] || tag.toLowerCase();
        confidence = firstToken.score || 0.9;
      } 
      // Format 2: [[{"entity":"NOUN","word":"dog",..}]]
      else if (data.length > 0 && data[0].length > 0 && data[0][0].entity) {
        const firstToken = data[0][0];
        const tag = firstToken.entity;
        pos = posTagsMap[tag] || tag.toLowerCase();
        confidence = 0.9;
      }
    }
    
    console.log(`POS result for "${word}": ${pos} (confidence: ${confidence})`);
    
    return {
      partOfSpeech: pos,
      confidence: confidence,
      source: source
    };
  } catch (error) {
    console.error("POS tagging error:", error);
    return { 
      partOfSpeech: "noun", 
      confidence: 0.7,
      source: "error_fallback" 
    };
  }
}

// Root endpoint
app.get("/", (req, res) => {
  res.json({ 
    status: "online", 
    message: "Translation proxy server is running", 
    endpoints: [
      "/translate?word=hello&target=vi",
      "/pos?word=hello",
      "/api/translate (POST)",
      "/api/pos-tag (POST)",
      "/api/status"
    ]
  });
});

// GET endpoint for /translate - browser-friendly version
app.get("/translate", async (req, res) => {
  try {
    const word = req.query.word;
    const target = req.query.target || 'vi';
    const source = req.query.source || 'en';
    
    // Kiểm tra tham số
    if (!word) {
      return res.status(400).json({ error: 'Missing word parameter' });
    }
    
    console.log(`[${new Date().toISOString()}] Browser translate request: "${word}" from ${source} to ${target}`);
    
    // Lấy từ loại trước khi dịch (song song với dịch)
    const posTagPromise = getPosTag(word);
    
    // Kiểm tra từ điển cache
    if (translations[word.toLowerCase()]) {
      console.log(`Cache hit for: ${word}`);
      const posTagResult = await posTagPromise;
      
      return res.json({
        original: word,
        translated: translations[word.toLowerCase()],
        partOfSpeech: posTagResult.partOfSpeech,
        confidence: 0.95,
        source: source,
        target: target
      });
    }
    
    // Không có trong cache, gọi Hugging Face API
    // Convert target format to NLLB format
    const src_lang = source === 'en' ? 'eng_Latn' : 'vie_Latn';
    const tgt_lang = target === 'vi' ? 'vie_Latn' : 'eng_Latn';
    
    console.log(`Calling Hugging Face API for "${word}" (${src_lang} to ${tgt_lang})`);
    
    const response = await fetch(`https://api-inference.huggingface.co/models/${TRANSLATION_MODEL}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TRANSLATION_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        inputs: word,
        parameters: { src_lang, tgt_lang }
      })
    });
    
    // Đợi kết quả từ loại (đã gọi song song với API dịch)
    const posTagResult = await posTagPromise;
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API error: ${errorText}`);
      
      // Fallback to safe response if API fails
      return res.json({
        original: word,
        translated: target === 'vi' ? `[${word} - bản dịch tiếng Việt]` : `[${word} - English translation]`,
        partOfSpeech: posTagResult.partOfSpeech,
        confidence: 0.8,
        source: source,
        target: target,
        note: "API call failed, using fallback translation"
      });
    }
    
    const data = await response.json();
    console.log("API response:", JSON.stringify(data));
    
    // Xử lý kết quả
    let translation = "";
    if (Array.isArray(data) && data.length > 0) {
      translation = data[0].translation_text || data[0].generated_text;
    } else if (data.translation_text) {
      translation = data.translation_text;
    } else if (data.generated_text) {
      translation = data.generated_text;
    } else {
      translation = `[${word}]`;
    }
    
    console.log(`Translated "${word}" to "${translation}"`);
    
    res.json({
      original: word,
      translated: translation,
      partOfSpeech: posTagResult.partOfSpeech,
      confidence: 0.9,
      source: source,
      target: target
    });
    
  } catch (error) {
    console.error("Browser translation error:", error);
    res.status(500).json({ 
      error: error.message || "Translation service error", 
      original: req.query.word,
      translated: req.query.word, // Return original word as fallback
      partOfSpeech: "noun" // Default fallback
    });
  }
});

app.post("/api/translate", async (req, res) => {
  try {
    const { text, src_lang = "eng_Latn", tgt_lang = "vie_Latn" } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: "Text is required" });
    }
    
    console.log(`[${new Date().toISOString()}] Translating: "${text}"`);
    
    // Kiểm tra từ điển trước
    if (translations[text.toLowerCase()]) {
      console.log(`Cache hit for: ${text}`);
      return res.json({ translation: translations[text.toLowerCase()] });
    }
    
    // Gọi API Hugging Face
    const response = await fetch(`https://api-inference.huggingface.co/models/${TRANSLATION_MODEL}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TRANSLATION_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        inputs: text,
        parameters: { src_lang, tgt_lang }
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error (${response.status}): ${errorText}`);
    }
    
    const data = await response.json();
    console.log("API response:", JSON.stringify(data));
    
    // Xử lý kết quả
    let translation = "";
    if (Array.isArray(data) && data.length > 0) {
      translation = data[0].translation_text || data[0].generated_text;
    } else if (data.translation_text) {
      translation = data.translation_text;
    } else if (data.generated_text) {
      translation = data.generated_text;
    } else {
      translation = `Không thể dịch: ${text}`;
    }
    
    console.log(`Translated "${text}" to "${translation}"`);
    res.json({ translation });
  } catch (error) {
    console.error("Translation error:", error);
    res.status(500).json({ error: error.message || "Không thể dịch, vui lòng thử lại sau" });
  }
});

// GET endpoint for POS tagging
app.get("/pos", async (req, res) => {
  try {
    const word = req.query.word;
    
    if (!word) {
      return res.status(400).json({ error: "Word parameter is required" });
    }
    
    console.log(`[${new Date().toISOString()}] Browser POS tagging request for: "${word}"`);
    
    const posTagResult = await getPosTag(word);
    
    res.json({
      word: word,
      ...posTagResult
    });
    
  } catch (error) {
    console.error("Browser POS tagging error:", error);
    res.status(500).json({ 
      error: error.message || "POS tagging service error", 
      word: req.query.word,
      partOfSpeech: "noun" // Default fallback
    });
  }
});

// Endpoint mới để xác định từ loại (POS tagging)
app.post("/api/pos-tag", async (req, res) => {
  try {
    const { word } = req.body;
    
    if (!word) {
      return res.status(400).json({ error: "Word is required" });
    }
    
    console.log(`[${new Date().toISOString()}] POS tagging for: "${word}"`);
    
    // Gọi API Hugging Face với model bert-english-uncased-finetuned-pos
    const response = await fetch(`https://api-inference.huggingface.co/models/${POS_TAGGING_MODEL}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${POS_TAGGING_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        inputs: word
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error (${response.status}): ${errorText}`);
    }
    
    const data = await response.json();
    console.log("POS API response:", JSON.stringify(data));
    
    // Xử lý kết quả
    let results = [];
    if (Array.isArray(data) && data.length > 0) {
      // Lấy từng token và tag
      results = data[0].map(item => {
        const tag = item.entity;
        const token = item.word;
        // Map từ tag sang tên đầy đủ
        const posType = posTagsMap[tag] || tag.toLowerCase();
        
        return {
          token,
          tag,
          pos_type: posType
        };
      });
    }
    
    console.log(`POS tagging results for "${word}":`, results);
    res.json({ word, results });
  } catch (error) {
    console.error("POS tagging error:", error);
    res.status(500).json({ error: error.message || "Không thể xác định từ loại, vui lòng thử lại sau" });
  }
});

// API status endpoint
app.get("/api/status", (req, res) => {
  res.json({ 
    status: "ok", 
    message: "Translation proxy server is running",
    translation_model: TRANSLATION_MODEL,
    pos_tagging_model: POS_TAGGING_MODEL
  });
});

// Endpoint để thêm từ vựng mới với chức năng tự động lấy từ loại
app.post("/api/add-vocabulary", async (req, res) => {
  try {
    const { word, translation } = req.body;
    
    if (!word) {
      return res.status(400).json({ error: "Word is required" });
    }
    
    console.log(`[${new Date().toISOString()}] Adding vocabulary: "${word}"`);
    
    // Lấy từ loại tự động bằng cách gọi hàm getPosTag
    const posTagResult = await getPosTag(word);
    
    // Thêm từ vào từ điển cache nếu có dịch định sẵn
    if (translation) {
      translations[word.toLowerCase()] = translation;
      console.log(`Added "${word}" with translation "${translation}" to dictionary`);
    }
    
    // Thêm từ loại vào từ điển cache nếu độ tin cậy cao
    if (posTagResult.confidence > 0.8) {
      commonPos[word.toLowerCase()] = posTagResult.partOfSpeech;
      console.log(`Added "${word}" with POS "${posTagResult.partOfSpeech}" to POS dictionary`);
    }
    
    // Trả về kết quả đầy đủ
    res.json({
      success: true,
      word,
      translation: translation || (translations[word.toLowerCase()] || ""),
      partOfSpeech: posTagResult.partOfSpeech,
      confidence: posTagResult.confidence,
      source: posTagResult.source
    });
    
  } catch (error) {
    console.error("Add vocabulary error:", error);
    res.status(500).json({ 
      error: error.message || "Error adding vocabulary", 
      success: false
    });
  }
});

// Endpoint mới cho việc tra cứu từ vựng (dịch + từ loại cùng lúc)
app.get("/api/vocabulary-lookup", async (req, res) => {
  try {
    const word = req.query.word;
    const target = req.query.target || 'vi';
    const source = req.query.source || 'en';
    
    if (!word) {
      return res.status(400).json({ error: "Word parameter is required" });
    }
    
    console.log(`[${new Date().toISOString()}] Vocabulary lookup for: "${word}"`);
    
    // Gọi song song cả 2 API dịch và từ loại để tối ưu thời gian
    const posTagPromise = getPosTag(word);
    let translationPromise;
    
    // Kiểm tra từ điển cache cho bản dịch
    let translatedWord = null;
    if (translations[word.toLowerCase()]) {
      console.log(`Translation cache hit for: ${word}`);
      translatedWord = translations[word.toLowerCase()];
      translationPromise = Promise.resolve(translatedWord);
    } else {
      // Không có trong cache, gọi API dịch
      const src_lang = source === 'en' ? 'eng_Latn' : 'vie_Latn';
      const tgt_lang = target === 'vi' ? 'vie_Latn' : 'eng_Latn';
      
      console.log(`Calling translation API for "${word}" (${src_lang} to ${tgt_lang})`);
      
      translationPromise = fetch(`https://api-inference.huggingface.co/models/${TRANSLATION_MODEL}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${TRANSLATION_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          inputs: word,
          parameters: { src_lang, tgt_lang }
        })
      })
      .then(async response => {
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Translation API error: ${errorText}`);
          return target === 'vi' ? `[${word}]` : word;
        }
        
        const data = await response.json();
        console.log("Translation API response:", JSON.stringify(data));
        
        // Xử lý kết quả dịch
        let translation = "";
        if (Array.isArray(data) && data.length > 0) {
          translation = data[0].translation_text || data[0].generated_text;
        } else if (data.translation_text) {
          translation = data.translation_text;
        } else if (data.generated_text) {
          translation = data.generated_text;
        } else {
          translation = `[${word}]`;
        }
        
        console.log(`Translated "${word}" to "${translation}"`);
        return translation;
      })
      .catch(error => {
        console.error("Translation error:", error);
        return `[${word}]`;
      });
    }
    
    // Đợi kết quả từ cả hai API
    const [posTagResult, translation] = await Promise.all([posTagPromise, translationPromise]);
    
    // Thêm vào cache nếu cần
    if (!translations[word.toLowerCase()] && translation && translation !== `[${word}]`) {
      translations[word.toLowerCase()] = translation;
      console.log(`Added "${word}" with translation "${translation}" to dictionary cache`);
    }
    
    if (posTagResult.confidence > 0.8 && !commonPos[word.toLowerCase()]) {
      commonPos[word.toLowerCase()] = posTagResult.partOfSpeech;
      console.log(`Added "${word}" with POS "${posTagResult.partOfSpeech}" to POS dictionary cache`);
    }
    
    // Trả về kết quả đầy đủ
    res.json({
      success: true,
      word,
      original: word,
      translated: translation,
      translation,
      partOfSpeech: posTagResult.partOfSpeech,
      confidence: posTagResult.confidence,
      source: source,
      target: target,
      pos_source: posTagResult.source,
      definition: translation // Thêm definition cho tương thích với UI
    });
    
  } catch (error) {
    console.error("Vocabulary lookup error:", error);
    res.status(500).json({ 
      error: error.message || "Error looking up vocabulary", 
      success: false 
    });
  }
});

// TÍCH HỢP SUPABASE - PROXY: API này sẽ tự động gọi xác định từ loại cho các từ được thêm từ Supabase
app.post("/api/supabase-vocabulary-integration", async (req, res) => {
  try {
    // Nhận danh sách từ vựng từ Supabase
    const { words, updateSupabase = false, supabaseUrl = null, supabaseKey = null } = req.body;
    
    if (!words || !Array.isArray(words) || words.length === 0) {
      return res.status(400).json({ 
        error: "Cần cung cấp danh sách từ vựng hợp lệ", 
        success: false 
      });
    }
    
    console.log(`[${new Date().toISOString()}] Supabase vocabulary integration - Processing ${words.length} words`);
    
    // Xử lý từng từ trong danh sách
    const results = [];
    
    for (const wordItem of words) {
      const { word, translation, id } = wordItem;
      
      if (!word) continue; // Bỏ qua từ không hợp lệ
      
      // Gọi API xác định từ loại
      const posTagResult = await getPosTag(word);
      
      console.log(`Processed "${word}" - POS: ${posTagResult.partOfSpeech} (confidence: ${posTagResult.confidence})`);
      
      // Thêm vào cache
      if (posTagResult.confidence > 0.8 && !commonPos[word.toLowerCase()]) {
        commonPos[word.toLowerCase()] = posTagResult.partOfSpeech;
      }
      
      if (translation && !translations[word.toLowerCase()]) {
        translations[word.toLowerCase()] = translation;
      }
      
      // Tạo kết quả
      const result = {
        id,
        word,
        translation: translation || translations[word.toLowerCase()] || "",
        partOfSpeech: posTagResult.partOfSpeech,
        confidence: posTagResult.confidence,
        source: "en",
        target: "vi",
        pos_source: posTagResult.source
      };
      
      results.push(result);
      
      // Nếu cần update Supabase (tương lai)
      if (updateSupabase && supabaseUrl && supabaseKey) {
        try {
          // Code để update Supabase sẽ được thêm ở đây nếu cần
          console.log(`Would update Supabase for word: ${word} with POS: ${posTagResult.partOfSpeech}`);
        } catch (error) {
          console.error(`Error updating Supabase for word: ${word}`, error);
        }
      }
    }
    
    // Phản hồi với kết quả
    res.json({
      success: true,
      total: results.length,
      results
    });
    
  } catch (error) {
    console.error("Supabase vocabulary integration error:", error);
    res.status(500).json({ 
      error: error.message || "Lỗi xử lý từ vựng từ Supabase", 
      success: false 
    });
  }
});

// Endpoint để bắt trực tiếp khi người dùng thêm từ vựng mới trong giao diện
app.post("/api/intercept-new-vocabulary", async (req, res) => {
  try {
    const { words } = req.body;
    
    if (!words || !Array.isArray(words)) {
      return res.status(400).json({ 
        error: "Cần cung cấp danh sách từ vựng hợp lệ", 
        success: false 
      });
    }
    
    console.log(`[${new Date().toISOString()}] Intercepting new vocabulary - Processing ${words.length} words`);
    
    // Xử lý từng từ
    const results = [];
    
    for (const word of words) {
      if (!word) continue;
      
      // Gọi API xác định từ loại
      console.log(`Getting POS for intercepted word: "${word}"`);
      const posTagResult = await getPosTag(word);
      
      // Lưu vào cache
      if (posTagResult.confidence > 0.8) {
        commonPos[word.toLowerCase()] = posTagResult.partOfSpeech;
        console.log(`Added intercepted word "${word}" with POS "${posTagResult.partOfSpeech}" to dictionary`);
      }
      
      results.push({
        word,
        partOfSpeech: posTagResult.partOfSpeech,
        confidence: posTagResult.confidence
      });
    }
    
    res.json({
      success: true,
      results
    });
    
  } catch (error) {
    console.error("Vocabulary interception error:", error);
    res.status(500).json({ 
      error: error.message, 
      success: false 
    });
  }
});

// Endpoint để lấy từ loại cho danh sách từ vựng có sẵn
app.post("/api/batch-pos-tagging", async (req, res) => {
  try {
    const { words } = req.body;
    
    if (!words || !Array.isArray(words)) {
      return res.status(400).json({ 
        error: "Missing words array", 
        success: false 
      });
    }
    
    console.log(`[${new Date().toISOString()}] Batch POS tagging for ${words.length} words`);
    
    // Xử lý từng từ trong danh sách
    const results = {};
    const promises = [];
    
    for (const word of words) {
      if (!word) continue;
      
      // Nếu đã có trong cache thì dùng luôn
      if (commonPos[word.toLowerCase()]) {
        results[word] = {
          partOfSpeech: commonPos[word.toLowerCase()],
          confidence: 0.95,
          source: "cache"
        };
      } else {
        // Gọi API xác định từ loại
        promises.push(
          getPosTag(word).then(posTagResult => {
            results[word] = posTagResult;
            
            // Lưu vào cache nếu độ tin cậy cao
            if (posTagResult.confidence > 0.8) {
              commonPos[word.toLowerCase()] = posTagResult.partOfSpeech;
            }
            
            return { word, ...posTagResult };
          })
        );
      }
    }
    
    // Đợi tất cả các API calls hoàn thành
    await Promise.all(promises);
    
    res.json({
      success: true,
      results
    });
    
  } catch (error) {
    console.error("Batch POS tagging error:", error);
    res.status(500).json({ 
      error: error.message || "Error processing batch POS tagging", 
      success: false 
    });
  }
});

// API đơn giản để gọi trực tiếp từ browser console cho testing
app.get("/api/get-pos", async (req, res) => {
  try {
    const word = req.query.word;
    
    if (!word) {
      return res.status(400).json({ error: "Word parameter is required" });
    }
    
    const result = await getPosTag(word);
    res.json({
      word,
      ...result
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Webhook để nhận thông báo khi từ vựng được thêm/cập nhật trong Supabase
app.post("/api/vocabulary-webhook", async (req, res) => {
  try {
    const { type, record, table } = req.body;
    
    // Chỉ xử lý sự kiện từ bảng vocabulary_items
    if (table !== "vocabulary_items") {
      return res.status(200).json({ success: true, message: "Not a vocabulary event" });
    }
    
    console.log(`[${new Date().toISOString()}] Vocabulary webhook - ${type} event for ${record?.word || 'unknown word'}`);
    
    // Xử lý sự kiện INSERT hoặc UPDATE
    if ((type === "INSERT" || type === "UPDATE") && record && record.word) {
      const word = record.word;
      
      // Gọi API xác định từ loại nếu không có part_of_speech hoặc nó là giá trị mặc định "noun"
      if (!record.part_of_speech || record.part_of_speech === "noun") {
        const posTagResult = await getPosTag(word);
        
        console.log(`Auto-determined POS for "${word}": ${posTagResult.partOfSpeech} (confidence: ${posTagResult.confidence})`);
        
        // Lưu vào local cache
        if (posTagResult.confidence > 0.8) {
          commonPos[word.toLowerCase()] = posTagResult.partOfSpeech;
        }
        
        // Lưu translation vào cache nếu có
        if (record.meaning_vi) {
          translations[word.toLowerCase()] = record.meaning_vi;
        }
        
        // Ở đây bạn có thể gọi API cập nhật lại từ vựng trên Supabase nếu cần
      }
    }
    
    res.status(200).json({ success: true });
    
  } catch (error) {
    console.error("Vocabulary webhook error:", error);
    res.status(200).json({ success: false, error: error.message }); 
    // Trả về 200 dù có lỗi để Supabase không retry webhook
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Translation proxy server running on port ${PORT}`)); 