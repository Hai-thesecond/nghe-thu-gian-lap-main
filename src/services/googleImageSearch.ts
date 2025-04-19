import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

// Google Custom Search API configuration
const API_KEY = 'AIzaSyC4b0-iPdwe2bEGjREi0epSJu_0AZqBes8';
const CX = '2560420e828b54d3f';

// Pixabay API key - using environment variable
const PIXABAY_API_KEY = import.meta.env.VITE_PIXABAY_API_KEY || '49637589-79b450cbb07f6605f7037e699'; // Fallback to hardcoded value if env var is missing

// Interface cho kết quả tìm kiếm
export interface GoogleImageResult {
  link: string;
  title: string;
  image: {
    height: number;
    width: number;
  };
  thumbnail: string;
}

// Interface cho ảnh đã lưu
export interface SavedImage {
  id: string;
  vocabulary_id: string;
  image_url: string;
  tags: string;
  created_at: string;
  updated_at: string;
}

// Interface cho kết quả từ Pixabay
interface PixabayImageResult {
  id: number;
  webformatURL: string;
  largeImageURL: string;
  imageWidth: number;
  imageHeight: number;
  previewURL: string;
  tags: string;
  user: string;
}

// Danh sách các từ loại trừ phổ biến để lọc kết quả không liên quan
const COMMON_EXCLUDED_TERMS = [
  'money', 'dollar', 'text', 'currency', 'certificate', 'document', 'advertisement', 'logo',
  'screenshot', 'meme', 'thumbnail', 'chart', 'graph'
];

// Phân loại từ vựng để xác định truy vấn tìm kiếm phù hợp
const getWordCategory = (word: string, partOfSpeech?: string): 'abstractVerb' | 'abstractNoun' | 'adjective' | 'concreteNoun' => {
  // Danh sách các động từ trừu tượng phổ biến
  const abstractVerbs = [
    'depend', 'depends', 'consider', 'believe', 'think', 'assume', 'imagine', 'suppose',
    'understand', 'know', 'realize', 'recognize', 'accept', 'agree', 'disagree', 'decide',
    'determine', 'involve', 'include', 'contain', 'consist', 'mean', 'indicate', 'suggest',
    'imply', 'affect', 'influence', 'develop', 'increase', 'decrease', 'improve', 'enhance'
  ];

  // Danh sách các danh từ trừu tượng phổ biến
  const abstractNouns = [
    'freedom', 'peace', 'justice', 'equality', 'happiness', 'sadness', 'anger', 'fear',
    'love', 'hate', 'knowledge', 'wisdom', 'intelligence', 'creativity', 'innovation',
    'success', 'failure', 'hope', 'despair', 'courage', 'integrity', 'honesty', 'truth',
    'beauty', 'goodness', 'evil', 'life', 'death', 'time', 'space', 'concept', 'idea',
    'theory', 'philosophy', 'religion', 'policy', 'strategy', 'principle', 'value'
  ];

  // Danh sách các tính từ phổ biến
  const adjectives = [
    'beautiful', 'ugly', 'good', 'bad', 'happy', 'sad', 'angry', 'afraid', 'brave',
    'cowardly', 'intelligent', 'stupid', 'creative', 'dull', 'innovative', 'traditional',
    'successful', 'unsuccessful', 'hopeful', 'hopeless', 'courageous', 'fearful', 'honest',
    'dishonest', 'true', 'false', 'alive', 'dead', 'timely', 'untimely', 'conceptual'
  ];

  // Kiểm tra partOfSpeech trước nếu có
  if (partOfSpeech) {
    if (partOfSpeech.toLowerCase().includes('verb')) {
      return 'abstractVerb';
    } else if (partOfSpeech.toLowerCase().includes('adj')) {
      return 'adjective';
    } else if (partOfSpeech.toLowerCase().includes('noun')) {
      return abstractNouns.includes(word.toLowerCase()) ? 'abstractNoun' : 'concreteNoun';
    }
  }
  
  // Kiểm tra từ trong các danh sách nếu không có partOfSpeech
  if (abstractVerbs.includes(word.toLowerCase())) {
    return 'abstractVerb';
  } else if (abstractNouns.includes(word.toLowerCase())) {
    return 'abstractNoun';
  } else if (adjectives.includes(word.toLowerCase())) {
    return 'adjective';
  }
  
  // Mặc định xem như danh từ cụ thể
  return 'concreteNoun';
};

