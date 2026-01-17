/**
 * test-functions.js - GAS Dashboard Local Test Functions
 * Aggregator.js functions ported for browser execution
 */

// ========== Salary Parser ==========
// チルダ文字クラス（全角・半角両対応）
const TILDE_CHARS = '[～〜~\\-ー]';

function parseSalary(salaryText) {
  if (!salaryText || typeof salaryText !== 'string') {
    return null;
  }

  // 前処理: 全角数字→半角、全角カンマ→半角、カンマ除去、全角スペース→半角
  const text = salaryText
    // 全角数字を半角に変換
    .replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))
    // 全角カンマを半角に
    .replace(/，/g, ',')
    // カンマ除去
    .replace(/,/g, '')
    // 全角スペース→半角、複数スペース→単一
    .replace(/　/g, ' ').replace(/\s+/g, ' ').trim();

  let match;

  // 🔴 最優先: 小数点形式「月給 XX.X万円」（Indeed形式）
  // 例: 「月給 25.9万円」→ 259000
  match = text.match(/月給\s*(\d+)\.(\d+)\s*万\s*円?/);
  if (match) {
    const intPart = parseInt(match[1], 10);
    const decPart = parseInt(match[2], 10);
    const decLen = match[2].length;
    const decMultiplier = Math.pow(10, 4 - decLen); // .9→1000, .99→100
    const value = intPart * 10000 + decPart * decMultiplier;
    return { unifiedMonthly: value, min: value, max: value, minValue: value, maxValue: value, salaryType: 'monthly' };
  }

  // 🔴 円単位の範囲パターン: 「月給 247740円 ~ 310740円」
  // ASCII/全角チルダ両対応
  const yenRangePattern = new RegExp(`月給\\s*(\\d+)\\s*円\\s*${TILDE_CHARS}\\s*(\\d+)\\s*円`);
  match = text.match(yenRangePattern);
  if (match) {
    const min = parseInt(match[1], 10);
    const max = parseInt(match[2], 10);
    const unified = Math.round((min + max) / 2);
    return { unifiedMonthly: unified, min: min, max: max, minValue: min, maxValue: max, salaryType: 'monthly' };
  }

  // 複合パターン: 月給XX万YYYY円～ZZ万WWWW円（例: 月給30万700円～35万400円）
  const complexPattern = new RegExp(`月給\\s*(\\d+)\\s*万\\s*(\\d+)?\\s*円?\\s*${TILDE_CHARS}\\s*(\\d+)\\s*万\\s*(\\d+)?\\s*円?`);
  match = text.match(complexPattern);
  if (match) {
    const minMan = parseFloat(match[1]) * 10000;
    const minYen = match[2] ? parseFloat(match[2]) : 0;
    const maxMan = parseFloat(match[3]) * 10000;
    const maxYen = match[4] ? parseFloat(match[4]) : 0;

    const minValue = minMan + minYen;
    const maxValue = maxMan + maxYen;
    const unified = Math.round((minValue + maxValue) / 2);

    return { unifiedMonthly: unified, min: minValue, max: maxValue, minValue: minValue, maxValue: maxValue, salaryType: 'monthly' };
  }

  // 単一値パターン: 月給XX万YYYY円（例: 月給23万1000円, 月給23万1）
  match = text.match(/月給\s*(\d+)\s*万\s*(\d+)?\s*[千0-9]*\s*円?/);
  if (match) {
    const manValue = parseFloat(match[1]) * 10000;
    let subValue = 0;
    if (match[2]) {
      const num = parseFloat(match[2]);
      if (num >= 1000) {
        subValue = num;
      } else if (num >= 100) {
        subValue = num;
      } else {
        subValue = num * 1000;
      }
    }
    const baseValue = manValue + subValue;

    // 範囲があるか確認（～YY万円）- ASCII/全角チルダ両対応
    const rangeMatch = text.match(new RegExp(`${TILDE_CHARS}\\s*(\\d+)\\s*万`));
    if (rangeMatch) {
      const maxValue = parseFloat(rangeMatch[1]) * 10000;
      const unified = Math.round((baseValue + maxValue) / 2);
      return { unifiedMonthly: unified, min: baseValue, max: maxValue, minValue: baseValue, maxValue: maxValue, salaryType: 'monthly' };
    }

    return { unifiedMonthly: baseValue, min: baseValue, max: baseValue, minValue: baseValue, maxValue: baseValue, salaryType: 'monthly' };
  }

  // 月給パターン（単純形式）: 月給200000円～300000円 - ASCII/全角チルダ両対応
  const simpleMonthlyPattern = new RegExp(`月給\\s*(\\d{5,})\\s*円?\\s*${TILDE_CHARS}?\\s*(\\d{5,})?\\s*円?`);
  match = text.match(simpleMonthlyPattern);
  if (match) {
    const min = parseFloat(match[1]);
    const max = match[2] ? parseFloat(match[2]) : min;
    const unified = Math.round((min + max) / 2);
    return { unifiedMonthly: unified, min: min, max: max, minValue: min, maxValue: max, salaryType: 'monthly' };
  }

  // 年収/年俸パターン: 年収XXX万YYYY（例: 年収406万9000, 年俸600万円）
  match = text.match(/年[収俸]?\s*(\d+)\s*万\s*(\d+)?/);
  if (match) {
    let yearValue = parseFloat(match[1]) * 10000;
    if (match[2]) {
      const num = parseFloat(match[2]);
      if (num >= 1000) {
        yearValue += num;
      } else if (num >= 100) {
        yearValue += num;
      } else {
        yearValue += num * 1000;
      }
    }
    const monthlyValue = Math.round(yearValue / 12);

    // 範囲があるか確認 - ASCII/全角チルダ両対応
    const rangeMatch = text.match(new RegExp(`${TILDE_CHARS}\\s*(\\d+)\\s*万`));
    if (rangeMatch) {
      const maxYearValue = parseFloat(rangeMatch[1]) * 10000;
      const maxMonthly = Math.round(maxYearValue / 12);
      const unified = Math.round((monthlyValue + maxMonthly) / 2);
      return { unifiedMonthly: unified, min: monthlyValue, max: maxMonthly, minValue: monthlyValue, maxValue: maxMonthly, salaryType: 'annual' };
    }

    return { unifiedMonthly: monthlyValue, min: monthlyValue, max: monthlyValue, minValue: monthlyValue, maxValue: monthlyValue, salaryType: 'annual' };
  }

  // 時給パターン: 時給XXXX円～YYYY円 - ASCII/全角チルダ両対応
  const hourlyPattern = new RegExp(`時給\\s*(\\d+)\\s*円?\\s*${TILDE_CHARS}?\\s*(\\d+)?\\s*円?`);
  match = text.match(hourlyPattern);
  if (match) {
    const min = parseFloat(match[1]) * 160;
    const max = match[2] ? parseFloat(match[2]) * 160 : min;
    const unified = Math.round((min + max) / 2);
    return { unifiedMonthly: unified, min: min, max: max, minValue: min, maxValue: max, salaryType: 'hourly' };
  }

  // 日給パターン: 日給XXXX円～YYYY円 - ASCII/全角チルダ両対応
  const dailyPattern = new RegExp(`日給\\s*(\\d+)\\s*円?\\s*${TILDE_CHARS}?\\s*(\\d+)?\\s*円?`);
  match = text.match(dailyPattern);
  if (match) {
    const min = parseFloat(match[1]) * 20;
    const max = match[2] ? parseFloat(match[2]) * 20 : min;
    const unified = Math.round((min + max) / 2);
    return { unifiedMonthly: unified, min: min, max: max, minValue: min, maxValue: max, salaryType: 'daily' };
  }

  // 単純な「XX万円」パターン
  match = text.match(/(\d+)\s*万\s*円/);
  if (match) {
    const value = parseFloat(match[1]) * 10000;
    return { unifiedMonthly: value, min: value, max: value, minValue: value, maxValue: value, salaryType: 'monthly' };
  }

  return null;
}

