/**
 * Dynamic Time Warping (DTW) Algorithm
 * Dùng để map giữa script gốc và kết quả timing từ Azure Speech
 */

// Interface cho từng điểm trong DTW
export interface DtwPoint {
  i: number; // Vị trí trong chuỗi thứ nhất
  j: number; // Vị trí trong chuỗi thứ hai
  cost: number; // Chi phí (khoảng cách) tại điểm này
}

/**
 * Tính khoảng cách giữa hai từ (dựa trên độ tương đồng)
 */
export function wordDistance(word1: string, word2: string): number {
  // Tiền xử lý: loại bỏ dấu câu, chuyển thành chữ thường
  const clean1 = word1.toLowerCase().replace(/[.,!?;:()[\]{}"""'']/g, '');
  const clean2 = word2.toLowerCase().replace(/[.,!?;:()[\]{}"""'']/g, '');

  // Nếu hai từ giống nhau hoàn toàn
  if (clean1 === clean2) return 0;

  // Độ dài của hai từ
  const len1 = clean1.length;
  const len2 = clean2.length;

  // Khoảng cách Levenshtein
  const dp: number[][] = Array(len1 + 1)
    .fill(0)
    .map(() => Array(len2 + 1).fill(0));

  // Khởi tạo
  for (let i = 0; i <= len1; i++) dp[i][0] = i;
  for (let j = 0; j <= len2; j++) dp[0][j] = j;

  // Tính toán
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = clean1[i - 1] === clean2[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1, // Xóa
        dp[i][j - 1] + 1, // Chèn
        dp[i - 1][j - 1] + cost // Thay thế
      );
    }
  }

  // Chuẩn hóa khoảng cách trong khoảng [0, 1]
  return dp[len1][len2] / Math.max(len1, len2);
}

/**
 * Thực hiện thuật toán DTW để tìm alignment tốt nhất giữa hai mảng string
 * @param source Mảng từ nguồn (script gốc)
 * @param target Mảng từ đích (kết quả từ Azure Speech)
 * @returns Mảng các cặp [sourceIndex, targetIndex]
 */
export function performDTW(source: string[], target: string[]): [number, number][] {
  const n = source.length;
  const m = target.length;

  // Khởi tạo ma trận khoảng cách
  const distMatrix: number[][] = Array(n)
    .fill(0)
    .map(() => Array(m).fill(0));

  // Tính ma trận khoảng cách giữa các từ
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < m; j++) {
      distMatrix[i][j] = wordDistance(source[i], target[j]);
    }
  }

  // Khởi tạo ma trận DTW
  const dp: number[][] = Array(n + 1)
    .fill(0)
    .map(() => Array(m + 1).fill(Infinity));

  dp[0][0] = 0;

  // Tính toán DTW
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const cost = distMatrix[i - 1][j - 1];
      dp[i][j] = cost + Math.min(
        dp[i - 1][j],     // Xóa
        dp[i][j - 1],     // Chèn
        dp[i - 1][j - 1]  // Thay thế
      );
    }
  }

  // Truy vết để tìm alignment tốt nhất
  const alignment: [number, number][] = [];
  let i = n;
  let j = m;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0) {
      const diag = dp[i - 1][j - 1];
      const left = dp[i][j - 1];
      const up = dp[i - 1][j];
      const minVal = Math.min(diag, left, up);

      if (minVal === diag) {
        alignment.unshift([i - 1, j - 1]);
        i--;
        j--;
      } else if (minVal === left) {
        alignment.unshift([-1, j - 1]); // Gap trong source
        j--;
      } else {
        alignment.unshift([i - 1, -1]); // Gap trong target
        i--;
      }
    } else if (i > 0) {
      alignment.unshift([i - 1, -1]);
      i--;
    } else if (j > 0) {
      alignment.unshift([-1, j - 1]);
      j--;
    }
  }

  // Lọc ra những cặp hợp lệ (không có gap)
  return alignment.filter(([si, ti]) => si >= 0 && ti >= 0);
}

/**
 * Tăng cường timings bằng cách áp dụng DTW
 * @param scriptWords Các từ trong script gốc
 * @param wordTimings Word timings từ Azure Speech
 * @returns Word timings đã được tăng cường
 */