// Tạo truy vấn tìm kiếm đặc biệt dựa trên loại từ
const generateSpecializedSearchQueries = (word: string, category: string, meaning?: string): string[] => {
  const queries: string[] = [];
  const excludedTerms = COMMON_EXCLUDED_TERMS.map(term => `-${term}`).join(' ');
  
  // Truy vấn cơ bản cho tất cả loại từ
  queries.push(`${word} meaning educational illustration ${excludedTerms}`);
  
  if (meaning) {
    // Sử dụng ý nghĩa của từ trong tiếng Việt để làm phong phú thêm truy vấn
    // Lấy 2-3 từ đầu tiên từ nghĩa để tránh truy vấn quá dài
    const meaningWords = meaning.split(' ').slice(0, 3).join(' ');
    queries.push(`${word} ${meaningWords} concept illustration ${excludedTerms}`);
  }
  
  switch (category) {
    case 'abstractVerb':
      queries.push(`"${word}" concept diagram ${excludedTerms}`);
      queries.push(`"${word}" relationship visualization ${excludedTerms}`);
      queries.push(`"${word}" conceptual illustration ${excludedTerms}`);
      queries.push(`"${word}" visual metaphor ${excludedTerms}`);
      queries.push(`"${word}" example illustration ${excludedTerms}`);
      queries.push(`"${word}" on others visualization ${excludedTerms}`);
      break;
      
    case 'abstractNoun':
      queries.push(`"${word}" symbol illustration ${excludedTerms}`);
      queries.push(`"${word}" concept representation ${excludedTerms}`);
      queries.push(`"${word}" visual metaphor ${excludedTerms}`);
      queries.push(`"${word}" icon ${excludedTerms}`);
      queries.push(`"${word}" educational diagram ${excludedTerms}`);
      break;
      
    case 'adjective':
      queries.push(`"${word}" example illustration ${excludedTerms}`);
      queries.push(`"what is ${word}" visual ${excludedTerms}`);
      queries.push(`"${word}" comparison diagram ${excludedTerms}`);
      queries.push(`"${word}" opposite illustration ${excludedTerms}`);
      queries.push(`"${word}" characteristic ${excludedTerms}`);
      break;
      
    case 'concreteNoun':
      queries.push(`"${word}" object photo ${excludedTerms}`);
      queries.push(`"${word}" clipart ${excludedTerms}`);
      queries.push(`"${word}" isolated ${excludedTerms}`);
      queries.push(`"${word}" simple illustration ${excludedTerms}`);
      break;
  }
  
  // Thêm một số truy vấn chung cho tất cả
  queries.push(`"${word}" definition pictogram ${excludedTerms}`);
  queries.push(`"${word}" visual vocabulary ${excludedTerms}`);
  
  return queries;
};

/**
 * Lấy ảnh đã lưu cho một từ vựng
 * @param vocabularyId ID của từ vựng
 * @returns Thông tin ảnh đã lưu hoặc null nếu không tìm thấy
 */
export const getSavedImageForVocabulary = async (vocabularyId: string): Promise<SavedImage | null> => {
  try {
    // Thêm console.log để debug
    console.log(`Fetching saved image for vocabulary_id: ${vocabularyId}`);
    
    const { data, error } = await supabase
      .from('vocabulary_images')
      .select('*')
      .eq('vocabulary_id', vocabularyId)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        // Không tìm thấy ảnh
        console.log(`No saved image found for vocabulary_id: ${vocabularyId}`);
        return null;
      }
      console.error('Error fetching saved image:', error);
      return null;
    }
    
    console.log(`Found saved image for vocabulary_id: ${vocabularyId}`, data);
    return data as SavedImage;
  } catch (error) {
    console.error('Error fetching saved image:', error);
    return null;
  }
};

/**
 * Lưu URL hình ảnh đã chọn cho từ vựng
 */
export const saveImageForVocabulary = async (vocabularyId: string, imageUrl: string, tags?: string): Promise<boolean> => {
  try {
    // Đảm bảo có dữ liệu hợp lệ
    if (!vocabularyId || !imageUrl) {
      console.error('Missing required data for saving image');
      return false;
    }
    
    // Kiểm tra xem từ vựng đã có ảnh chưa
    const { data: existingImage } = await supabase
      .from('vocabulary_images')
      .select('*')
      .eq('vocabulary_id', vocabularyId)
      .maybeSingle();
    
    const currentTime = new Date().toISOString();
    
    if (existingImage) {
      // Cập nhật ảnh đã tồn tại
      const { error: updateError } = await supabase
        .from('vocabulary_images')
        .update({
          image_url: imageUrl,
          tags: tags || existingImage.tags,
          updated_at: currentTime
        })
        .eq('vocabulary_id', vocabularyId);
      
      if (updateError) {
        console.error('Error updating image:', updateError);
        return false;
      }
      
      console.log(`Updated image for vocabulary_id ${vocabularyId}`);
      return true;
    } else {
      // Thêm ảnh mới
      const { error: insertError } = await supabase
        .from('vocabulary_images')
        .insert({
          vocabulary_id: vocabularyId,
          image_url: imageUrl,
          tags: tags || '',
          created_at: currentTime,
          updated_at: currentTime
        });
      
      if (insertError) {
        console.error('Error inserting image:', insertError);
        return false;
      }
      
      console.log(`Saved new image for vocabulary_id ${vocabularyId}`);
      return true;
    }
  } catch (error) {
    console.error('Error in saveImageForVocabulary:', error);
    return false;
  }
};