// ========== Location Parser ==========
const PREFECTURES = [
  '北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県',
  '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県',
  '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県',
  '岐阜県', '静岡県', '愛知県', '三重県',
  '滋賀県', '京都府', '大阪府', '兵庫県', '奈良県', '和歌山県',
  '鳥取県', '島根県', '岡山県', '広島県', '山口県',
  '徳島県', '香川県', '愛媛県', '高知県',
  '福岡県', '佐賀県', '長崎県', '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県'
];

const REGION_BLOCKS = {
  '北海道': '北海道・東北',
  '青森県': '北海道・東北', '岩手県': '北海道・東北', '宮城県': '北海道・東北', '秋田県': '北海道・東北', '山形県': '北海道・東北', '福島県': '北海道・東北',
  '茨城県': '関東', '栃木県': '関東', '群馬県': '関東', '埼玉県': '関東', '千葉県': '関東', '東京都': '関東', '神奈川県': '関東',
  '新潟県': '北陸・甲信越', '富山県': '北陸・甲信越', '石川県': '北陸・甲信越', '福井県': '北陸・甲信越', '山梨県': '北陸・甲信越', '長野県': '北陸・甲信越',
  '岐阜県': '東海', '静岡県': '東海', '愛知県': '東海', '三重県': '東海',
  '滋賀県': '関西', '京都府': '関西', '大阪府': '関西', '兵庫県': '関西', '奈良県': '関西', '和歌山県': '関西',
  '鳥取県': '中国・四国', '島根県': '中国・四国', '岡山県': '中国・四国', '広島県': '中国・四国', '山口県': '中国・四国',
  '徳島県': '中国・四国', '香川県': '中国・四国', '愛媛県': '中国・四国', '高知県': '中国・四国',
  '福岡県': '九州・沖縄', '佐賀県': '九州・沖縄', '長崎県': '九州・沖縄', '熊本県': '九州・沖縄', '大分県': '九州・沖縄', '宮崎県': '九州・沖縄', '鹿児島県': '九州・沖縄', '沖縄県': '九州・沖縄'
};

