/**
 * 実際のApiHandler.jsを使用したレポート生成テスト
 * GAS APIをモックして実コードをそのまま実行
 */

const fs = require('fs');
const path = require('path');

// ============================================================
// GAS API モック
// ============================================================
global.Utilities = {
  formatDate: (date, tz, format) => new Date().toLocaleString('ja-JP')
};

// ============================================================
// ApiHandler.jsから関数を行番号で抽出
// ============================================================

const apiHandlerPath = path.join(__dirname, '..', 'ApiHandler.js');
const lines = fs.readFileSync(apiHandlerPath, 'utf8').split('\n');

// createBarChartSvg: 約行1337-1363
// createHorizontalBarSvg: 約行1365-1391
// createPdfReportHtml: 行1286-1992

// 関数を検索して抽出
function extractFunction(lines, funcName) {
  let startLine = -1;
  let braceCount = 0;
  let inFunction = false;
  let result = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (!inFunction && line.includes('function ' + funcName + '(')) {
      startLine = i;
      inFunction = true;
    }

    if (inFunction) {
      result.push(line);
      braceCount += (line.match(/\{/g) || []).length;
      braceCount -= (line.match(/\}/g) || []).length;

      if (braceCount === 0 && result.length > 1) {
        break;
      }
    }
  }

  return result.join('\n');
}

// 関数を抽出
const createBarChartSvgCode = extractFunction(lines, 'createBarChartSvg');
const createHorizontalBarSvgCode = extractFunction(lines, 'createHorizontalBarSvg');
const createPdfReportHtmlCode = extractFunction(lines, 'createPdfReportHtml');

console.log('createBarChartSvg: ' + createBarChartSvgCode.split('\n').length + '行');
console.log('createHorizontalBarSvg: ' + createHorizontalBarSvgCode.split('\n').length + '行');
console.log('createPdfReportHtml: ' + createPdfReportHtmlCode.split('\n').length + '行');

if (!createPdfReportHtmlCode || createPdfReportHtmlCode.length < 100) {
  console.error('❌ createPdfReportHtml関数の抽出に失敗');
  process.exit(1);
}

// 関数を評価（グローバルスコープに定義される）
const fullCode = createBarChartSvgCode + '\n\n' + createHorizontalBarSvgCode + '\n\n' + createPdfReportHtmlCode;

try {
  eval(fullCode);
  console.log('\n✅ 実際のcreatePdfReportHtml関数を読み込み成功\n');
} catch (e) {
  console.error('❌ 関数の評価に失敗:', e.message);
  console.error('エラー位置:', e.stack);
  process.exit(1);
}

// ============================================================
// テスト用モックデータ（実際のGASと同じ構造）
// ============================================================