/**
 * Tìm kiếm hình ảnh cho từ vựng sử dụng Google Custom Search API
 * @param keyword Từ cần tìm kiếm hình ảnh
 * @param maxResults Số lượng kết quả tối đa (mặc định: 3)
 * @returns Danh sách các URL hình ảnh
 */
export const searchImagesForWord = async (keyword: string, maxResults: number = 3): Promise<GoogleImageResult[]> => {
  try {
    // Thêm loại trừ các từ không mong muốn
    const excludedTerms = COMMON_EXCLUDED_TERMS.map(term => `-${term}`).join(' ');
    
    // Tạo URL tìm kiếm với từ khóa và thông số cấu hình đơn giản, an toàn
    const searchQuery = `${keyword} meaning definition concept visual representation clipart illustration ${excludedTerms}`;
    
    // Sử dụng chỉ những tham số cơ bản đã biết hoạt động ổn định
    const url = `https://www.googleapis.com/customsearch/v1?key=${API_KEY}&cx=${CX}&q=${encodeURIComponent(searchQuery)}&searchType=image&num=${maxResults}&safe=active&imgSize=medium`;
    
    console.log('Search URL:', url);
    
    // Gọi API và lấy kết quả
    const response = await fetch(url);
    const data = await response.json();
    
    // Kiểm tra lỗi
    if (!response.ok) {
      console.error('Google API error details:', data.error || 'Unknown error');
      if (data.error && data.error.message) {
        toast.error(`Lỗi API: ${data.error.message}`);
      } else {
        toast.error('Lỗi khi tìm kiếm hình ảnh');
      }
      return [];
    }
    
    // Kiểm tra kết quả trống
    if (!data.items || data.items.length === 0) {
      console.warn('No image results found for:', keyword);
      return [];
    }
    
    // Trả về mảng các kết quả
    return data.items.map((item: any) => ({
      link: item.link,
      title: item.title,
      image: item.image,
      thumbnail: item.image.thumbnailLink
    }));
    
  } catch (error) {
    console.error('Error fetching images from Google:', error);
    toast.error('Đã xảy ra lỗi khi tìm kiếm hình ảnh');
    return [];
  }
};

/**
 * Lấy ảnh phù hợp nhất cho từ vựng, ưu tiên ảnh đã lưu
 * @param keyword Từ cần tìm kiếm
 * @param vocabularyId ID của từ vựng
 * @returns URL hình ảnh đầu tiên hoặc null nếu không tìm thấy
 */
export const getBestImageForVocabulary = async (keyword: string, vocabularyId: string): Promise<GoogleImageResult | null> => {
  try {
    // Kiểm tra xem đã có ảnh lưu trữ chưa
    const savedImage = await getSavedImageForVocabulary(vocabularyId);
    
    if (savedImage) {
      // Trả về ảnh đã lưu với format tương tự GoogleImageResult
      return {
        link: savedImage.image_url,
        title: keyword,
        image: { height: 0, width: 0 },
        thumbnail: savedImage.image_url
      };
    }
    
    // Nếu không có ảnh đã lưu, tìm kiếm từ Google
    const results = await searchImagesForWord(keyword, 1);
    return results.length > 0 ? results[0] : null;
  } catch (error) {
    console.error('Error getting best image:', error);
    return null;
  }
};

// Hàm tìm kiếm ảnh từ Pixabay
export const searchPixabayImages = async (keyword: string, maxResults: number = 3): Promise<GoogleImageResult[]> => {
  try {
    // Loại bỏ tất cả các ký tự không phải tiếng Anh và số
    const cleanedKeyword = keyword.replace(/[^a-zA-Z0-9\s]/g, ' ').trim();
    
    // Đảm bảo từ khóa không rỗng
    if (!cleanedKeyword) {
      console.warn('Empty keyword after cleaning, using "illustration" as default');
      return [];
    }
    
    // Đảm bảo per_page ít nhất là 3 (theo yêu cầu của Pixabay API)
    const perPage = Math.max(3, maxResults);
    
    // Tạo URL tìm kiếm với Pixabay, giới hạn chỉ còn tiếng Anh
    const url = `https://pixabay.com/api/?key=${PIXABAY_API_KEY}&q=${encodeURIComponent(cleanedKeyword)}&image_type=photo,illustration&per_page=${perPage}&safesearch=true&min_width=400&min_height=300&order=popular&lang=en`;
    
    console.log('Pixabay Search URL:', url);
    
    const response = await fetch(url);
    
    // Kiểm tra response trước khi parse JSON
    if (!response.ok) {
      console.error(`Pixabay API error: Status ${response.status}`, await response.text());
      return [];
    }
    
    const data = await response.json();
    
    // Kiểm tra xem dữ liệu có đúng định dạng không
    if (typeof data !== 'object' || !data) {
      console.error('Invalid Pixabay API response format');
      return [];
    }
    
    if (!data.hits || data.hits.length === 0) {
      console.warn('No image results found on Pixabay for:', keyword);
      return [];
    }
    
    // Chuyển đổi kết quả Pixabay sang format GoogleImageResult
    const results = data.hits.map((item: PixabayImageResult) => ({
      link: item.largeImageURL, // Sử dụng ảnh chất lượng cao
      title: item.tags,
      image: {
        height: item.imageHeight,
        width: item.imageWidth,
        thumbnailLink: item.previewURL
      },
      thumbnail: item.previewURL
    }));
    
    // Chỉ trả về số lượng kết quả cần thiết
    return results.slice(0, maxResults);
    
  } catch (error) {
    console.error('Error fetching images from Pixabay:', error);
    return [];
  }
};