function parseLocation(locationText) {
  if (!locationText || typeof locationText !== 'string') {
    return { prefecture: null, cityWard: null, regionBlock: null };
  }

  let prefecture = null;
  let cityWard = null;

  // 都道府県を検出
  for (const pref of PREFECTURES) {
    if (locationText.includes(pref)) {
      prefecture = pref;
      break;
    }
  }

  // 都道府県名が「都」「道」「府」「県」なしの場合
  if (!prefecture) {
    const shortNames = ['東京', '大阪', '京都', '北海道'];
    for (const name of shortNames) {
      if (locationText.includes(name)) {
        if (name === '東京') prefecture = '東京都';
        else if (name === '大阪') prefecture = '大阪府';
        else if (name === '京都') prefecture = '京都府';
        else if (name === '北海道') prefecture = '北海道';
        break;
      }
    }
  }

  // 市区町村を抽出
  const cityMatch = locationText.match(/([^\s]+[市区町村])/);
  if (cityMatch) {
    cityWard = cityMatch[1];
  }

  const regionBlock = prefecture ? (REGION_BLOCKS[prefecture] || '不明') : null;

  return { prefecture, cityWard, regionBlock };
}

// ========== Employment Parser ==========
function parseEmployment(employmentText) {
  if (!employmentText || typeof employmentText !== 'string') {
    return null;
  }

  const text = employmentText.toLowerCase();

  if (text.includes('正社員')) return { type: '正社員', category: '正規雇用', subcategory: '正社員' };
  if (text.includes('契約社員')) return { type: '契約社員', category: '非正規雇用', subcategory: '契約社員' };
  if (text.includes('派遣')) return { type: '派遣社員', category: '非正規雇用', subcategory: '派遣社員' };
  if (text.includes('パート') || text.includes('アルバイト')) return { type: 'パート・アルバイト', category: '非正規雇用', subcategory: 'パート・アルバイト' };
  if (text.includes('業務委託')) return { type: '業務委託', category: '非正規雇用', subcategory: '業務委託' };

  return null;
}

