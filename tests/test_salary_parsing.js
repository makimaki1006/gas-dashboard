/**
 * 給与解析の診断テスト
 * 求人ボックスCSVの給与データを解析し、時給/月給/年収の混入状況を確認
 */
const fs = require('fs');

// 給与タイプ定数
const SALARY_TYPES = {
  HOURLY: 'hourly',
  DAILY: 'daily',
  MONTHLY: 'monthly',
  ANNUAL: 'annual'
};

// 換算レート
const SALARY_CONVERSION_RATES = {
  hourly_to_monthly: 160,  // 8時間×20日
  daily_to_monthly: 20,
  monthly_to_annual: 12,
  annual_to_monthly: 1/12
};

/**
 * 給与タイプを判定
 */
function detectSalaryType(text) {
  if (/時給/.test(text)) return SALARY_TYPES.HOURLY;
  if (/日給/.test(text)) return SALARY_TYPES.DAILY;
  if (/週給/.test(text)) return 'weekly';
  if (/月給|月収|基本給|固定給/.test(text)) return SALARY_TYPES.MONTHLY;
  if (/年俸|年収/.test(text)) return SALARY_TYPES.ANNUAL;
  return SALARY_TYPES.MONTHLY; // デフォルト
}

/**
 * テキストを正規化
 */
function normalizeText(text) {
  return text
    .replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))
    .replace(/，/g, ',')
    .replace(/．/g, '.')
    .replace(/[～〜ー―－]/g, '~')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * 単一の給与値を抽出
 */
function extractSingleValue(text) {
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

  const senPattern = /(\d+(?:\.\d+)?)\s*千\s*円/;
  const senMatch = text.match(senPattern);
  if (senMatch) {
    return parseFloat(senMatch[1]) * 1000;
  }

  const normalPattern = /(\d+(?:\.\d+)?)\s*円/;
  const normalMatch = text.match(normalPattern);
  if (normalMatch) {
    return parseFloat(normalMatch[1]);
  }

  return null;
}

/**
 * 給与数値を抽出（改善版）
 */
function extractSalaryValues(text) {
  let minValue = null;
  let maxValue = null;
  let hasRange = false;

  const cleanText = text.replace(/,/g, '');

  // 改善版: ～で分割してから各部分を抽出
  if (/~/.test(cleanText)) {
    const parts = cleanText.split(/~/);
    if (parts.length >= 2) {
      const leftValue = extractSingleValue(parts[0]);
      const rightValue = extractSingleValue(parts[1]);

      if (leftValue !== null && rightValue !== null) {
        hasRange = true;
        minValue = leftValue;
        maxValue = rightValue;
      } else if (leftValue !== null) {
        hasRange = true;
        minValue = leftValue;
        maxValue = null;
      }
    }
  }

  if (!hasRange) {
    const singleValue = extractSingleValue(cleanText);
    minValue = singleValue;
    maxValue = singleValue;
  }

  return { minValue, maxValue, hasRange };
}

/**
 * 統一給与（月給）を計算
 */