// Hàm tìm kiếm ảnh từ Pixabay theo từ khóa đặc biệt
export const searchPixabayWithSpecializedQuery = async (word: string, category: string, meaning?: string): Promise<GoogleImageResult | null> => {
  try {
    // Tạo từ khóa phù hợp dựa trên loại từ, chỉ sử dụng từ khóa tiếng Anh
    let specialQuery = word;
    
    switch (category) {
      case 'abstractVerb':
        specialQuery = `${word} action concept`;
        break;
      case 'abstractNoun':
        specialQuery = `${word} concept symbol`;
        break;
      case 'adjective':
        specialQuery = `${word} characteristic`;
        break;
      case 'concreteNoun':
        specialQuery = `${word} object`;
        break;
    }
    
    // Bỏ qua meaning tiếng Việt để tránh lỗi
    // if (meaning) {
    //   const meaningWords = meaning.split(' ').slice(0, 2).join(' ');
    //   specialQuery += ` ${meaningWords}`;
    // }
    
    console.log(`Pixabay specialized query for "${word}": ${specialQuery}`);
    
    // Thử với nhiều truy vấn khác nhau nếu truy vấn đầu tiên thất bại
    const fallbackQueries = [
      specialQuery,           // Truy vấn đặc biệt theo loại từ
      word,                   // Chỉ từ tiếng Anh
      `${word} image`,        // Thêm từ "image"
      `${word} illustration`  // Thêm từ "illustration"
    ];
    
    // Thử từng truy vấn cho đến khi tìm được kết quả
    for (const query of fallbackQueries) {
      try {
        const results = await searchPixabayImages(query, 1);
        if (results.length > 0) {
          console.log(`Found Pixabay image using query: "${query}"`);
          return results[0];
        }
      } catch (err) {
        console.error(`Error with Pixabay query "${query}":`, err);
        continue; // Thử truy vấn tiếp theo
      }
    }
    
    console.warn(`No Pixabay image found for any query variations of "${word}"`);
    return null;
    
  } catch (error) {
    console.error('Error searching Pixabay with specialized query:', error);
    return null;
  }
};