// ========== Annual Holidays Extractor ==========
function extractAnnualHolidays(text) {
  if (!text || typeof text !== 'string') return null;

  const match = text.match(/年間休日\s*(\d+)/);
  if (match) {
    const days = parseInt(match[1]);
    if (days >= 50 && days <= 200) {
      return days;
    }
  }
  return null;
}

// ========== createRegionSalaryAnalysis ==========
function createRegionSalaryAnalysis(parsedData) {
  // 有効な給与・地域データがあるレコードのみ
  const validData = parsedData.filter(d =>
    d.salaryParsed && d.salaryParsed.unifiedMonthly !== null &&
    d.locationParsed && d.locationParsed.prefecture
  );

  if (validData.length === 0) {
    return { prefectureSalary: {}, regionBlockSalary: {}, hasData: false };
  }

  // 都道府県別集計
  const prefectureData = {};
  validData.forEach(d => {
    const pref = d.locationParsed.prefecture;
    const salary = d.salaryParsed.unifiedMonthly;
    const minVal = d.salaryParsed.minValue;
    const maxVal = d.salaryParsed.maxValue;

    if (!prefectureData[pref]) {
      prefectureData[pref] = { salaries: [], minValues: [], maxValues: [] };
    }
    prefectureData[pref].salaries.push(salary);
    if (minVal !== null) prefectureData[pref].minValues.push(minVal);
    if (maxVal !== null) prefectureData[pref].maxValues.push(maxVal);
  });

  // 統計計算関数
  const calcStats = (arr) => {
    if (arr.length === 0) return { avg: null, median: null };
    const sorted = [...arr].sort((a, b) => a - b);
    const avg = Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
    const median = sorted[Math.floor(sorted.length / 2)];
    return { avg, median: Math.round(median) };
  };

  // 都道府県別統計
  const prefectureSalary = {};
  Object.entries(prefectureData).forEach(([pref, data]) => {
    const salaryStats = calcStats(data.salaries);
    const minStats = calcStats(data.minValues);
    const maxStats = calcStats(data.maxValues);
    prefectureSalary[pref] = {
      count: data.salaries.length,
      avgSalary: salaryStats.avg,
      avgSalaryMan: salaryStats.avg ? Math.round(salaryStats.avg / 10000 * 10) / 10 : null,
      medianSalary: salaryStats.median,
      medianSalaryMan: salaryStats.median ? Math.round(salaryStats.median / 10000 * 10) / 10 : null,
      avgMin: minStats.avg,
      avgMinMan: minStats.avg ? Math.round(minStats.avg / 10000 * 10) / 10 : null,
      avgMax: maxStats.avg,
      avgMaxMan: maxStats.avg ? Math.round(maxStats.avg / 10000 * 10) / 10 : null
    };
  });

  // 地域ブロック別集計
  const regionBlockData = {};
  validData.forEach(d => {
    const block = d.locationParsed.regionBlock || '不明';
    const salary = d.salaryParsed.unifiedMonthly;
    const minVal = d.salaryParsed.minValue;
    const maxVal = d.salaryParsed.maxValue;

    if (!regionBlockData[block]) {
      regionBlockData[block] = { salaries: [], minValues: [], maxValues: [] };
    }
    regionBlockData[block].salaries.push(salary);
    if (minVal !== null) regionBlockData[block].minValues.push(minVal);
    if (maxVal !== null) regionBlockData[block].maxValues.push(maxVal);
  });

  // 地域ブロック別統計
  const regionBlockSalary = {};
  Object.entries(regionBlockData).forEach(([block, data]) => {
    const salaryStats = calcStats(data.salaries);
    const minStats = calcStats(data.minValues);
    const maxStats = calcStats(data.maxValues);
    regionBlockSalary[block] = {
      count: data.salaries.length,
      avgSalary: salaryStats.avg,
      avgSalaryMan: salaryStats.avg ? Math.round(salaryStats.avg / 10000 * 10) / 10 : null,
      medianSalary: salaryStats.median,
      medianSalaryMan: salaryStats.median ? Math.round(salaryStats.median / 10000 * 10) / 10 : null,
      avgMin: minStats.avg,
      avgMinMan: minStats.avg ? Math.round(minStats.avg / 10000 * 10) / 10 : null,
      avgMax: maxStats.avg,
      avgMaxMan: maxStats.avg ? Math.round(maxStats.avg / 10000 * 10) / 10 : null
    };
  });

  // ソート（件数順）
  const sortedPrefecture = Object.entries(prefectureSalary)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 15);
  const sortedRegionBlock = Object.entries(regionBlockSalary)
    .sort((a, b) => b[1].count - a[1].count);

  return {
    hasData: true,
    totalWithData: validData.length,
    prefectureSalary: Object.fromEntries(sortedPrefecture),
    prefectureSalaryList: sortedPrefecture.map(([name, data]) => ({ name, ...data })),
    regionBlockSalary: regionBlockSalary,
    regionBlockSalaryList: sortedRegionBlock.map(([name, data]) => ({ name, ...data }))
  };
}

