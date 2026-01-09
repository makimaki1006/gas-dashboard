/**
 * SalaryParser.js - 給与解析モジュール
 * 日本語の給与表記を解析し、統一フォーマットに変換
 */

/**
 * 給与テキストを解析して構造化データに変換
 * @param {string} salaryText - 給与テキスト（例: "月給25万円～30万円"）
 * @returns {Object} 解析結果
 */
function parseSalary(salaryText) {
  if (!salaryText || salaryText === '') {
    return createEmptySalaryResult();
  }

  const text = normalizeText(salaryText);

  // 給与タイプを判定
  const salaryType = detectSalaryType(text);

  // 数値を抽出
  const { minValue, maxValue, hasRange } = extractSalaryValues(text);

  // 月給・年収に換算
  const unified = calculateUnifiedSalary(minValue, maxValue, salaryType);

  // 給与レンジカテゴリを取得
  const rangeCategory = getSalaryRangeCategory(unified.monthly, 'monthly');

  return {
    originalText: salaryText,
    salaryType: salaryType,
    minValue: minValue,
    maxValue: maxValue,
    hasRange: hasRange,
    unifiedMonthly: unified.monthly,
    unifiedAnnual: unified.annual,
    rangeCategory: rangeCategory,
    confidence: calculateConfidence(text, minValue, salaryType)
  };
}

/**
 * 空の給与結果を作成
 */
function createEmptySalaryResult() {
  return {
    originalText: '',
    salaryType: null,
    minValue: null,
    maxValue: null,
    hasRange: false,
    unifiedMonthly: null,
    unifiedAnnual: null,
    rangeCategory: null,
    confidence: 0
  };
}

/**
 * テキストを正規化
 */
function normalizeText(text) {
  return text
    // 全角数字を半角に
    .replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))
    // 全角カンマ・ピリオドを半角に
    .replace(/，/g, ',')
    .replace(/．/g, '.')
    // 全角チルダ・ダッシュを統一
    .replace(/[～〜ー―－]/g, '~')
    // 複数スペースを1つに
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * 給与タイプを判定
 */
function detectSalaryType(text) {
  if (/時給/.test(text)) return SALARY_TYPES.HOURLY;
  if (/日給/.test(text)) return SALARY_TYPES.DAILY;
  if (/週給/.test(text)) return 'weekly'; // 週給対応
  if (/月給|月収|基本給|固定給/.test(text)) return SALARY_TYPES.MONTHLY;
  if (/年俸|年収/.test(text)) return SALARY_TYPES.ANNUAL;

  // デフォルトは月給として扱う
  return SALARY_TYPES.MONTHLY;
}

/**
 * 給与数値を抽出
 */
function extractSalaryValues(text) {
  let minValue = null;
  let maxValue = null;
  let hasRange = false;
  let rangeType = 'exact'; // 'exact', 'min_only', 'max_only', 'range'

  // カンマを除去して処理用テキストを作成
  const cleanText = text.replace(/,/g, '');

  // 範囲表記を検出（例: "25万円~30万円", "250,000円 ~ 300,000円"）
  const rangeMatch = cleanText.match(/(\d+(?:\.\d+)?)\s*(万)?\s*円?\s*~\s*(\d+(?:\.\d+)?)\s*(万)?\s*円?/);

  if (rangeMatch) {
    hasRange = true;
    rangeType = 'range';
    minValue = parseJapaneseAmount(rangeMatch[1], rangeMatch[2] === '万');
    maxValue = parseJapaneseAmount(rangeMatch[3], rangeMatch[4] === '万');
  } else {
    // 「以上」「以下」「未満」「から」の検出
    const minOnlyMatch = cleanText.match(/(\d+(?:\.\d+)?)\s*(万)?\s*円?\s*(?:以上|から|~)/);
    const maxOnlyMatch = cleanText.match(/(\d+(?:\.\d+)?)\s*(万)?\s*円?\s*(?:以下|未満|まで)/);
    
    if (minOnlyMatch && !maxOnlyMatch) {
      // 「25万円以上」のパターン
      hasRange = true;
      rangeType = 'min_only';
      minValue = parseJapaneseAmount(minOnlyMatch[1], minOnlyMatch[2] === '万');
      maxValue = null; // 上限なし
    } else if (maxOnlyMatch && !minOnlyMatch) {
      // 「30万円以下」のパターン
      hasRange = true;
      rangeType = 'max_only';
      minValue = null; // 下限なし
      maxValue = parseJapaneseAmount(maxOnlyMatch[1], maxOnlyMatch[2] === '万');
    } else {
      // 単一値を抽出
      const singleValue = extractSingleValue(cleanText);
      minValue = singleValue;
      maxValue = singleValue;
    }
  }

  return { minValue, maxValue, hasRange, rangeType };
}

/**
 * 単一の給与値を抽出
 */