// Thêm hàm lấy nhiều ảnh từ Pixabay để có thể chọn ảnh khác
export const searchMultiplePixabayImages = async (keyword: string, maxResults: number = 10): Promise<GoogleImageResult[]> => {
  try {
    // Loại bỏ tất cả các ký tự không phải tiếng Anh và số, nhưng giữ từ gốc
    const originalKeyword = keyword.trim();
    const cleanedKeyword = keyword.replace(/[^a-zA-Z0-9\s]/g, ' ').trim();
    
    // Đảm bảo từ khóa không rỗng
    if (!cleanedKeyword) {
      console.warn('Empty keyword after cleaning');
      return [];
    }
    
    // Chuẩn bị thêm các dạng khác của từ (số ít/số nhiều)
    let keywordVariations = [cleanedKeyword];
    
    // Tự động thêm dạng số ít nếu từ có 's' ở cuối
    if (cleanedKeyword.endsWith('s') && cleanedKeyword.length > 2) {
      const singularForm = cleanedKeyword.slice(0, -1);
      keywordVariations.push(singularForm);
      console.log(`Adding singular form: "${singularForm}" for "${cleanedKeyword}"`);
    }
    // Tự động thêm dạng số nhiều bằng cách thêm 's' nếu từ không kết thúc bằng 's'
    else if (!cleanedKeyword.endsWith('s') && cleanedKeyword.length > 1) {
      const pluralForm = cleanedKeyword + 's';
      keywordVariations.push(pluralForm);
      console.log(`Adding plural form: "${pluralForm}" for "${cleanedKeyword}"`);
    }
    
    // Thêm các từ khóa liên quan cho từ đặc biệt
    const specialKeywords: {[key: string]: string[]} = {
      'flow': ['flowing', 'river', 'water', 'stream'],
      'flows': ['flowing', 'river', 'water', 'stream'],
      'depend': ['depends', 'dependency', 'reliance'],
      'depends': ['dependency', 'reliance', 'depend on others'],
      'carefully': ['care', 'careful', 'caution'],
      'through': ['passing through', 'movement through', 'passage through']
    };
    
    // Thêm từ khóa đặc biệt nếu có
    Object.keys(specialKeywords).forEach(key => {
      if (cleanedKeyword.toLowerCase().includes(key.toLowerCase())) {
        keywordVariations = [...keywordVariations, ...specialKeywords[key]];
        console.log(`Added special keywords for "${key}": ${specialKeywords[key].join(', ')}`);
      }
    });
    
    // Loại bỏ trùng lặp
    keywordVariations = [...new Set(keywordVariations)];
    
    console.log(`Will try these keyword variations: ${keywordVariations.join(', ')}`);
    
    // Đảm bảo per_page ít nhất là 3 (theo yêu cầu của Pixabay API)
    const perPage = Math.max(10, maxResults);
    
    // Kết quả tổng hợp
    let allResults: GoogleImageResult[] = [];
    
    // Thử tìm với mỗi biến thể của từ
    for (const variationKeyword of keywordVariations) {
      if (allResults.length >= maxResults * 2) {
        console.log(`Already found ${allResults.length} results, skipping remaining variations`);
        break;
      }
      
      // Tạo URL tìm kiếm với Pixabay, để lấy nhiều kết quả hơn
      const url = `https://pixabay.com/api/?key=${PIXABAY_API_KEY}&q=${encodeURIComponent(variationKeyword)}&image_type=photo,illustration&per_page=${perPage}&safesearch=true&min_width=400&min_height=300&order=popular&lang=en`;
      
      console.log(`Pixabay search URL for "${variationKeyword}":`, url);
      
      try {
        const response = await fetch(url);
        
        // Kiểm tra response trước khi parse JSON
        if (!response.ok) {
          console.error(`Pixabay API error for "${variationKeyword}": Status ${response.status}`, await response.text());
          continue; // Thử biến thể từ tiếp theo
        }
        
        const data = await response.json();
        
        // Kiểm tra xem dữ liệu có đúng định dạng không
        if (typeof data !== 'object' || !data) {
          console.error(`Invalid Pixabay API response format for "${variationKeyword}"`);
          continue;
        }
        
        if (!data.hits || data.hits.length === 0) {
          console.warn(`No image results found on Pixabay for: "${variationKeyword}"`);
          continue;
        }
        
        console.log(`Found ${data.hits.length} images on Pixabay for "${variationKeyword}"`);
        
        // Chuyển đổi kết quả Pixabay sang format GoogleImageResult
        const results = data.hits.map((item: PixabayImageResult) => ({
          link: item.largeImageURL, // Sử dụng ảnh chất lượng cao
          title: `${originalKeyword}: ${item.tags}`, // Gắn từ gốc vào title
          image: {
            height: item.imageHeight,
            width: item.imageWidth,
            thumbnailLink: item.previewURL
          },
          thumbnail: item.previewURL
        }));
        
        // Thêm các kết quả mới vào danh sách tổng hợp
        allResults = [...allResults, ...results];
        
      } catch (error) {
        console.error(`Error fetching images from Pixabay for "${variationKeyword}":`, error);
        continue;
      }
    }
    
    // Loại bỏ trùng lặp dựa trên URL
    const uniqueResults = allResults.filter((result, index, self) =>
      index === self.findIndex((r) => r.link === result.link)
    );
    
    console.log(`Found a total of ${uniqueResults.length} unique images after trying all variations`);
    
    // Nếu không tìm thấy kết quả nào, thử tìm kiếm với từ khóa chung "concept"
    if (uniqueResults.length === 0) {
      console.log('No results found with any keyword variation, trying generic "concept" search');
      
      try {
        const fallbackUrl = `https://pixabay.com/api/?key=${PIXABAY_API_KEY}&q=concept&image_type=photo,illustration&per_page=${perPage}&safesearch=true&min_width=400&min_height=300&order=popular&lang=en`;
        
        const response = await fetch(fallbackUrl);
        if (response.ok) {
          const data = await response.json();
          if (data.hits && data.hits.length > 0) {
            const fallbackResults = data.hits.map((item: PixabayImageResult) => ({
              link: item.largeImageURL,
              title: `${originalKeyword} (generic concept image): ${item.tags}`,
              image: {
                height: item.imageHeight,
                width: item.imageWidth,
                thumbnailLink: item.previewURL
              },
              thumbnail: item.previewURL
            }));
            return fallbackResults.slice(0, maxResults);
          }
        }
      } catch (error) {
        console.error('Error with fallback search:', error);
      }
    }
    
    // Trả về kết quả tổng hợp, giới hạn theo maxResults
    return uniqueResults.slice(0, maxResults);
    
  } catch (error) {
    console.error('Error fetching multiple images from Pixabay:', error);
    return [];
  }
};