// ========== createCompanyAggregation ==========
function createCompanyAggregation(parsedData) {
  const companyData = {};

  parsedData.forEach(d => {
    const companyName = d.company || '不明';
    if (!companyData[companyName]) {
      companyData[companyName] = {
        name: companyName,
        count: 0,
        salaries: [],
        minValues: [],
        maxValues: [],
        rangeWidths: [],
        locations: {},
        employmentTypes: {},
        tags: {},
        newCount: 0
      };
    }

    const company = companyData[companyName];
    company.count++;

    // 給与データ
    if (d.salaryParsed && d.salaryParsed.unifiedMonthly) {
      company.salaries.push(d.salaryParsed.unifiedMonthly);

      if (d.salaryParsed.minValue !== null) {
        company.minValues.push(d.salaryParsed.minValue);
      }
      if (d.salaryParsed.maxValue !== null) {
        company.maxValues.push(d.salaryParsed.maxValue);
      }
      if (d.salaryParsed.minValue !== null && d.salaryParsed.maxValue !== null) {
        const width = d.salaryParsed.maxValue - d.salaryParsed.minValue;
        if (width > 0) {
          company.rangeWidths.push(width);
        }
      }
    }

    // 勤務地
    const cityWard = d.locationParsed?.cityWard;
    if (cityWard) {
      company.locations[cityWard] = (company.locations[cityWard] || 0) + 1;
    }

    // 雇用形態
    const empType = d.employmentParsed?.subcategory || '不明';
    company.employmentTypes[empType] = (company.employmentTypes[empType] || 0) + 1;

    // タグ
    if (d.tagsParsed && d.tagsParsed.tags) {
      d.tagsParsed.tags.forEach(tag => {
        company.tags[tag] = (company.tags[tag] || 0) + 1;
      });
    }

    // 新着
    if (d.isNew === '新着' || d.isNew === 'NEW') {
      company.newCount++;
    }
  });

  // 中央値計算ヘルパー
  const calcMedian = (arr) => {
    if (arr.length === 0) return null;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? Math.round((sorted[mid - 1] + sorted[mid]) / 2) : sorted[mid];
  };

  // 統計計算と整形
  const companyList = Object.values(companyData).map(company => {
    const avgSalary = company.salaries.length > 0
      ? Math.round(company.salaries.reduce((a, b) => a + b, 0) / company.salaries.length)
      : null;

    const minMedian = calcMedian(company.minValues);
    const maxMedian = calcMedian(company.maxValues);
    const avgRangeWidth = company.rangeWidths.length > 0
      ? Math.round(company.rangeWidths.reduce((a, b) => a + b, 0) / company.rangeWidths.length)
      : null;

    const topLocations = Object.entries(company.locations)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([loc, cnt]) => ({ location: loc, count: cnt }));

    const topEmploymentType = Object.entries(company.employmentTypes)
      .sort((a, b) => b[1] - a[1])[0];

    const topTags = Object.entries(company.tags)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([tag, cnt]) => tag);

    return {
      name: company.name,
      jobCount: company.count,
      avgSalary: avgSalary,
      avgSalaryMan: avgSalary ? Math.round(avgSalary / 10000 * 10) / 10 : null,
      minMedian: minMedian,
      minMedianMan: minMedian ? Math.round(minMedian / 10000 * 10) / 10 : null,
      maxMedian: maxMedian,
      maxMedianMan: maxMedian ? Math.round(maxMedian / 10000 * 10) / 10 : null,
      avgRangeWidth: avgRangeWidth,
      avgRangeWidthMan: avgRangeWidth ? Math.round(avgRangeWidth / 10000 * 10) / 10 : null,
      topLocations: topLocations,
      mainEmploymentType: topEmploymentType ? topEmploymentType[0] : '不明',
      topTags: topTags,
      newCount: company.newCount,
      newRate: company.count > 0 ? Math.round((company.newCount / company.count) * 100) : 0
    };
  });

  // ソート
  const sortedByCount = [...companyList].sort((a, b) => b.jobCount - a.jobCount).slice(0, 15);
  const sortedBySalary = [...companyList]
    .filter(c => c.avgSalary !== null)
    .sort((a, b) => b.avgSalary - a.avgSalary)
    .slice(0, 15);

  return {
    totalCompanies: Object.keys(companyData).length,
    topByCount: sortedByCount,
    topBySalary: sortedBySalary
  };
}