function extractSingleValue(text) {
  // 「万」単位を含むパターン
  const manPattern = /(\d+(?:\.\d+)?)\s*万\s*(\d+(?:\.\d+)?)?\s*(千)?\s*円?/;
  const manMatch = text.match(manPattern);

  if (manMatch) {
    let value = parseFloat(manMatch[1]) * 10000;
    if (manMatch[2]) {
      if (manMatch[3] === '千') {
        value += parseFloat(manMatch[2]) * 1000;
      } else {
        value += parseFloat(manMatch[2]);
      }
    }
    return value;
  }

  // 「千」単位を含むパターン
  const senPattern = /(\d+(?:\.\d+)?)\s*千\s*円/;
  const senMatch = text.match(senPattern);
  if (senMatch) {
    return parseFloat(senMatch[1]) * 1000;
  }

  // 通常の数値パターン（例: "250000円"）
  const normalPattern = /(\d+(?:\.\d+)?)\s*円/;
  const normalMatch = text.match(normalPattern);
  if (normalMatch) {
    return parseFloat(normalMatch[1]);
  }

  // 数値のみ
  const numOnlyMatch = text.match(/(\d+(?:\.\d+)?)/);
  if (numOnlyMatch) {
    const num = parseFloat(numOnlyMatch[1]);
    // 1000未満は「万」単位と推測
    if (num < 1000) {
      return num * 10000;
    }
    return num;
  }

  return null;
}

/**
 * 日本円金額をパース
 */
function parseJapaneseAmount(numStr, isMan) {
  const num = parseFloat(numStr);
  return isMan ? num * 10000 : num;
}

/**
 * 統一給与（月給・年収）を計算
 */
function calculateUnifiedSalary(minValue, maxValue, salaryType) {
  if (minValue === null) {
    return { monthly: null, annual: null };
  }

  // 中央値を使用（範囲がある場合）
  const baseValue = maxValue !== null ? (minValue + maxValue) / 2 : minValue;

  let monthly, annual;

  switch (salaryType) {
    case SALARY_TYPES.HOURLY:
      monthly = Math.round(baseValue * SALARY_CONVERSION_RATES.hourly_to_monthly);
      annual = Math.round(monthly * SALARY_CONVERSION_RATES.monthly_to_annual);
      break;
    case SALARY_TYPES.DAILY:
      monthly = Math.round(baseValue * SALARY_CONVERSION_RATES.daily_to_monthly);
      annual = Math.round(monthly * SALARY_CONVERSION_RATES.monthly_to_annual);
      break;
    case SALARY_TYPES.ANNUAL:
      annual = Math.round(baseValue);
      monthly = Math.round(baseValue * SALARY_CONVERSION_RATES.annual_to_monthly);
      break;
    case 'weekly':
      // 週給 → 月給（4.33週/月）
      monthly = Math.round(baseValue * 4.33);
      annual = Math.round(monthly * SALARY_CONVERSION_RATES.monthly_to_annual);
      break;
    case SALARY_TYPES.MONTHLY:
    default:
      monthly = Math.round(baseValue);
      annual = Math.round(baseValue * SALARY_CONVERSION_RATES.monthly_to_annual);
      break;
  }

  return { monthly, annual };
}

/**
 * 給与レンジカテゴリを取得
 */
function getSalaryRangeCategory(value, type) {
  if (value === null) return null;

  let ranges;
  switch (type) {
    case 'hourly':
      ranges = SALARY_RANGES_HOURLY;
      break;
    case 'annual':
      ranges = SALARY_RANGES_ANNUAL;
      break;
    case 'monthly':
    default:
      ranges = SALARY_RANGES_MONTHLY;
      break;
  }

  for (const range of ranges) {
    if (value >= range.min && value <= range.max) {
      return {
        label: range.label,
        code: range.code
      };
    }
  }

  return null;
}

/**
 * 解析の信頼度を計算
 */
function calculateConfidence(text, value, salaryType) {
  if (value === null) return 0;

  let confidence = 0.5; // ベース

  // 明確な給与タイプ指定があれば加点
  if (/時給|日給|月給|月収|年俸|年収/.test(text)) {
    confidence += 0.2;
  }

  // 「円」の記載があれば加点
  if (/円/.test(text)) {
    confidence += 0.1;
  }

  // 妥当な範囲内かチェック
  const isReasonable = checkSalaryReasonability(value, salaryType);
  if (isReasonable) {
    confidence += 0.2;
  }

  return Math.min(confidence, 1.0);
}

/**
 * 給与値の妥当性をチェック
 */
function checkSalaryReasonability(value, salaryType) {
  switch (salaryType) {
    case SALARY_TYPES.HOURLY:
      return value >= 800 && value <= 50000;
    case SALARY_TYPES.DAILY:
      return value >= 5000 && value <= 100000;
    case SALARY_TYPES.MONTHLY:
      return value >= 100000 && value <= 2000000;
    case SALARY_TYPES.ANNUAL:
      return value >= 1000000 && value <= 50000000;
    default:
      return true;
  }
}