export function enhanceTimingsWithDTW(
  scriptWords: string[],
  wordTimings: { word: string; startTime: number; endTime: number }[]
): { word: string; startTime: number; endTime: number }[] {
  console.log('[DTW] Enhancing word timings with DTW algorithm');
  
  // Tạo mảng các từ từ wordTimings
  const timingWords = wordTimings.map(timing => timing.word);
  
  console.log(`[DTW] Script has ${scriptWords.length} words, timing has ${timingWords.length} words`);
  
  // Thực hiện DTW
  const alignment = performDTW(scriptWords, timingWords);
  
  console.log(`[DTW] Found ${alignment.length} word alignments`);
  
  // Tạo timings mới dựa trên alignment
  const enhancedTimings: { word: string; startTime: number; endTime: number }[] = [];
  
  // Map cho biết mỗi vị trí trong script ánh xạ đến vị trí nào trong timings
  const scriptToTimingMap = new Map<number, number>();
  
  // Tạo mapping
  alignment.forEach(([scriptIdx, timingIdx]) => {
    scriptToTimingMap.set(scriptIdx, timingIdx);
  });
  
  // Điền khoảng trống cho các từ không có mapping trực tiếp
  let lastMappedScript = -1;
  let lastMappedTiming = -1;
  
  for (let i = 0; i < scriptWords.length; i++) {
    if (scriptToTimingMap.has(i)) {
      lastMappedScript = i;
      lastMappedTiming = scriptToTimingMap.get(i)!;
    } else if (lastMappedScript >= 0 && lastMappedScript < scriptWords.length - 1) {
      // Tìm script index kế tiếp có mapping
      let nextMappedScript = -1;
      let nextMappedTiming = -1;
      
      for (let j = i + 1; j < scriptWords.length; j++) {
        if (scriptToTimingMap.has(j)) {
          nextMappedScript = j;
          nextMappedTiming = scriptToTimingMap.get(j)!;
          break;
        }
      }
      
      if (nextMappedScript >= 0) {
        // Nội suy tuyến tính
        const segmentLength = nextMappedScript - lastMappedScript;
        const currentPosition = i - lastMappedScript;
        const ratio = currentPosition / segmentLength;
        
        // Tìm timing tương ứng bằng nội suy
        const startTimeGap = wordTimings[nextMappedTiming].startTime - wordTimings[lastMappedTiming].endTime;
        const segmentStartTime = wordTimings[lastMappedTiming].endTime + (startTimeGap * ratio);
        
        // Tính thời gian kết thúc (giả định độ dài từ tỷ lệ với số ký tự)
        const wordLengthRatio = scriptWords[i].length / 
          (scriptWords.slice(lastMappedScript, nextMappedScript + 1)
            .reduce((sum, word) => sum + word.length, 0));
        
        const segmentDuration = startTimeGap * wordLengthRatio;
        const segmentEndTime = segmentStartTime + segmentDuration;
        
        // Tạo timing mới
        scriptToTimingMap.set(i, -1); // Đánh dấu đã xử lý
        
        // Giá trị nội suy
        enhancedTimings[i] = {
          word: scriptWords[i],
          startTime: segmentStartTime,
          endTime: segmentEndTime
        };
      }
    }
  }
  
  // Điền các timings có mapping trực tiếp
  for (let i = 0; i < scriptWords.length; i++) {
    const timingIdx = scriptToTimingMap.get(i);
    if (timingIdx !== undefined && timingIdx >= 0) {
      enhancedTimings[i] = {
        word: scriptWords[i],
        startTime: wordTimings[timingIdx].startTime,
        endTime: wordTimings[timingIdx].endTime
      };
    }
  }
  
  // Điền các timings còn thiếu
  for (let i = 0; i < scriptWords.length; i++) {
    if (!enhancedTimings[i]) {
      // Tìm timing gần nhất đã có
      let prevIdx = i - 1;
      let nextIdx = i + 1;
      
      while (prevIdx >= 0 && !enhancedTimings[prevIdx]) prevIdx--;
      while (nextIdx < scriptWords.length && !enhancedTimings[nextIdx]) nextIdx++;
      
      if (prevIdx >= 0 && nextIdx < scriptWords.length) {
        // Nội suy giữa hai điểm có sẵn
        const ratio = (i - prevIdx) / (nextIdx - prevIdx);
        const startTime = enhancedTimings[prevIdx].endTime;
        const endTime = enhancedTimings[nextIdx].startTime;
        const duration = endTime - startTime;
        
        enhancedTimings[i] = {
          word: scriptWords[i],
          startTime: startTime + (duration * ratio * 0.4),
          endTime: startTime + (duration * ratio * 0.6)
        };
      } else if (prevIdx >= 0) {
        // Chỉ có timing trước
        enhancedTimings[i] = {
          word: scriptWords[i],
          startTime: enhancedTimings[prevIdx].endTime + 0.1,
          endTime: enhancedTimings[prevIdx].endTime + 0.3
        };
      } else if (nextIdx < scriptWords.length) {
        // Chỉ có timing sau
        enhancedTimings[i] = {
          word: scriptWords[i],
          startTime: enhancedTimings[nextIdx].startTime - 0.3,
          endTime: enhancedTimings[nextIdx].startTime - 0.1
        };
      } else {
        // Không có timing trước và sau
        enhancedTimings[i] = {
          word: scriptWords[i],
          startTime: 0,
          endTime: 0.5
        };
      }
    }
  }
  
  console.log(`[DTW] Created ${enhancedTimings.length} enhanced timings`);
  
  // Đảm bảo thứ tự của mảng kết quả
  return enhancedTimings.filter(t => t !== undefined);
} 