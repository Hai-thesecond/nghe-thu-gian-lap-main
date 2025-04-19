/**
 * Test file cho việc gọi và xử lý API Gemini
 * Hướng dẫn chạy test:
 * 1. Đảm bảo file .env đã có VITE_GEMINI_API_KEY
 * 2. Chạy lệnh: npm test -- src/tests/geminiApi.test.ts
 */
// Explicitly load .env file when running in Node
try {
  // @ts-ignore - dynamic import
  import('dotenv').then(dotenv => {
    console.log("Loaded dotenv, configuring with path:", process.cwd());
    dotenv.config();
  }).catch(err => {
    console.log("Could not load dotenv:", err.message);
  });
} catch (error) {
  console.log("Import error:", error);
}

interface VocabularyItem {
  id: string;
  word: string;
  part_of_speech: string;
  meaning_vi: string;
  audio_start_time: number;
  audio_end_time: number;
  image_url?: string | null;
  definition?: string;
  example?: string;
  synonyms?: string;
  antonyms?: string;
}

/**
 * Hàm gọi API Gemini để lấy danh sách từ vựng
 */
async function callGeminiAPI(scriptText: string): Promise<VocabularyItem[]> {
  try {
    console.log("Calling Gemini API for vocabulary generation");
    
    // Đảm bảo API key đã được cung cấp - support both Node and Vite environments
    let apiKey = process.env.VITE_GEMINI_API_KEY || 
                (typeof import.meta !== 'undefined' ? import.meta.env.VITE_GEMINI_API_KEY : undefined);
    
    // For testing purposes, use the hardcoded API key from .env if environment variable is not available
    if (!apiKey) {
      console.log("API key not found in environment variables, using hardcoded key for testing");
      apiKey = "AIzaSyDAccfiiTQuhjoI9NTHS5uCgmJi2cKxwwo"; // This should be replaced with a proper env variable in production
    }
    
    if (!apiKey) {
      throw new Error("VITE_GEMINI_API_KEY không được cung cấp trong file .env");
    }
    
    // Format the prompt for Gemini
    const prompt = `
Từ ngữ cảnh sau: ${scriptText}
Hãy lọc ra cho tôi 10 cụm từ collocations có nghĩa và cho tôi nghĩa tiếng việt, từ loại, nghĩa tiếng anh (ngắn gọn), ví dụ (câu đơn giản), từ đồng nghĩa, từ trái nghĩa của các từ hoặc cụm từ dưới đây trong ngữ cảnh.
`;

    // Make the API call to Gemini
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }]
          }]
        })
      }
    );

    if (!response.ok) {
      console.error("Error from Gemini API:", response.statusText);
      throw new Error(`Gemini API error: ${response.statusText}`);
    }

    const data = await response.json();
    console.log("Gemini API response:", data);

    // Extract the text response
    const responseText = data.contents?.[0]?.parts?.[0]?.text;
    
    // Log more details about the response structure
    console.log("Response structure:", {
      hasContents: !!data.contents,
      contentsLength: data.contents?.length,
      hasCandidate: !!data.candidates?.[0],
      candidateContent: data.candidates?.[0]?.content
    });
    
    let extractedText = '';
    
    // Try to extract text from different possible response structures
    if (responseText) {
      extractedText = responseText;
    } else if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
      extractedText = data.candidates[0].content.parts[0].text;
    } else if (data.candidates?.[0]?.content?.text) {
      extractedText = data.candidates[0].content.text;
    }
    
    console.log("Extracted text:", extractedText ? extractedText.substring(0, 100) + "..." : "No text extracted");
    
    if (!extractedText) {
      throw new Error("No response text from Gemini API");
    }
    
    // Parse the response to extract vocabulary items
    const vocabularyItems = parseGeminiResponse(extractedText);
    return vocabularyItems;
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    throw error;
  }
}

/**
 * Hàm phân tích kết quả từ API Gemini
 */