function calculateUnifiedSalary(minValue, maxValue, salaryType) {
  if (minValue === null) {
    return { monthly: null, annual: null };
  }

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
 * 給与を解析
 */
function parseSalary(salaryText) {
  if (!salaryText || salaryText === '') {
    return { salaryType: null, minValue: null, unifiedMonthly: null };
  }

  const text = normalizeText(salaryText);
  const salaryType = detectSalaryType(text);
  const { minValue, maxValue, hasRange } = extractSalaryValues(text);
  const unified = calculateUnifiedSalary(minValue, maxValue, salaryType);

  return {
    originalText: salaryText,
    salaryType: salaryType,
    minValue: minValue,
    maxValue: maxValue,
    unifiedMonthly: unified.monthly
  };
}

// CSVファイルを読み込み
const csvPath = 'C:/Users/fuji1/Downloads/xn--pckua2a7gp15o89zb-2026-01-15 (2).csv';
const csvContent = fs.readFileSync(csvPath, 'utf-8');
const lines = csvContent.split('\n');

console.log('='.repeat(60));
console.log('求人ボックス給与データ解析テスト');
console.log('='.repeat(60));
console.log('総行数:', lines.length - 1, '(ヘッダー除く)');

// ヘッダー解析
const headers = lines[0].split(',');
console.log('\nヘッダー:', headers.slice(0, 10).join(', '));

// 給与カラムのインデックスを特定
const salaryIndex = headers.findIndex(h => h.includes('c-icon') && !h.includes('(2)') && !h.includes('(3)'));
console.log('給与カラムインデックス:', salaryIndex);

// c-icon (2) を探す（2番目のc-icon = 給与）
let salaryColIndex = -1;
headers.forEach((h, i) => {
  if (h.trim() === 'c-icon (2)') {
    salaryColIndex = i;
  }
});
console.log('給与カラム(c-icon (2))インデックス:', salaryColIndex);

// 統計
const typeDistribution = {
  hourly: { count: 0, samples: [] },
  daily: { count: 0, samples: [] },
  monthly: { count: 0, samples: [] },
  annual: { count: 0, samples: [] },
  weekly: { count: 0, samples: [] },
  null: { count: 0, samples: [] }
};

const monthlyRanges = {
  '0-5万': { count: 0, samples: [] },
  '5-10万': { count: 0, samples: [] },
  '10-15万': { count: 0, samples: [] },
  '15-20万': { count: 0, samples: [] },
  '20-25万': { count: 0, samples: [] },
  '25-30万': { count: 0, samples: [] },
  '30-40万': { count: 0, samples: [] },
  '40-50万': { count: 0, samples: [] },
  '50万以上': { count: 0, samples: [] }
};

const suspiciousData = [];

// 各行を解析
for (let i = 1; i < lines.length; i++) {
  const line = lines[i];
  if (!line.trim()) continue;

  // CSVパース（カンマで分割）
  const parts = line.split(',');

  // 給与テキストを取得（c-icon (2)カラムがなければ6番目付近を試す）
  let salaryText = '';
  if (salaryColIndex >= 0 && parts[salaryColIndex]) {
    salaryText = parts[salaryColIndex];
  } else {
    // フォールバック: 6番目のカラムを試す
    salaryText = parts[5] || '';
  }

  if (!salaryText.trim()) continue;

  const result = parseSalary(salaryText);

  // タイプ分布をカウント
  const type = result.salaryType || 'null';
  if (typeDistribution[type]) {
    typeDistribution[type].count++;
    if (typeDistribution[type].samples.length < 5) {
      typeDistribution[type].samples.push({
        text: salaryText.substring(0, 50),
        monthly: result.unifiedMonthly
      });
    }
  }

  // 月給レンジ分布
  if (result.unifiedMonthly !== null) {
    const m = result.unifiedMonthly;
    let range = '50万以上';
    if (m < 50000) range = '0-5万';
    else if (m < 100000) range = '5-10万';
    else if (m < 150000) range = '10-15万';
    else if (m < 200000) range = '15-20万';
    else if (m < 250000) range = '20-25万';
    else if (m < 300000) range = '25-30万';
    else if (m < 400000) range = '30-40万';
    else if (m < 500000) range = '40-50万';

    monthlyRanges[range].count++;
    if (monthlyRanges[range].samples.length < 3) {
      monthlyRanges[range].samples.push({
        text: salaryText.substring(0, 50),
        type: result.salaryType,
        monthly: result.unifiedMonthly
      });
    }

    // 疑わしいデータ（月給として不自然な値）
    // - 0-15万未満: 時給が誤検出？
    // - 50万超: 年収が誤検出？
    if (m < 150000 && result.salaryType === 'monthly') {
      if (suspiciousData.length < 30) {
        suspiciousData.push({
          text: salaryText.substring(0, 80),
          type: result.salaryType,
          minValue: result.minValue,
          monthly: result.unifiedMonthly
        });
      }
    }
  }
}

// 結果出力
console.log('\n=== 給与タイプ分布 ===');
Object.entries(typeDistribution).forEach(([type, data]) => {
  if (data.count > 0) {
    console.log(`\n${type}: ${data.count}件`);
    data.samples.forEach((s, i) => {
      console.log(`  ${i+1}. "${s.text}" → 月給換算: ${s.monthly ? Math.round(s.monthly/10000) + '万円' : 'N/A'}`);
    });
  }
});

console.log('\n=== 月給換算後の分布 ===');
Object.entries(monthlyRanges).forEach(([range, data]) => {
  const bar = '█'.repeat(Math.min(40, Math.round(data.count / 10)));
  console.log(`${range.padEnd(10)} ${String(data.count).padStart(4)}件 ${bar}`);
});

console.log('\n=== 疑わしいデータ（月給15万未満でmonthlyタイプ） ===');
suspiciousData.slice(0, 20).forEach((d, i) => {
  console.log(`${i+1}. type=${d.type}, minValue=${d.minValue}, monthly=${d.monthly}`);
  console.log(`   text: "${d.text}"`);
});

console.log('\n=== 低レンジのサンプル詳細 ===');
['0-5万', '5-10万', '10-15万'].forEach(range => {
  console.log(`\n【${range}】`);
  monthlyRanges[range].samples.forEach((s, i) => {
    console.log(`  ${i+1}. type=${s.type}, monthly=${s.monthly}`);
    console.log(`     "${s.text}"`);
  });
});

console.log('\n' + '='.repeat(60));
console.log('テスト完了');
console.log('='.repeat(60));