const mockDashboardData = {
  summary: {
    totalCount: 1234,
    validSalaryCount: 1100,
    avgMonthlySalary: 253000,
    medianMonthlySalary: 245000,
    modeRange: '23-25万',
    fullTimeRate: 65,
    newRate: 12
  },
  salaryData: {
    validCount: 1100,
    histogram: {
      labels: ['15-20万', '20-25万', '25-30万', '30-35万', '35-40万', '40-45万', '45-50万'],
      values: [120, 450, 320, 150, 80, 50, 30]
    },
    minMaxHistograms: {
      labels: ['15万', '20万', '25万', '30万', '35万', '40万'],
      minHistogram: [200, 400, 250, 150, 70, 30],
      maxHistogram: [50, 200, 350, 280, 150, 70],
      stats: {
        minMean: 235000,
        minMedian: 230000,
        maxMean: 295000,
        maxMedian: 285000
      }
    },
    byEmploymentType: {
      '正社員': { count: 800, mean: 280000, median: 270000, min: 200000, max: 500000 },
      '契約社員': { count: 200, mean: 250000, median: 245000, min: 180000, max: 400000 },
      'パート': { count: 150, mean: 160000, median: 155000, min: 120000, max: 200000 },
      '派遣社員': { count: 84, mean: 240000, median: 235000, min: 190000, max: 350000 }
    }
  },
  locationData: {
    topCities: {
      '渋谷区': 150, '新宿区': 130, '港区': 120, '千代田区': 100, '中央区': 95,
      '品川区': 80, '豊島区': 70, '台東区': 60, '文京区': 55, '目黒区': 50
    },
    prefectureDistribution: {
      nonZero: {
        '東京都': 800, '神奈川県': 150, '大阪府': 100, '愛知県': 80, '福岡県': 50,
        '埼玉県': 40, '千葉県': 35, '北海道': 30, '京都府': 25, '兵庫県': 24
      }
    },
    regionBlockDistribution: {
      '関東': 1000, '近畿': 150, '中部': 100, '九州・沖縄': 60, '北海道・東北': 40
    }
  },
  employmentData: {
    subcategoryDistribution: {
      '正社員': 800, '契約社員': 200, 'パート': 150, '派遣社員': 84
    }
  },
  tagData: {
    topTags: [
      { tag: '交通費支給', count: 900 },
      { tag: '社会保険完備', count: 850 },
      { tag: '未経験可', count: 700 },
      { tag: 'リモート可', count: 400 },
      { tag: '土日祝休', count: 600 },
      { tag: '残業少なめ', count: 350 },
      { tag: '駅チカ', count: 500 },
      { tag: '賞与あり', count: 450 },
      { tag: '昇給あり', count: 400 },
      { tag: '制服貸与', count: 200 },
      { tag: 'シフト制', count: 180 },
      { tag: '週休2日', count: 550 },
      { tag: '研修あり', count: 320 },
      { tag: '資格取得支援', count: 150 },
      { tag: '寮完備', count: 80 }
    ],
    categoryDistribution: {
      '待遇': 2000,
      '勤務形態': 1500,
      '職場環境': 800,
      'スキル': 600,
      'その他': 300
    }
  },
  targetSalary: {
    targets: [
      { name: '営業職', salaryMin: 250000, salaryMax: 400000, positionAll: 0.65 },
      { name: 'エンジニア', salaryMin: 300000, salaryMax: 600000, positionAll: 0.45 }
    ],
    combined: { min: 250000, max: 600000 }
  },
  annualHolidaysData: {
    hasData: true,
    validCount: 800,
    totalCount: 1234,
    stats: {
      mean: 118,
      median: 120,
      min: 90,
      max: 140
    },
    categoryDistribution: {
      '120〜124日': 250,
      '125〜129日': 180,
      '115〜119日': 150,
      '105〜114日': 120,
      '130日〜': 60,
      '90〜104日': 40
    }
  },
  salaryBinning: {
    monthly: {
      labels: ['20.0万', '20.5万', '21.0万', '21.5万', '22.0万', '22.5万', '23.0万', '23.5万', '24.0万', '24.5万', '25.0万'],
      values: [30, 45, 60, 80, 95, 110, 130, 120, 100, 85, 70],
      stats: {
        count: 925,
        mean: '23.2万円',
        median: '23.0万円',
        modeLabel: '23.0万〜23.5万円'
      }
    },
    hourly: {
      labels: ['1000円', '1050円', '1100円', '1150円', '1200円', '1250円', '1300円', '1350円', '1400円', '1450円'],
      values: [20, 35, 55, 70, 85, 75, 60, 45, 30, 25],
      stats: {
        count: 500,
        mean: '1,185円',
        median: '1,150円',
        modeLabel: '1,200円〜1,250円'
      }
    }
  },
  _precomputedAt: new Date().toISOString()
};

const mockMapData = {
  targets: [
    { name: '営業職', salaryMin: 250000, salaryMax: 400000, positionAll: 0.65 },
    { name: 'エンジニア', salaryMin: 300000, salaryMax: 600000, positionAll: 0.45 }
  ],
  cities: [],
  inflowAnalysis: {
    targetCities: [
      {
        cityName: '渋谷区',
        totalJobs: 150,
        inflowRate: 35,
        topSourcePrefectures: [
          { prefecture: '神奈川県', count: 25 },
          { prefecture: '埼玉県', count: 15 },
          { prefecture: '千葉県', count: 12 }
        ]
      }
    ]
  }
};