// ========== createSummary ==========
function createSummary(parsedData, dataSourceType = 'unknown') {
  const totalCount = parsedData.length;
  const newCount = parsedData.filter(d => d.isNew === '新着' || d.isNew === 'NEW').length;

  const salaryValues = parsedData
    .filter(d => d.salaryParsed && d.salaryParsed.unifiedMonthly)
    .map(d => d.salaryParsed.unifiedMonthly);

  const withSalaryCount = salaryValues.length;

  const fullTimeCount = parsedData.filter(d =>
    d.employmentParsed && (d.employmentParsed.subcategory === '正社員' || d.employmentParsed.type === '正社員')
  ).length;

  let avgMonthlySalary = null;
  let medianMonthlySalary = null;
  if (salaryValues.length > 0) {
    avgMonthlySalary = Math.round(salaryValues.reduce((a, b) => a + b, 0) / salaryValues.length);
    const sorted = [...salaryValues].sort((a, b) => a - b);
    medianMonthlySalary = sorted[Math.floor(sorted.length / 2)];
  }

  const isIndeed = dataSourceType === 'indeed';
  const isKyujinBox = dataSourceType === 'kyujin_box';

  // 年間休日データの有無を確認
  const hasAnnualHolidaysData = parsedData.some(d => d.annualHolidays && d.annualHolidays > 0);

  return {
    totalCount,
    newCount,
    newRate: totalCount > 0 ? Math.round((newCount / totalCount) * 100 * 10) / 10 : 0,
    withSalaryCount,
    avgMonthlySalary,
    medianMonthlySalary,
    fullTimeCount,
    fullTimeRate: totalCount > 0 ? Math.round((fullTimeCount / totalCount) * 100) : 0,
    dataSourceType,
    isIndeed,
    isKyujinBox,
    hasAnnualHolidaysData
  };
}

console.log('Test functions loaded');
