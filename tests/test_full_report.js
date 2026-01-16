/**
 * 完全なレポート生成テスト
 * 実際のApiHandler.jsと同じデータ構造を使用
 */

const fs = require('fs');
const path = require('path');

// テスト結果
let testResults = { passed: 0, failed: 0 };

function assert(condition, testId, message) {
  if (condition) {
    testResults.passed++;
    console.log('✅ ' + testId + ': ' + message);
  } else {
    testResults.failed++;
    console.log('❌ ' + testId + ': ' + message);
  }
}

// ============================================================
// 実際のレポートと同じモックデータ（12セクション分）
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
      { tag: '制服貸与', count: 200 }
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
    },
    salaryCorrelation: {
      labels: ['20万', '22.5万', '25万', '27.5万', '30万'],
      avgHolidays: [112, 115, 118, 120, 122]
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
  cities: [
    { name: '渋谷区', count: 150, lat: 35.6636, lng: 139.6983 },
    { name: '新宿区', count: 130, lat: 35.6938, lng: 139.7034 }
  ],
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
      { name: '株式会社プレミアム', avgSalaryMan: 48, jobCount: 8 },
      { name: '株式会社エリート', avgSalaryMan: 45, jobCount: 15 }
    ]
  },
  tagSalaryAnalysis: {
    overallAvgMan: 25,
    tagCorrelations: [
      { tag: 'リモート可', count: 400, avgSalaryMan: 32, diffFromAvg: 70000, diffFromAvgMan: 7, diffPercent: 28 },
      { tag: 'フレックス', count: 200, avgSalaryMan: 30, diffFromAvg: 50000, diffFromAvgMan: 5, diffPercent: 20 },
      { tag: '未経験可', count: 700, avgSalaryMan: 22, diffFromAvg: -30000, diffFromAvgMan: -3, diffPercent: -12 }
    ],
    combinations: [
      { combination: 'リモート可 + フレックス', count: 100, avgSalaryMan: 38, diffFromAvg: 130000, diffFromAvgMan: 13 },
      { combination: '土日祝休 + 賞与あり', count: 250, avgSalaryMan: 30, diffFromAvg: 50000, diffFromAvgMan: 5 }
    ]
  },
  jobSeekerAnalysis: {
    salaryRangePerception: {
      conservativeEstimate: 230000,
      optimisticEstimate: 310000,
      psychologicalMidpoint: 270000,
      interpretation: '求職者は平均的に27万円程度の収入を期待している傾向',
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
      interpretation: '新着求人は既存求人より約2万円高い傾向'
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
// レポート生成関数（ApiHandler.jsから移植）
// ============================================================

function formatSalary(val) {
  return val ? Math.round(val / 10000) + '万円' : '-';
}

function createBarChartSvg(labels, values, title, color, width, height) {
  if (!labels || labels.length === 0) return '<p>データなし</p>';
  const maxVal = Math.max(...values, 1);
  const barWidth = Math.max(15, Math.floor((width - 80) / labels.length) - 2);
  const chartHeight = height - 60;

  let svg = '<svg width="' + width + '" height="' + height + '" style="background:#fafafa;border-radius:8px;">';
  svg += '<text x="' + (width/2) + '" y="20" text-anchor="middle" font-size="14" font-weight="bold">' + title + '</text>';

  labels.forEach((label, i) => {
    const barHeight = (values[i] / maxVal) * chartHeight;
    const x = 50 + i * (barWidth + 2);
    const y = height - 40 - barHeight;

    svg += '<rect x="' + x + '" y="' + y + '" width="' + barWidth + '" height="' + barHeight + '" fill="' + color + '" rx="2"/>';
    if (values[i] > 0) {
      svg += '<text x="' + (x + barWidth/2) + '" y="' + (y - 3) + '" text-anchor="middle" font-size="9">' + values[i] + '</text>';
    }
  });

  svg += '</svg>';
  return svg;
}

function createHorizontalBarSvg(items, title, width, height) {
  if (!items || items.length === 0) return '<p>データなし</p>';
  const maxVal = Math.max(...items.map(i => i.value), 1);
  const barHeight = Math.min(25, Math.floor((height - 50) / items.length) - 5);

  let svg = '<svg width="' + width + '" height="' + height + '" style="background:#fafafa;border-radius:8px;">';
  svg += '<text x="' + (width/2) + '" y="20" text-anchor="middle" font-size="14" font-weight="bold">' + title + '</text>';

  items.forEach((item, i) => {
    const barW = (item.value / maxVal) * (width - 200);
    const y = 40 + i * (barHeight + 5);
    svg += '<text x="90" y="' + (y + barHeight/2 + 4) + '" text-anchor="end" font-size="11">' + item.label + '</text>';
    svg += '<rect x="95" y="' + y + '" width="' + barW + '" height="' + barHeight + '" fill="' + item.color + '" rx="3"/>';
    svg += '<text x="' + (100 + barW + 5) + '" y="' + (y + barHeight/2 + 4) + '" font-size="10">' + item.value + '件</text>';
  });

  svg += '</svg>';
  return svg;
}

// レポートHTML生成（全12セクション）
function generateReportHtml(dashboardData, mapData, analysisData) {
  const summary = dashboardData.summary || {};
  const salaryData = dashboardData.salaryData || {};
  const locationData = dashboardData.locationData || {};
  const employmentData = dashboardData.employmentData || {};
  const tagData = dashboardData.tagData || {};
  const targetSalary = dashboardData.targetSalary || {};
  const annualHolidaysData = dashboardData.annualHolidaysData || {};
  const salaryBinning = dashboardData.salaryBinning || {};

  const companyData = analysisData?.companyAnalysis || {};
  const tagSalaryData = analysisData?.tagSalaryAnalysis || {};
  const jobSeekerData = analysisData?.jobSeekerAnalysis || null;

  const targets = mapData?.targets || [];
  const inflowAnalysis = mapData?.inflowAnalysis || {};

  const now = new Date().toLocaleString('ja-JP');

  const histogram = salaryData.histogram || { labels: [], values: [] };
  const minMaxHistograms = salaryData.minMaxHistograms || { labels: [], minHistogram: [], maxHistogram: [], stats: {} };
  const byEmploymentType = salaryData.byEmploymentType || {};

  const topCities = Object.entries(locationData.topCities || {}).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const prefDistribution = Object.entries(locationData.prefectureDistribution?.nonZero || {}).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const empDistribution = Object.entries(employmentData.subcategoryDistribution || {}).filter(([k]) => k !== '不明').sort((a, b) => b[1] - a[1]);
  const regionDistribution = Object.entries(locationData.regionBlockDistribution || {}).filter(([k]) => k !== '不明').sort((a, b) => b[1] - a[1]);
  const tagCategories = Object.entries(tagData.categoryDistribution || {}).sort((a, b) => b[1] - a[1]);

  let html = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <title>求人分析レポート</title>
  <style>
    body { font-family: 'Meiryo', sans-serif; max-width: 1100px; margin: 0 auto; padding: 20px; background: #fff; color: #333; }
    h1, h2, h3 { color: #1a73e8; }
    .section { background: #fff; border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px; margin: 20px 0; }
    .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; }
    .summary-card { background: #e3f2fd; padding: 15px; border-radius: 8px; text-align: center; }
    .summary-card .value { font-size: 24px; font-weight: bold; color: #1565c0; }
    .summary-card .label { font-size: 12px; color: #666; }
    .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin: 15px 0; }
    .stat-box { background: #f5f5f5; padding: 15px; border-radius: 8px; text-align: center; }
    .stat-value { font-size: 20px; font-weight: bold; color: #1a73e8; }
    .stat-label { font-size: 11px; color: #666; margin-top: 5px; }
    table { width: 100%; border-collapse: collapse; margin: 15px 0; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; }
    th { background: #f5f5f5; }
    .two-column { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    .highlight-box { background: #e8f5e9; border-left: 4px solid #4caf50; padding: 15px; margin: 15px 0; border-radius: 0 8px 8px 0; }
    .target-card { background: #fff3e0; padding: 10px; border-radius: 8px; margin: 5px 0; }
    .positive { color: #4caf50; }
    .negative { color: #f44336; }
    .chart-container { margin: 15px 0; text-align: center; }
    .footer { text-align: center; color: #666; font-size: 11px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; }
    .editable { outline: none; }
    .editable:hover { background: rgba(26, 115, 232, 0.05); }
    .editable:focus { background: rgba(26, 115, 232, 0.1); border-radius: 4px; }
    .edit-guide { background: #e3f2fd; border: 1px solid #90caf9; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px; font-size: 13px; }
    @media print { .edit-guide { display: none; } }
  </style>
</head>
<body>
  <div class="edit-guide">
    <strong>📝 編集モード:</strong> テキストをクリックして編集。Ctrl+S で保存。
  </div>

  <h1>📊 求人分析レポート</h1>
  <p>生成日時: ${now}</p>

  <!-- 1. サマリー -->
  <div class="section">
    <h2>📈 サマリー</h2>
    <div class="summary-grid">
      <div class="summary-card"><div class="value">${(summary.totalCount || 0).toLocaleString()}</div><div class="label">総求人数</div></div>
      <div class="summary-card"><div class="value">${formatSalary(summary.avgMonthlySalary)}</div><div class="label">平均月給</div></div>
      <div class="summary-card"><div class="value">${summary.fullTimeRate || 0}%</div><div class="label">正社員率</div></div>
      <div class="summary-card"><div class="value">${summary.newRate || 0}%</div><div class="label">新着率</div></div>
    </div>
  </div>

  <!-- 2. 検索対象 -->
  ${targets.length > 0 ? `
  <div class="section">
    <h2>🎯 検索対象</h2>
    <p>設定された検索対象: <strong>${targets.length}件</strong></p>
    ${targets.map(t => `<div class="target-card"><strong>${t.name}</strong><br>希望給与: ${t.salaryMin ? Math.round(t.salaryMin/10000) + '万' : '-'} ～ ${t.salaryMax ? Math.round(t.salaryMax/10000) + '万円' : '-'}</div>`).join('')}
  </div>
  ` : ''}

  <!-- 3. 給与分布 -->
  <div class="section">
    <h2>💰 給与分布</h2>
    <div class="stats-grid">
      <div class="stat-box"><div class="stat-value">${formatSalary(summary.avgMonthlySalary)}</div><div class="stat-label">平均月給</div></div>
      <div class="stat-box"><div class="stat-value">${formatSalary(summary.medianMonthlySalary)}</div><div class="stat-label">中央値</div></div>
      <div class="stat-box"><div class="stat-value">${summary.modeRange || '-'}</div><div class="stat-label">最頻値帯</div></div>
    </div>
    <div class="chart-container">
      ${createBarChartSvg(histogram.labels, histogram.values, '月給分布', '#4285f4', 700, 250)}
    </div>
  </div>

  <!-- 4. 雇用形態 -->
  <div class="section">
    <h2>👔 雇用形態分布</h2>
    <div class="chart-container">
      ${createHorizontalBarSvg(empDistribution.slice(0, 8).map(([type, count]) => ({ label: type, value: count, color: '#1a73e8' })), '雇用形態別', 600, 250)}
    </div>
    ${Object.keys(byEmploymentType).length > 0 ? `
    <table>
      <tr><th>雇用形態</th><th>件数</th><th>平均月給</th><th>中央値</th></tr>
      ${Object.entries(byEmploymentType).sort((a, b) => (b[1].mean || 0) - (a[1].mean || 0)).map(([type, stats]) => `
      <tr><td>${type}</td><td>${stats.count}件</td><td><strong>${stats.mean ? Math.round(stats.mean / 10000) + '万円' : '-'}</strong></td><td>${stats.median ? Math.round(stats.median / 10000) + '万円' : '-'}</td></tr>`).join('')}
    </table>
    ` : ''}
  </div>

  <!-- 5. 地域分析 -->
  <div class="section">
    <h2>📍 地域分析</h2>
    <div class="two-column">
      <div>
        <h3>地域ブロック別</h3>
        ${createHorizontalBarSvg(regionDistribution.slice(0, 6).map(([r, c]) => ({ label: r, value: c, color: '#26a69a' })), '', 400, 200)}
      </div>
      <div>
        <h3>都道府県TOP10</h3>
        <table><tr><th>都道府県</th><th>件数</th></tr>
        ${prefDistribution.map(([pref, count]) => `<tr><td>${pref}</td><td>${count}件</td></tr>`).join('')}
        </table>
      </div>
    </div>
    <h3>市区町村TOP10</h3>
    <table><tr><th>順位</th><th>市区町村</th><th>件数</th></tr>
    ${topCities.map(([city, count], i) => `<tr><td>${i + 1}</td><td>${city}</td><td>${count}件</td></tr>`).join('')}
    </table>
  </div>

  <!-- 6. 流入分析 -->
  ${inflowAnalysis.targetCities ? `
  <div class="section">
    <h2>🔄 人材流入分析</h2>
    ${inflowAnalysis.targetCities.map(tc => `
    <div class="highlight-box">
      <h3 style="margin-top:0;">${tc.cityName}</h3>
      <p>総求人数: <strong>${tc.totalJobs}件</strong> / 流入率: <strong>${tc.inflowRate}%</strong></p>
      ${tc.topSourcePrefectures?.length > 0 ? `<p>主な流入元: ${tc.topSourcePrefectures.slice(0, 3).map(p => p.prefecture + '(' + p.count + '件)').join(', ')}</p>` : ''}
    </div>
    `).join('')}
  </div>
  ` : ''}

  <!-- 7. 企業分析 -->
  <div class="section">
    <h2>🏢 企業分析</h2>
    <p>総企業数: <strong>${companyData.totalCompanies || 0}社</strong></p>
    <div class="two-column">
      <div>
        <h3>求人数ランキング</h3>
        <table><tr><th>#</th><th>企業名</th><th>求人数</th><th>平均給与</th></tr>
        ${(companyData.topByCount || []).slice(0, 10).map((c, i) => `<tr><td>${i + 1}</td><td>${c.name}</td><td>${c.jobCount}件</td><td>${c.avgSalaryMan}万円</td></tr>`).join('')}
        </table>
      </div>
      <div>
        <h3>平均給与ランキング</h3>
        <table><tr><th>#</th><th>企業名</th><th>平均給与</th><th>求人数</th></tr>
        ${(companyData.topBySalary || []).slice(0, 10).map((c, i) => `<tr><td>${i + 1}</td><td>${c.name}</td><td><strong>${c.avgSalaryMan}万円</strong></td><td>${c.jobCount}件</td></tr>`).join('')}
        </table>
      </div>
    </div>
  </div>

  <!-- 8. タグ分析 -->
  <div class="section">
    <h2>🏷️ タグ分析</h2>
    <div class="two-column">
      <div>
        <h3>人気タグTOP10</h3>
        ${createHorizontalBarSvg((tagData.topTags || []).slice(0, 10).map(t => ({ label: t.tag, value: t.count, color: '#7e57c2' })), '', 400, 300)}
      </div>
      <div>
        <h3>タグカテゴリ別</h3>
        <table><tr><th>カテゴリ</th><th>該当件数</th></tr>
        ${tagCategories.map(([cat, count]) => `<tr><td>${cat}</td><td>${count}件</td></tr>`).join('')}
        </table>
      </div>
    </div>
  </div>

  <!-- 9. タグと給与の相関 -->
  <div class="section">
    <h2>💡 タグと給与の相関</h2>
    <p>全体平均月給: <strong>${tagSalaryData.overallAvgMan || 0}万円</strong></p>
    <table>
      <tr><th>タグ</th><th>件数</th><th>平均給与</th><th>全体比</th></tr>
      ${(tagSalaryData.tagCorrelations || []).slice(0, 10).map(t => `
      <tr>
        <td>${t.tag}</td>
        <td>${t.count}件</td>
        <td><strong>${t.avgSalaryMan}万円</strong></td>
        <td class="${t.diffFromAvg >= 0 ? 'positive' : 'negative'}">${t.diffFromAvg >= 0 ? '+' : ''}${t.diffFromAvgMan}万円 (${t.diffFromAvg >= 0 ? '+' : ''}${t.diffPercent}%)</td>
      </tr>`).join('')}
    </table>
  </div>

  <!-- 10. 求職者視点分析 -->
  ${jobSeekerData ? `
  <div class="section">
    <h2>👤 求職者視点分析</h2>
    ${jobSeekerData.salaryRangePerception ? `
    <div class="highlight-box">
      <h3>給与レンジの心理的解釈</h3>
      <div class="stats-grid">
        <div class="stat-box"><div class="stat-value">${Math.round((jobSeekerData.salaryRangePerception.conservativeEstimate || 0) / 10000)}万円</div><div class="stat-label">控えめ予測</div></div>
        <div class="stat-box"><div class="stat-value">${Math.round((jobSeekerData.salaryRangePerception.optimisticEstimate || 0) / 10000)}万円</div><div class="stat-label">楽観的予測</div></div>
        <div class="stat-box"><div class="stat-value">${Math.round((jobSeekerData.salaryRangePerception.psychologicalMidpoint || 0) / 10000)}万円</div><div class="stat-label">心理的中点</div></div>
      </div>
      <p style="font-size:12px;color:#666;">${jobSeekerData.salaryRangePerception.interpretation || ''}</p>
    </div>
    ` : ''}
    ${jobSeekerData.newListingsAnalysis ? `
    <div class="highlight-box" style="background:#fff3e0;border-left-color:#ff9800;">
      <h3>新着求人の特徴</h3>
      <p>新着: ${jobSeekerData.newListingsAnalysis.newListings?.count || 0}件 (${jobSeekerData.newListingsAnalysis.newListings?.percent || 0}%) / 平均: ${jobSeekerData.newListingsAnalysis.newListings?.avgSalaryMan || '-'}万円</p>
      <p>既存: ${jobSeekerData.newListingsAnalysis.existingListings?.count || 0}件 / 平均: ${jobSeekerData.newListingsAnalysis.existingListings?.avgSalaryMan || '-'}万円</p>
    </div>
    ` : ''}
  </div>
  ` : ''}

  <!-- 11. 年間休日分析 -->
  ${annualHolidaysData.hasData ? `
  <div class="section">
    <h2>📅 年間休日分析</h2>
    <p>有効データ: <strong>${annualHolidaysData.validCount || 0}件</strong>（全${annualHolidaysData.totalCount || 0}件中）</p>
    <div class="stats-grid">
      <div class="stat-box"><div class="stat-value">${annualHolidaysData.stats?.mean || '-'}日</div><div class="stat-label">平均年間休日</div></div>
      <div class="stat-box"><div class="stat-value">${annualHolidaysData.stats?.median || '-'}日</div><div class="stat-label">中央値</div></div>
      <div class="stat-box"><div class="stat-value">${annualHolidaysData.stats?.min || '-'}〜${annualHolidaysData.stats?.max || '-'}日</div><div class="stat-label">範囲</div></div>
    </div>
    <table>
      <tr><th>カテゴリ</th><th>件数</th><th>割合</th></tr>
      ${Object.entries(annualHolidaysData.categoryDistribution || {}).map(([cat, count]) => {
        const pct = annualHolidaysData.validCount > 0 ? Math.round(count / annualHolidaysData.validCount * 100) : 0;
        return `<tr><td>${cat}</td><td>${count}件</td><td>${pct}%</td></tr>`;
      }).join('')}
    </table>
  </div>
  ` : ''}

  <!-- 12. 給与詳細分布（ビニング） -->
  ${salaryBinning.monthly?.labels?.length > 0 || salaryBinning.hourly?.labels?.length > 0 ? `
  <div class="section">
    <h2>💹 給与詳細分布</h2>
    ${salaryBinning.monthly?.labels?.length > 0 ? `
    <h3>月給分布（5,000円刻み）</h3>
    <div class="stats-grid">
      <div class="stat-box"><div class="stat-value">${salaryBinning.monthly.stats?.mean || '-'}</div><div class="stat-label">平均</div></div>
      <div class="stat-box"><div class="stat-value">${salaryBinning.monthly.stats?.median || '-'}</div><div class="stat-label">中央値</div></div>
      <div class="stat-box"><div class="stat-value">${salaryBinning.monthly.stats?.modeLabel || '-'}</div><div class="stat-label">最頻値帯</div></div>
    </div>
    <p style="font-size:12px;color:#666;">有効データ: ${salaryBinning.monthly.stats?.count || 0}件</p>
    <div class="chart-container">
      ${createBarChartSvg(salaryBinning.monthly.labels, salaryBinning.monthly.values, '月給分布', '#3498db', 700, 250)}
    </div>
    ` : ''}
    ${salaryBinning.hourly?.labels?.length > 0 ? `
    <h3>時給分布（50円刻み）</h3>
    <div class="stats-grid">
      <div class="stat-box"><div class="stat-value">${salaryBinning.hourly.stats?.mean || '-'}</div><div class="stat-label">平均</div></div>
      <div class="stat-box"><div class="stat-value">${salaryBinning.hourly.stats?.median || '-'}</div><div class="stat-label">中央値</div></div>
      <div class="stat-box"><div class="stat-value">${salaryBinning.hourly.stats?.modeLabel || '-'}</div><div class="stat-label">最頻値帯</div></div>
    </div>
    <p style="font-size:12px;color:#666;">有効データ: ${salaryBinning.hourly.stats?.count || 0}件</p>
    <div class="chart-container">
      ${createBarChartSvg(salaryBinning.hourly.labels, salaryBinning.hourly.values, '時給分布', '#e74c3c', 700, 250)}
    </div>
    ` : ''}
  </div>
  ` : ''}

  <div class="footer">
    <p>このレポートは求人データ分析ダッシュボードから自動生成されました</p>
    <p>データ件数: ${summary.totalCount || 0}件 / 企業数: ${companyData.totalCompanies || 0}社</p>
  </div>

  <script>
  (function() {
    var editableSelectors = 'h1, h2, h3, p, td, th, li, .stat-value, .stat-label, .value, .label, .summary-card, .highlight-box, .target-card';
    document.querySelectorAll(editableSelectors).forEach(function(el) {
      if (el.closest('svg') || el.classList.contains('edit-guide')) return;
      el.setAttribute('contenteditable', 'true');
      el.classList.add('editable');
    });
    document.addEventListener('keydown', function(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        var blob = new Blob([document.documentElement.outerHTML], {type: 'text/html'});
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'report_edited.html';
        a.click();
      }
    });
    document.querySelectorAll('.editable').forEach(function(el) {
      el.addEventListener('input', function() {
        this.style.borderBottom = '2px solid #ffc107';
      });
    });
  })();
  </script>
</body>
</html>`;

  return html;
}

// ============================================================
// テスト実行
// ============================================================

console.log('========================================');
console.log('完全なレポート生成テスト（12セクション）');
console.log('========================================\n');

// レポート生成
const html = generateReportHtml(mockDashboardData, mockMapData, mockAnalysisData);

// ファイル出力
const outputPath = path.join(__dirname, 'generated_full_report.html');
fs.writeFileSync(outputPath, html, 'utf8');
console.log('📄 レポート生成: ' + outputPath + '\n');

// テスト実行
console.log('=== セクション存在テスト ===');
assert(html.includes('サマリー'), 'S01', 'セクション1: サマリー');
assert(html.includes('検索対象'), 'S02', 'セクション2: 検索対象');
assert(html.includes('給与分布'), 'S03', 'セクション3: 給与分布');
assert(html.includes('雇用形態分布'), 'S04', 'セクション4: 雇用形態');
assert(html.includes('地域分析'), 'S05', 'セクション5: 地域分析');
assert(html.includes('人材流入分析'), 'S06', 'セクション6: 流入分析');
assert(html.includes('企業分析'), 'S07', 'セクション7: 企業分析');
assert(html.includes('タグ分析'), 'S08', 'セクション8: タグ分析');
assert(html.includes('タグと給与の相関'), 'S09', 'セクション9: タグ相関');
assert(html.includes('求職者視点分析'), 'S10', 'セクション10: 求職者視点');
assert(html.includes('年間休日分析'), 'S11', 'セクション11: 年間休日');
assert(html.includes('給与詳細分布'), 'S12', 'セクション12: 給与ビニング');

console.log('\n=== データ表示テスト ===');
assert(html.includes('1,234'), 'D01', '総求人数: 1,234');
assert(html.includes('25万円'), 'D02', '平均月給: 25万円');
assert(html.includes('65%'), 'D03', '正社員率: 65%');
assert(html.includes('営業職'), 'D04', '検索対象: 営業職');
assert(html.includes('エンジニア'), 'D05', '検索対象: エンジニア');
assert(html.includes('渋谷区'), 'D06', '地域: 渋谷区');
assert(html.includes('350社'), 'D07', '企業数: 350社');
assert(html.includes('株式会社ABC'), 'D08', '企業: ABC');
assert(html.includes('交通費支給'), 'D09', 'タグ: 交通費支給');
assert(html.includes('リモート可'), 'D10', 'タグ: リモート可');
assert(html.includes('118日'), 'D11', '年間休日平均: 118日');
assert(html.includes('23.2万円'), 'D12', 'ビニング平均: 23.2万円');

console.log('\n=== SVGグラフテスト ===');
const svgCount = (html.match(/<svg/g) || []).length;
assert(svgCount >= 5, 'G01', 'SVGグラフが5つ以上生成: ' + svgCount + '個');
assert(html.includes('月給分布'), 'G02', 'グラフタイトル: 月給分布');
assert(html.includes('fill="#4285f4"'), 'G03', '給与グラフ色: #4285f4');
assert(html.includes('fill="#1a73e8"'), 'G04', '雇用形態グラフ色: #1a73e8');
assert(html.includes('fill="#7e57c2"'), 'G05', 'タググラフ色: #7e57c2');

console.log('\n=== 編集機能テスト ===');
assert(html.includes('contenteditable'), 'E01', 'contenteditable属性あり');
assert(html.includes('edit-guide'), 'E02', '編集ガイドあり');
assert(html.includes("key === 's'"), 'E03', 'Ctrl+S保存機能あり');
assert(html.includes('#ffc107'), 'E04', '編集時の黄色下線スタイルあり');

console.log('\n=== 相関・分析データテスト ===');
assert(html.includes('+7万円'), 'A01', 'タグ相関: +7万円（リモート可）');
assert(html.includes('-3万円'), 'A02', 'タグ相関: -3万円（未経験可）');
assert(html.includes('23万円'), 'A03', '求職者分析: 控えめ予測23万円');
assert(html.includes('31万円'), 'A04', '求職者分析: 楽観的予測31万円');
assert(html.includes('新着求人'), 'A05', '新着求人分析セクションあり');

console.log('\n========================================');
console.log('テスト結果: ' + testResults.passed + '/' + (testResults.passed + testResults.failed) + ' 合格');
console.log('合格率: ' + Math.round(testResults.passed / (testResults.passed + testResults.failed) * 100) + '%');
console.log('========================================');

if (testResults.failed > 0) {
  console.log('\n❌ 失敗したテスト:');
  testResults.errors.forEach(e => console.log('  - ' + e));
}

console.log('\n📄 生成されたレポートをブラウザで確認してください:');
console.log('   ' + outputPath);