function parseGeminiResponse(responseText: string): VocabularyItem[] {
  try {
    const items: VocabularyItem[] = [];
    
    // Split the response by numbered items
    const itemRegex = /\d+\.\s+(.*?)(?=\d+\.|$)/gs;
    const matches = responseText.matchAll(itemRegex);
    
    for (const match of matches) {
      const content = match[1].trim();
      
      // Extract word/phrase
      const wordMatch = content.match(/^([^:]+?):/);
      if (!wordMatch) continue;
      
      const word = wordMatch[1].trim();
      
      // Extract Vietnamese meaning
      const viMeaningMatch = content.match(/Nghĩa tiếng Việt:\s*(.*?)(?=Từ loại:|$)/s);
      const meaningVi = viMeaningMatch ? viMeaningMatch[1].trim() : "";
      
      // Extract part of speech
      const posMatch = content.match(/Từ loại:\s*(.*?)(?=Nghĩa tiếng Anh:|$)/s);
      const partOfSpeech = posMatch ? posMatch[1].trim() : "noun";
      
      // Extract English definition
      const enDefMatch = content.match(/Nghĩa tiếng Anh:\s*(.*?)(?=Ví dụ:|$)/s);
      const definition = enDefMatch ? enDefMatch[1].trim() : "";
      
      // Extract example
      const exampleMatch = content.match(/Ví dụ:\s*(.*?)(?=Từ đồng nghĩa:|$)/s);
      const example = exampleMatch ? exampleMatch[1].trim() : "";
      
      // Extract synonyms
      const synonymsMatch = content.match(/Từ đồng nghĩa:\s*(.*?)(?=Từ trái nghĩa:|$)/s);
      const synonyms = synonymsMatch ? synonymsMatch[1].trim() : "";
      
      // Extract antonyms
      const antonymsMatch = content.match(/Từ trái nghĩa:\s*(.*?)$/s);
      const antonyms = antonymsMatch ? antonymsMatch[1].trim() : "";
      
      // Create vocabulary item with all extracted information
      const vocabItem: VocabularyItem = {
        id: crypto.randomUUID(),
        word,
        part_of_speech: partOfSpeech,
        meaning_vi: meaningVi,
        audio_start_time: 0,
        audio_end_time: 0,
        image_url: null,
        definition,
        example,
        synonyms,
        antonyms
      };
      
      items.push(vocabItem);
    }
    
    return items;
  } catch (error) {
    console.error("Error parsing Gemini response:", error);
    return [];
  }
}

/**
 * Test thủ công - hàm gọi API Gemini và kiểm tra kết quả
 */
async function testGeminiAPI() {
  try {
    const sampleScript = `There was a time when I was unsure about participating in an English speaking contest at my high school. At first, I hesitated because I didn't feel confident in my English skills and was worried about making mistakes in front of my classmates and teachers. However, after thinking it over, I decided to take part because I believed it was a great opportunity to overcome my fear and improve my language abilities.`;
    
    console.log("Bắt đầu test gọi API Gemini với script mẫu...");
    console.log("-".repeat(60));
    console.log("Script mẫu:", sampleScript);
    console.log("-".repeat(60));
    
    const startTime = Date.now();
    
    try {
      const result = await callGeminiAPI(sampleScript);
      const endTime = Date.now();
      
      console.log("-".repeat(60));
      console.log(`Đã nhận ${result.length} từ vựng sau ${(endTime - startTime) / 1000}s`);
      console.log("-".repeat(60));
      
      // Hiển thị kết quả
      result.forEach((item, index) => {
        console.log(`${index + 1}. ${item.word} (${item.part_of_speech})`);
        console.log(`   - Nghĩa tiếng Việt: ${item.meaning_vi}`);
        if (item.definition) console.log(`   - Nghĩa tiếng Anh: ${item.definition}`);
        if (item.example) console.log(`   - Ví dụ: ${item.example}`);
        if (item.synonyms) console.log(`   - Từ đồng nghĩa: ${item.synonyms}`);
        if (item.antonyms) console.log(`   - Từ trái nghĩa: ${item.antonyms}`);
        console.log();
      });
      
      // Kiểm tra kết quả
      if (result.length === 0) {
        console.error("❌ TEST FAILED: Không nhận được từ vựng nào");
        return false;
      }
      
      const hasAllFields = result.every(item => 
        item.word && 
        item.part_of_speech && 
        item.meaning_vi
      );
      
      if (!hasAllFields) {
        console.error("❌ TEST FAILED: Một số từ vựng thiếu thông tin cơ bản");
        return false;
      }
      
      console.log("✅ TEST PASSED: Đã nhận được danh sách từ vựng đầy đủ");
      return true;
    } catch (callError) {
      console.error("❌ ERROR CALLING API:", callError);
      if (callError.response) {
        console.error("API Response Error:", callError.response);
      }
      return false;
    }
  } catch (error) {
    console.error("❌ TEST FAILED:", error);
    return false;
  }
}

/**
 * Chạy test nếu được gọi trực tiếp
 */
// ESM & CommonJS compatible module loading detection
const isMainModule = typeof require !== 'undefined' 
  ? require.main === module 
  : import.meta.url.endsWith('geminiApi.test.ts');

console.log("Module check:", { isMainModule });

if (isMainModule) {
  console.log("Starting test execution...");
  console.log("Environment check:", {
    NODE_ENV: process.env.NODE_ENV,
    VITE_GEMINI_API_KEY: process.env.VITE_GEMINI_API_KEY ? "Present" : "Missing"
  });

  testGeminiAPI()
    .then(success => {
      console.log("Test completed with result:", success);
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error("Test failed with error:", error);
      process.exit(1);
    });
} else {
  console.log("Module imported, not running test automatically.");
}

export { callGeminiAPI, parseGeminiResponse, testGeminiAPI }; 