const mockAnalysisData = {
  companyAnalysis: {
    totalCompanies: 350,
    topByCount: [
      { name: '株式会社ABC', jobCount: 45, avgSalaryMan: 28 },
      { name: '株式会社XYZ', jobCount: 38, avgSalaryMan: 32 },
      { name: '株式会社DEF', jobCount: 30, avgSalaryMan: 25 }
    ],
    topBySalary: [
      { name: '株式会社ハイテク', avgSalaryMan: 55, jobCount: 12 },
      { name: '株式会社プレミアム', avgSalaryMan: 48, jobCount: 8 }
    ]
  },
  tagSalaryAnalysis: {
    overallAvgMan: 25,
    tagCorrelations: [
      { tag: 'リモート可', count: 400, avgSalaryMan: 32, diffFromAvg: 70000, diffFromAvgMan: 7, diffPercent: 28 },
      { tag: '未経験可', count: 700, avgSalaryMan: 22, diffFromAvg: -30000, diffFromAvgMan: -3, diffPercent: -12 }
    ],
    combinations: [
      { combination: 'リモート可 + フレックス', count: 100, avgSalaryMan: 38, diffFromAvg: 130000, diffFromAvgMan: 13 }
    ]
  },
  jobSeekerAnalysis: {
    salaryRangePerception: {
      conservativeEstimate: 230000,
      optimisticEstimate: 310000,
      psychologicalMidpoint: 270000,
      interpretation: '求職者は平均的に27万円程度の収入を期待',
      rangeSpreadAnalysis: {
        '狭い（5万未満）': { count: 400, percent: 36 },
        '中程度（5-10万）': { count: 500, percent: 45 },
        '広い（10万以上）': { count: 200, percent: 18 }
      }
    },
    newListingsAnalysis: {
      newListings: { count: 148, percent: 12, avgSalaryMan: 27 },
      existingListings: { count: 1086, percent: 88, avgSalaryMan: 25 },
      salaryDifference: 20000,
      interpretation: '新着求人は既存求人より約2万円高い'
    },
    inexperiencedTagAnalysis: {
      hasData: true,
      withInexperienced: {
        count: 700,
        minSalary: { meanMan: 21, medianMan: 20 },
        maxSalary: { meanMan: 27, medianMan: 26 }
      },
      withoutInexperienced: {
        count: 534,
        minSalary: { meanMan: 26, medianMan: 25 },
        maxSalary: { meanMan: 34, medianMan: 32 }
      },
      difference: { minMan: -5, maxMan: -7 }
    }
  }
};

// ============================================================
// テスト実行
// ============================================================

console.log('========================================');
console.log('実際のApiHandler.jsを使用したレポートテスト');
console.log('========================================\n');

let html;
try {
  html = createPdfReportHtml(mockDashboardData, mockMapData, mockAnalysisData);
  console.log('✅ レポートHTML生成成功');
} catch (e) {
  console.error('❌ レポート生成エラー:', e.message);
  console.error(e.stack);
  process.exit(1);
}

// ファイル出力
const outputPath = path.join(__dirname, 'generated_actual_report.html');
fs.writeFileSync(outputPath, html, 'utf8');
console.log('📄 出力: ' + outputPath);
console.log('📊 HTMLサイズ: ' + (html.length / 1024).toFixed(1) + ' KB\n');

// テスト
let passed = 0, failed = 0;
function test(condition, msg) {
  if (condition) { passed++; console.log('✅ ' + msg); }
  else { failed++; console.log('❌ ' + msg); }
}

console.log('=== セクション確認 ===');
test(html.includes('サマリー'), 'サマリーセクション');
test(html.includes('検索対象'), '検索対象セクション');
test(html.includes('給与分布'), '給与分布セクション');
test(html.includes('雇用形態'), '雇用形態セクション');
test(html.includes('地域分析'), '地域分析セクション');
test(html.includes('流入分析') || html.includes('人材流入'), '流入分析セクション');
test(html.includes('企業分析'), '企業分析セクション');
test(html.includes('タグ分析'), 'タグ分析セクション');
test(html.includes('タグと給与'), 'タグ相関セクション');
test(html.includes('求職者'), '求職者視点セクション');
test(html.includes('年間休日'), '年間休日セクション');
test(html.includes('給与詳細分布') || html.includes('5,000円刻み'), '給与ビニングセクション');

console.log('\n=== 編集機能確認 ===');
test(html.includes('contenteditable'), 'contenteditable属性');
test(html.includes('<script>'), '編集用スクリプト');

console.log('\n========================================');
console.log('結果: ' + passed + '/' + (passed + failed) + ' 合格');
console.log('========================================\n');

console.log('ブラウザで確認: file:///' + outputPath.replace(/\\/g, '/'));