/**
 * 複数の給与データを一括解析
 * @param {Array} salaryDataArray - 給与テキストの配列
 * @returns {Array} 解析結果の配列
 */
function parseSalaryBatch(salaryDataArray) {
  return salaryDataArray.map(salary => parseSalary(salary));
}

/**
 * 給与統計を計算
 * @param {Array} parsedSalaries - 解析済み給与データの配列
 * @returns {Object} 統計データ
 */
function calculateSalaryStatistics(parsedSalaries) {
  // 有効なデータのみ抽出
  const validMonthly = parsedSalaries
    .filter(s => s.unifiedMonthly !== null)
    .map(s => s.unifiedMonthly);

  if (validMonthly.length === 0) {
    return {
      count: 0,
      mean: null,
      median: null,
      mode: null,
      modeRange: null,
      min: null,
      max: null,
      stdDev: null
    };
  }

  // ソート
  const sorted = [...validMonthly].sort((a, b) => a - b);

  // 統計計算
  const count = sorted.length;
  const sum = sorted.reduce((acc, val) => acc + val, 0);
  const mean = sum / count;
  const median = count % 2 === 0
    ? (sorted[count / 2 - 1] + sorted[count / 2]) / 2
    : sorted[Math.floor(count / 2)];
  const min = sorted[0];
  const max = sorted[count - 1];

  // 最頻値（5万円刻みでビニング）
  const binSize = 50000;
  const bins = {};
  validMonthly.forEach(val => {
    const binKey = Math.floor(val / binSize) * binSize;
    bins[binKey] = (bins[binKey] || 0) + 1;
  });

  let modeKey = null;
  let modeCount = 0;
  Object.entries(bins).forEach(([key, cnt]) => {
    if (cnt > modeCount) {
      modeCount = cnt;
      modeKey = parseInt(key);
    }
  });

  // 最頻値はビン中央値を使用
  const mode = modeKey !== null ? modeKey + binSize / 2 : null;
  const modeRange = modeKey !== null
    ? String(modeKey / 10000) + '万〜' + String((modeKey + binSize) / 10000) + '万円'
    : null;

  // 標準偏差
  const squaredDiffs = sorted.map(val => Math.pow(val - mean, 2));
  const avgSquaredDiff = squaredDiffs.reduce((acc, val) => acc + val, 0) / count;
  const stdDev = Math.sqrt(avgSquaredDiff);

  return {
    count,
    mean: Math.round(mean),
    median: Math.round(median),
    mode: mode !== null ? Math.round(mode) : null,
    modeRange,
    modeCount,
    min,
    max,
    stdDev: Math.round(stdDev)
  };
}

/**
 * 給与タイプ別の分布を取得
 */
function getSalaryTypeDistribution(parsedSalaries) {
  const distribution = {
    hourly: 0,
    daily: 0,
    monthly: 0,
    annual: 0,
    unknown: 0
  };

  parsedSalaries.forEach(salary => {
    if (salary.salaryType) {
      distribution[salary.salaryType]++;
    } else {
      distribution.unknown++;
    }
  });

  return distribution;
}

/**
 * 給与レンジ別の分布を取得
 */
function getSalaryRangeDistribution(parsedSalaries) {
  const distribution = {};

  // 初期化
  SALARY_RANGES_MONTHLY.forEach(range => {
    distribution[range.code] = {
      label: range.label,
      count: 0
    };
  });

  // カウント
  parsedSalaries.forEach(salary => {
    if (salary.rangeCategory && distribution[salary.rangeCategory.code]) {
      distribution[salary.rangeCategory.code].count++;
    }
  });

  return distribution;
}

/**
 * テスト関数
 */
function testSalaryParser() {
  const testCases = [
    '月給25万円',
    '月給250,000円～300,000円',
    '時給1,200円',
    '年収400万円',
    '日給8,000円～10,000円',
    '月給25万5千円',
    '20万円以上',
    '経験考慮'
  ];

  console.log('=== 給与解析テスト ===');
  testCases.forEach(testCase => {
    const result = parseSalary(testCase);
    console.log(`入力: "${testCase}"`);
    console.log(`  タイプ: ${result.salaryType}`);
    console.log(`  最小値: ${result.minValue}`);
    console.log(`  最大値: ${result.maxValue}`);
    console.log(`  月給換算: ${result.unifiedMonthly}`);
    console.log(`  年収換算: ${result.unifiedAnnual}`);
    console.log(`  レンジ: ${result.rangeCategory ? result.rangeCategory.label : 'N/A'}`);
    console.log(`  信頼度: ${result.confidence}`);
    console.log('---');
  });
}