// Hàm tìm kiếm ảnh từ Pixabay với từ khóa đặc biệt và loại trừ ảnh đã từng sử dụng
export const searchNewPixabayImage = async (
  word: string, 
  vocabularyId: string, 
  partOfSpeech?: string, 
  meaning?: string, 
  previousImageUrls: string[] = []
): Promise<GoogleImageResult | null> => {
  try {
    // Tạo từ khóa phù hợp dựa trên loại từ và thêm các từ khóa liên quan
    let specialQueries: string[] = [word];
    const wordCategory = getWordCategory(word, partOfSpeech);
    
    // Các truy vấn chuyên biệt dựa trên loại từ
    switch (wordCategory) {
      case 'abstractVerb':
        specialQueries.push(`${word} action`);
        specialQueries.push(`${word} concept`);
        specialQueries.push(`${word} action concept`);
        break;
      case 'abstractNoun':
        specialQueries.push(`${word} concept`);
        specialQueries.push(`${word} symbol`);
        specialQueries.push(`${word} concept symbol`);
        break;
      case 'adjective':
        specialQueries.push(`${word} example`);
        specialQueries.push(`${word} characteristic`);
        break;
      case 'concreteNoun':
        specialQueries.push(`${word} object`);
        specialQueries.push(`${word} thing`);
        break;
    }
    
    // Từ đặc biệt với truy vấn riêng
    const specialWords: {[key: string]: string[]} = {
      'flow': ['river flow', 'water flow', 'flowing water', 'stream'],
      'flows': ['river flow', 'water flow', 'flowing water', 'stream'],
      'depend': ['dependency', 'reliance', 'depend on others'],
      'depends': ['dependency', 'reliance', 'depend on others'],
      'carefully': ['careful action', 'caution', 'careful handling'],
      'through': ['passing through', 'movement through', 'passage through']
    };
    
    // Thêm các truy vấn đặc biệt nếu từ nằm trong danh sách đặc biệt
    Object.keys(specialWords).forEach(key => {
      if (word.toLowerCase() === key.toLowerCase()) {
        specialQueries = [...specialQueries, ...specialWords[key]];
        console.log(`Added special queries for "${key}": ${specialWords[key].join(', ')}`);
      }
    });
    
    // Loại bỏ trùng lặp
    specialQueries = [...new Set(specialQueries)];
    
    // Biến thể số ít/số nhiều
    if (word.endsWith('s') && word.length > 2) {
      // Thêm dạng số ít
      const singularForm = word.slice(0, -1);
      specialQueries.push(singularForm);
    } else if (!word.endsWith('s') && word.length > 1) {
      // Thêm dạng số nhiều
      const pluralForm = word + 's';
      specialQueries.push(pluralForm);
    }
    
    console.log(`Will try these queries for "${word}": ${specialQueries.join(', ')}`);
    
    // Thử tìm theo từng truy vấn cho đến khi tìm được kết quả mới
    for (const query of specialQueries) {
      // Tìm kiếm nhiều ảnh để có thể chọn ảnh mới
      const results = await searchMultiplePixabayImages(query, 10);
      
      if (results.length > 0) {
        // Lọc bỏ các ảnh đã từng dùng
        const filteredResults = results.filter(img => 
          !previousImageUrls.some(prevUrl => 
            prevUrl.includes(img.link.split('?')[0]) || 
            img.link.split('?')[0].includes(prevUrl)
          )
        );
        
        if (filteredResults.length > 0) {
          console.log(`Found ${filteredResults.length} new images for "${word}" using query "${query}" after filtering out previous images`);
          // Chọn ngẫu nhiên một ảnh trong số các ảnh mới
          const randomIndex = Math.floor(Math.random() * filteredResults.length);
          return filteredResults[randomIndex];
        } else {
          console.log(`All ${results.length} images for "${word}" using query "${query}" have been used before, trying next query`);
        }
      } else {
        console.log(`No results found for "${word}" using query "${query}", trying next query`);
      }
    }
    
    // Nếu không tìm được ảnh mới với tất cả các truy vấn, thử tìm kiếm tổng hợp
    console.log(`No new images found for "${word}" using any specialized query, trying combined search`);
    const allResults = await searchMultiplePixabayImages(word, 20);
    
    if (allResults.length > 0) {
      // Lọc bỏ các ảnh đã từng dùng
      const filteredResults = allResults.filter(img => 
        !previousImageUrls.some(prevUrl => 
          prevUrl.includes(img.link.split('?')[0]) || 
          img.link.split('?')[0].includes(prevUrl)
        )
      );
      
      if (filteredResults.length > 0) {
        console.log(`Found ${filteredResults.length} new images for "${word}" after filtering out previous images from combined search`);
        // Chọn ngẫu nhiên một ảnh trong số các ảnh mới
        const randomIndex = Math.floor(Math.random() * filteredResults.length);
        return filteredResults[randomIndex];
      } else if (allResults.length > 0) {
        console.warn(`All ${allResults.length} images for "${word}" have been used before, selecting random image`);
        // Nếu đã dùng hết các ảnh, vẫn trả về một ảnh ngẫu nhiên
        const randomIndex = Math.floor(Math.random() * allResults.length);
        return allResults[randomIndex];
      }
    }
    
    // Nếu không tìm thấy kết quả nào, trả về fallback ảnh generic
    console.warn(`No images found for "${word}" with any method, using fallback generic image search`);
    try {
      const fallbackUrl = `https://pixabay.com/api/?key=${PIXABAY_API_KEY}&q=concept&image_type=photo,illustration&per_page=10&safesearch=true&min_width=400&min_height=300&order=popular&lang=en`;
      
      const response = await fetch(fallbackUrl);
      if (response.ok) {
        const data = await response.json();
        if (data.hits && data.hits.length > 0) {
          const fallbackImage = data.hits[Math.floor(Math.random() * data.hits.length)];
          return {
            link: fallbackImage.largeImageURL,
            title: `${word} (generic concept image): ${fallbackImage.tags}`,
            image: {
              height: fallbackImage.imageHeight,
              width: fallbackImage.imageWidth
            },
            thumbnail: fallbackImage.previewURL
          };
        }
      }
    } catch (error) {
      console.error('Error with fallback search:', error);
    }
    
    return null;
    
  } catch (error) {
    console.error('Error searching new Pixabay image:', error);
    return null;
  }
};

// Cải tiến hàm getEnhancedImageForVocabulary để ưu tiên Pixabay trước Google
export const getEnhancedImageForVocabulary = async (
  word: string, 
  vocabularyId: string, 
  partOfSpeech?: string, 
  meaning?: string, 
  skipCache: boolean = false,
  forceNewImage: boolean = false
): Promise<GoogleImageResult | null> => {
  try {
    console.log(`getEnhancedImageForVocabulary called for word: "${word}", vocabularyId: ${vocabularyId}, skipCache: ${skipCache}, forceNewImage: ${forceNewImage}`);
    
    // Danh sách URL ảnh đã từng dùng cho từ này
    let previousImageUrls: string[] = [];
    
    // Kiểm tra xem đã có ảnh lưu trữ chưa và không bỏ qua cache
    if (!skipCache && !forceNewImage) {
      const savedImage = await getSavedImageForVocabulary(vocabularyId);
      
      if (savedImage) {
        // Lưu URL cũ để tránh tìm lại ảnh cũ khi cần tìm ảnh mới
        previousImageUrls.push(savedImage.image_url);
        
        if (!forceNewImage) {
          // Thêm timestamp + một số ngẫu nhiên để tránh cache browser hoàn toàn
          const cacheBuster = `?nocache=${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
          console.log(`Using saved image from database for "${word}": ${savedImage.image_url} (adding cache buster: ${cacheBuster})`);
          
          // Trả về ảnh đã lưu với format tương tự GoogleImageResult
          return {
            link: savedImage.image_url + cacheBuster,
            title: savedImage.tags || word,
            image: { height: 0, width: 0 },
            thumbnail: savedImage.image_url + cacheBuster
          };
        } else {
          console.log(`Force new image is enabled, skipping saved image for "${word}"`);
        }
      }
    } else {
      console.log(`Skipping cache for word "${word}"`);
      
      // Nếu buộc tìm ảnh mới, lấy URL cũ để tránh tìm lại
      if (forceNewImage) {
        const savedImage = await getSavedImageForVocabulary(vocabularyId);
        if (savedImage) {
          previousImageUrls.push(savedImage.image_url);
          console.log(`Added previous image URL to exclusion list: ${savedImage.image_url}`);
        }
      }
    }
    
    // Xác định loại từ
    const wordCategory = getWordCategory(word, partOfSpeech);
    console.log(`Word "${word}" categorized as: ${wordCategory}`);
    
    let foundImage: GoogleImageResult | null = null;
    
    // ĐÃ THAY ĐỔI: ƯU TIÊN TÌM KIẾM PIXABAY TRƯỚC GOOGLE
    console.log(`PIXABAY FIRST STRATEGY: Starting image search for "${word}"`);
    
    // 1. PIXABAY: Tìm ảnh với tùy chọn phù hợp
    if (forceNewImage) {
      // Nếu buộc tìm ảnh mới, sử dụng tìm kiếm mở rộng trên Pixabay
      console.log(`Forcing new image for "${word}", using Pixabay advanced search`);
      foundImage = await searchNewPixabayImage(word, vocabularyId, partOfSpeech, meaning, previousImageUrls);
    } else {
      // Ưu tiên dùng tìm kiếm chuyên biệt trên Pixabay
      console.log(`Using Pixabay specialized search for "${word}"`);
      foundImage = await searchPixabayWithSpecializedQuery(word, wordCategory, meaning);
    }
    
    if (foundImage) {
      console.log(`Successfully found image on Pixabay for "${word}"`);
    } else {
      // Nếu không tìm được bằng phương pháp chuyên biệt, thử biến thể khác
      console.log(`No specialized image found, trying more variations on Pixabay for "${word}"`);
      const results = await searchMultiplePixabayImages(word, 5);
      
      if (results.length > 0) {
        // Chọn ngẫu nhiên một ảnh từ kết quả
        const randomIndex = Math.floor(Math.random() * results.length);
        foundImage = results[randomIndex];
        console.log(`Found image from Pixabay variations for "${word}" (${results.length} results)`);
      } else {
        console.log(`No image found on Pixabay for "${word}", will try Google next`);
      }
    }
    
    // 2. GOOGLE: Chỉ sử dụng nếu Pixabay không tìm được ảnh
    if (!foundImage) {
      console.log(`Falling back to Google search for "${word}"`);
      
      try {
        // Thử các truy vấn chuyên biệt trên Google
        const MAX_QUERIES_PER_WORD = 2; // Giảm số lượng truy vấn để tránh quota vượt quá
        const searchQueries = generateSpecializedSearchQueries(word, wordCategory, meaning).slice(0, MAX_QUERIES_PER_WORD);
        console.log(`Generated ${searchQueries.length} Google queries for "${word}"`);
        
        for (const query of searchQueries) {
          try {
            console.log(`Trying Google query: ${query}`);
            const timestamp = Date.now();
            const url = `https://www.googleapis.com/customsearch/v1?key=${API_KEY}&cx=${CX}&q=${encodeURIComponent(query)}&searchType=image&num=1&safe=active&imgSize=medium&_t=${timestamp}`;
            
            const response = await fetch(url);
            const data = await response.json();
            
            if (!response.ok) {
              if (data.error && (data.error.code === 429 || data.error.message?.includes('Quota exceeded'))) {
                console.warn('Google API quota exceeded, stopping Google search');
                break;
              }
              console.error('Google API error:', data.error || 'Unknown error');
              continue;
            }
            
            if (data.items && data.items.length > 0) {
              console.log(`Found image on Google for "${word}"`);
              foundImage = {
                link: data.items[0].link,
                title: data.items[0].title,
                image: data.items[0].image,
                thumbnail: data.items[0].image.thumbnailLink
              };
              break;
            }
          } catch (error) {
            console.error(`Error with Google query "${query}":`, error);
            continue;
          }
        }
        
        // Nếu vẫn không tìm thấy, thử phương pháp đơn giản với Google
        if (!foundImage) {
          console.log(`Trying simple Google search for "${word}"`);
          const results = await searchImagesForWord(word, 1);
          if (results.length > 0) {
            foundImage = results[0];
          }
        }
      } catch (error) {
        console.error('Error with Google search:', error);
      }
    }
    
    // Xử lý ảnh nếu tìm thấy
    if (foundImage) {
      // Xử lý cache buster và lưu vào database
      const newImageUrl = foundImage.link.split('?')[0];
      const uniqueCacheBuster = `?nocache=${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
      
      console.log(`Found image for "${word}" (${foundImage.title || 'Untitled'}), adding cache buster`);
      
      foundImage.link = newImageUrl + uniqueCacheBuster;
      if (foundImage.thumbnail) {
        foundImage.thumbnail = foundImage.thumbnail.split('?')[0] + uniqueCacheBuster;
      }
      
      // Xóa cache cũ nếu cần
      if (skipCache || forceNewImage) {
        try {
          console.log(`Deleting old image record for vocabulary_id: ${vocabularyId}`);
          await supabase
            .from('vocabulary_images')
            .delete()
            .eq('vocabulary_id', vocabularyId);
        } catch (deleteError) {
          console.warn(`Failed to delete old image: ${deleteError}`);
        }
      }
      
      // Lưu ảnh mới vào database
      const success = await saveImageForVocabulary(vocabularyId, newImageUrl, foundImage.title || word);
      if (success) {
        console.log(`Saved new image for vocabulary_id ${vocabularyId}: ${newImageUrl}`);
      } else {
        console.warn(`Failed to save image for vocabulary_id ${vocabularyId}`);
      }
      
      return foundImage;
    }
    
    console.warn(`No image found for "${word}" using both Pixabay and Google`);
    return null;
    
  } catch (error) {
    console.error('Error getting image for vocabulary:', error);
    return null;
  }
};

export default {
  searchImagesForWord,
  getBestImageForVocabulary,
  saveImageForVocabulary,
  getSavedImageForVocabulary,
  getEnhancedImageForVocabulary,
  searchPixabayImages,
  searchPixabayWithSpecializedQuery,
  searchMultiplePixabayImages,
  searchNewPixabayImage
}; 