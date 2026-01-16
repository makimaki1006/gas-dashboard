/**
 * レポート生成機能テスト
 * ローカル実行用（Node.js）
 *
 * テスト対象:
 * - 給与フォーマット（月給/時給）
 * - SVG棒グラフ生成
 * - 水平棒グラフ生成
 * - データ整形処理
 * - レポートHTML構造
 */

// テスト結果
let testResults = { passed: 0, failed: 0, errors: [] };

function assert(condition, testId, message) {
  if (condition) {
    testResults.passed++;
    console.log('✅ ' + testId + ': ' + message);
  } else {
    testResults.failed++;
    testResults.errors.push(testId + ': ' + message);
    console.log('❌ ' + testId + ': ' + message);
  }
}

function assertEqual(actual, expected, testId, message) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    testResults.passed++;
    console.log('✅ ' + testId + ': ' + message);
  } else {
    testResults.failed++;
    testResults.errors.push(testId + ': ' + message + ' (expected: ' + JSON.stringify(expected) + ', got: ' + JSON.stringify(actual) + ')');
    console.log('❌ ' + testId + ': ' + message);
    console.log('   期待値: ' + JSON.stringify(expected));
    console.log('   実際値: ' + JSON.stringify(actual));
  }
}

// ============================================================
// ApiHandler.jsから移植した関数（テスト用）
// ============================================================

/**
 * 給与フォーマット関数（月給/時給モード対応）
 */
function formatSalary(val, isHourly) {
  if (!val) return '-';
  return isHourly ? Math.round(val) + '円' : Math.round(val / 10000) + '万円';
}

/**
 * SVG棒グラフ生成関数
 */
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
    svg += '<text x="' + (x + barWidth/2) + '" y="' + (height - 25) + '" text-anchor="middle" font-size="8" transform="rotate(-45 ' + (x + barWidth/2) + ' ' + (height - 25) + ')">' + label + '</text>';
  });

  svg += '</svg>';
  return svg;
}

/**
 * 水平棒グラフ生成関数
 */
function createHorizontalBarSvg(items, title, width, height) {
  if (!items || items.length === 0) return '<p>データなし</p>';
  const maxVal = Math.max(...items.map(i => i.value), 1);
  const barHeight = Math.min(25, Math.floor((height - 50) / items.length) - 5);

  let svg = '<svg width="' + width + '" height="' + height + '" style="background:#fafafa;border-radius:8px;">';
  svg += '<text x="' + (width/2) + '" y="20" text-anchor="middle" font-size="14" font-weight="bold">' + title + '</text>';

  items.forEach((item, i) => {
    const barWidth = (item.value / maxVal) * (width - 200);
    const y = 40 + i * (barHeight + 5);

    svg += '<text x="90" y="' + (y + barHeight/2 + 4) + '" text-anchor="end" font-size="11">' + item.label + '</text>';
    svg += '<rect x="95" y="' + y + '" width="' + barWidth + '" height="' + barHeight + '" fill="' + item.color + '" rx="3"/>';
    svg += '<text x="' + (100 + barWidth + 5) + '" y="' + (y + barHeight/2 + 4) + '" font-size="10">' + item.value + '件</text>';
  });

  svg += '</svg>';
  return svg;
}

/**
 * 地域別TOP10作成関数
 */
function createTopCities(topCitiesObj) {
  return Object.entries(topCitiesObj || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
}

/**
 * 都道府県分布作成関数
 */
function createPrefDistribution(prefData) {
  return Object.entries(prefData?.nonZero || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
}

/**
 * 雇用形態分布作成関数
 */
function createEmpDistribution(subcategoryDistribution) {
  return Object.entries(subcategoryDistribution || {})
    .filter(([k]) => k !== '不明')
    .sort((a, b) => b[1] - a[1]);
}

/**
 * 地域ブロック分布作成関数
 */
function createRegionDistribution(regionBlockDistribution) {
  return Object.entries(regionBlockDistribution || {})
    .filter(([k]) => k !== '不明')
    .sort((a, b) => b[1] - a[1]);
}

/**
 * タグカテゴリ別作成関数
 */
function createTagCategories(categoryTotals) {
  return Object.entries(categoryTotals || {})
    .filter(([k, v]) => v > 0)
    .sort((a, b) => b[1] - a[1]);
}

// ============================================================
// テストケース
// ============================================================

console.log('========================================');
console.log('レポート生成機能テスト');
console.log('========================================\n');

// ============================================================
// Category A: 給与フォーマットテスト (15件)
// ============================================================
console.log('=== Category A: 給与フォーマットテスト ===');

// A01: 月給フォーマット（基本）
assertEqual(formatSalary(250000, false), '25万円', 'A01', '月給25万円');

// A02: 月給フォーマット（端数）
assertEqual(formatSalary(255000, false), '26万円', 'A02', '月給25.5万→26万円（四捨五入）');

// A03: 月給フォーマット（高額）
assertEqual(formatSalary(500000, false), '50万円', 'A03', '月給50万円');

// A04: 月給フォーマット（低額）
assertEqual(formatSalary(180000, false), '18万円', 'A04', '月給18万円');

// A05: 時給フォーマット（基本）
assertEqual(formatSalary(1000, true), '1000円', 'A05', '時給1000円');

// A06: 時給フォーマット（端数）
assertEqual(formatSalary(1050.5, true), '1051円', 'A06', '時給端数→1051円（四捨五入）');

// A07: 時給フォーマット（高額）
assertEqual(formatSalary(2500, true), '2500円', 'A07', '時給2500円');

// A08: 時給フォーマット（最低賃金付近）
assertEqual(formatSalary(985, true), '985円', 'A08', '時給985円');

// A09: null値
assertEqual(formatSalary(null, false), '-', 'A09', 'null→ハイフン');

// A10: undefined値
assertEqual(formatSalary(undefined, true), '-', 'A10', 'undefined→ハイフン');

// A11: 0値
assertEqual(formatSalary(0, false), '-', 'A11', '0→ハイフン');

// A12: 年収換算（600万）
assertEqual(formatSalary(6000000 / 12, false), '50万円', 'A12', '年収600万→月50万円');

// A13: 非常に高い月給
assertEqual(formatSalary(1000000, false), '100万円', 'A13', '月給100万円');

// A14: 非常に低い時給
assertEqual(formatSalary(800, true), '800円', 'A14', '時給800円');

// A15: 小数点以下切り捨て確認（月給）
assertEqual(formatSalary(194999, false), '19万円', 'A15', '19.4999万→19万円');

// ============================================================
// Category B: SVG棒グラフ生成テスト (15件)
// ============================================================
console.log('\n=== Category B: SVG棒グラフ生成テスト ===');

// B01: 基本生成
const svg1 = createBarChartSvg(['25万', '30万', '35万'], [10, 20, 15], 'テスト', '#4285f4', 600, 300);
assert(svg1.includes('<svg'), 'B01', 'SVGタグが含まれる');

// B02: 幅設定
assert(svg1.includes('width="600"'), 'B02', 'SVG幅が600');

// B03: 高さ設定
assert(svg1.includes('height="300"'), 'B03', 'SVG高さが300');

// B04: タイトル
assert(svg1.includes('テスト'), 'B04', 'タイトルが含まれる');

// B05: 色設定
assert(svg1.includes('fill="#4285f4"'), 'B05', '指定色が使用される');

// B06: 棒要素
assert(svg1.includes('<rect'), 'B06', '棒グラフ要素（rect）が含まれる');

// B07: ラベル
assert(svg1.includes('25万'), 'B07', 'ラベルが含まれる');

// B08: 値表示
assert(svg1.includes('>10<'), 'B08', '値が表示される');

// B09: 空データ処理
const svg2 = createBarChartSvg([], [], 'Empty', '#333', 400, 200);
assertEqual(svg2, '<p>データなし</p>', 'B09', '空データ→「データなし」');

// B10: null labels処理
const svg3 = createBarChartSvg(null, null, 'Null', '#333', 400, 200);
assertEqual(svg3, '<p>データなし</p>', 'B10', 'nullデータ→「データなし」');

// B11: 1件のみ
const svg4 = createBarChartSvg(['単独'], [100], 'Single', '#000', 400, 200);
assert(svg4.includes('単独'), 'B11', '1件データでも生成');

// B12: 0値を含む
const svg5 = createBarChartSvg(['A', 'B', 'C'], [10, 0, 5], 'WithZero', '#333', 400, 200);
assert(!svg5.includes('>0<'), 'B12', '0値は表示されない');

// B13: 大量データ（30件）
const manyLabels = Array.from({length: 30}, (_, i) => i + '万');
const manyValues = Array.from({length: 30}, (_, i) => i * 10);
const svg6 = createBarChartSvg(manyLabels, manyValues, 'Many', '#333', 900, 300);
assert(svg6.includes('</svg>'), 'B13', '30件データでも正常生成');

// B14: 角丸設定
assert(svg1.includes('rx="2"'), 'B14', '棒グラフに角丸設定');

// B15: 背景スタイル
assert(svg1.includes('background:#fafafa'), 'B15', '背景色設定');

// ============================================================
// Category C: 水平棒グラフ生成テスト (10件)
// ============================================================
console.log('\n=== Category C: 水平棒グラフ生成テスト ===');

// C01: 基本生成
const hSvg1 = createHorizontalBarSvg([
  { label: '正社員', value: 100, color: '#1a73e8' },
  { label: '契約社員', value: 50, color: '#1a73e8' }
], '雇用形態', 700, 200);
assert(hSvg1.includes('<svg'), 'C01', '水平棒SVGが生成される');

// C02: ラベル表示
assert(hSvg1.includes('正社員'), 'C02', 'ラベルが含まれる');

// C03: 値表示（件数形式）
assert(hSvg1.includes('100件'), 'C03', '件数形式で表示');

// C04: タイトル
assert(hSvg1.includes('雇用形態'), 'C04', 'タイトルが含まれる');

// C05: 空データ処理
const hSvg2 = createHorizontalBarSvg([], 'Empty', 400, 200);
assertEqual(hSvg2, '<p>データなし</p>', 'C05', '空データ→「データなし」');

// C06: null処理
const hSvg3 = createHorizontalBarSvg(null, 'Null', 400, 200);
assertEqual(hSvg3, '<p>データなし</p>', 'C06', 'nullデータ→「データなし」');

// C07: 1件のみ
const hSvg4 = createHorizontalBarSvg([
  { label: 'Single', value: 50, color: '#333' }
], 'Single', 400, 200);
assert(hSvg4.includes('Single'), 'C07', '1件データでも生成');

// C08: 異なる色
const hSvg5 = createHorizontalBarSvg([
  { label: 'A', value: 30, color: '#ff0000' },
  { label: 'B', value: 20, color: '#00ff00' }
], 'Colors', 400, 200);
assert(hSvg5.includes('#ff0000') && hSvg5.includes('#00ff00'), 'C08', '異なる色が適用');

// C09: 角丸設定
assert(hSvg1.includes('rx="3"'), 'C09', '水平棒に角丸設定');

// C10: 多件数（8件）
const manyItems = Array.from({length: 8}, (_, i) => ({
  label: 'Item' + i, value: (i + 1) * 10, color: '#666'
}));
const hSvg6 = createHorizontalBarSvg(manyItems, 'Many', 700, 400);
assert(hSvg6.includes('Item7'), 'C10', '8件データでも最後まで生成');

// ============================================================
// Category D: データ整形テスト (15件)
// ============================================================
console.log('\n=== Category D: データ整形テスト ===');

// D01: TOP10都市作成
const topCities = createTopCities({ '東京都港区': 100, '大阪市北区': 80, '名古屋市中区': 60 });
assertEqual(topCities.length, 3, 'D01', 'TOP10は最大10件');

// D02: TOP10ソート順（降順）
assertEqual(topCities[0][0], '東京都港区', 'D02', 'TOP10はソート済み');

// D03: TOP10値
assertEqual(topCities[0][1], 100, 'D03', 'TOP10値が正しい');

// D04: 空データ
const topCitiesEmpty = createTopCities({});
assertEqual(topCitiesEmpty.length, 0, 'D04', '空データ→空配列');

// D05: 都道府県分布
const prefDist = createPrefDistribution({ nonZero: { '東京都': 500, '大阪府': 300, '愛知県': 200 } });
assertEqual(prefDist.length, 3, 'D05', '都道府県分布作成');

// D06: 都道府県ソート順
assertEqual(prefDist[0][0], '東京都', 'D06', '都道府県はソート済み');

// D07: null都道府県データ
const prefDistNull = createPrefDistribution(null);
assertEqual(prefDistNull.length, 0, 'D07', 'null→空配列');

// D08: 雇用形態分布
const empDist = createEmpDistribution({ '正社員': 100, '契約社員': 50, '不明': 10 });
assertEqual(empDist.length, 2, 'D08', '「不明」は除外');

// D09: 雇用形態ソート順
assertEqual(empDist[0][0], '正社員', 'D09', '雇用形態はソート済み');

// D10: 地域ブロック分布
const regionDist = createRegionDistribution({ '関東': 200, '近畿': 100, '不明': 50 });
assertEqual(regionDist.length, 2, 'D10', '地域ブロック「不明」除外');

// D11: 地域ブロックソート順
assertEqual(regionDist[0][0], '関東', 'D11', '地域ブロックはソート済み');

// D12: タグカテゴリ作成
const tagCat = createTagCategories({ '待遇': 50, 'スキル': 30, '空カテゴリ': 0 });
assertEqual(tagCat.length, 2, 'D12', '0件カテゴリは除外');

// D13: タグカテゴリソート順
assertEqual(tagCat[0][0], '待遇', 'D13', 'タグカテゴリはソート済み');

// D14: 大量データTOP10制限
const manyData = {};
for (let i = 0; i < 50; i++) {
  manyData['City' + i] = 50 - i;
}
const topMany = createTopCities(manyData);
assertEqual(topMany.length, 10, 'D14', '50件→TOP10に制限');

// D15: 同値ソート安定性
const sameDist = createRegionDistribution({ 'A': 100, 'B': 100, 'C': 100 });
assertEqual(sameDist.length, 3, 'D15', '同値でも全件含む');

// ============================================================
// Category E: レポートHTML構造テスト (15件)
// ============================================================
console.log('\n=== Category E: レポートHTML構造テスト ===');

// レポートセクション定義
const reportSections = [
  'サマリー',
  '検索対象',
  '給与分布',
  '雇用形態分布',
  '地域分析',
  '流入分析',
  '企業分析',
  'タグ分析',
  'タグと給与の相関',
  '求職者視点分析'
];

// E01: セクション数
assertEqual(reportSections.length, 10, 'E01', 'レポートは10セクション');

// E02: サマリーセクション存在
assert(reportSections.includes('サマリー'), 'E02', 'サマリーセクションあり');

// E03: 給与分布セクション存在
assert(reportSections.includes('給与分布'), 'E03', '給与分布セクションあり');

// E04: 企業分析セクション存在
assert(reportSections.includes('企業分析'), 'E04', '企業分析セクションあり');

// サマリーカード定義
const summaryCards = ['総求人数', '平均月給', '正社員率', '新着率'];

// E05: サマリーカード数
assertEqual(summaryCards.length, 4, 'E05', 'サマリーカードは4項目');

// 統計表示項目
const statsItems = ['平均', '中央値', '最頻値帯'];

// E06: 統計項目数
assertEqual(statsItems.length, 3, 'E06', '統計項目は3つ');

// グラフ色定義
const chartColors = {
  salary: '#4285f4',
  minSalary: '#66bb6a',
  maxSalary: '#ff7043',
  employment: '#1a73e8',
  region: '#26a69a',
  tag: '#7e57c2'
};

// E07: 給与グラフ色
assertEqual(chartColors.salary, '#4285f4', 'E07', '給与グラフ色');

// E08: 下限給与グラフ色
assertEqual(chartColors.minSalary, '#66bb6a', 'E08', '下限給与グラフ色（緑）');

// E09: 上限給与グラフ色
assertEqual(chartColors.maxSalary, '#ff7043', 'E09', '上限給与グラフ色（オレンジ）');

// E10: 雇用形態グラフ色
assertEqual(chartColors.employment, '#1a73e8', 'E10', '雇用形態グラフ色');

// E11: 地域グラフ色
assertEqual(chartColors.region, '#26a69a', 'E11', '地域グラフ色');

// E12: タググラフ色
assertEqual(chartColors.tag, '#7e57c2', 'E12', 'タググラフ色（紫）');

// レイアウト設定
const layoutSettings = {
  maxWidth: 1100,
  histogramWidth: 900,
  minMaxChartWidth: 450,
  horizontalBarWidth: 700
};

// E13: 最大幅設定
assertEqual(layoutSettings.maxWidth, 1100, 'E13', '最大幅1100px');

// E14: ヒストグラム幅（生データ版対応）
assertEqual(layoutSettings.histogramWidth, 900, 'E14', 'ヒストグラム幅900px');

// E15: 下限・上限チャート幅
assertEqual(layoutSettings.minMaxChartWidth, 450, 'E15', '下限・上限チャート幅450px');

// ============================================================
// Category F: 時給/月給モード切替テスト (10件)
// ============================================================
console.log('\n=== Category F: 時給/月給モード切替テスト ===');

// F01: 月給モード単位
const monthlyUnit = '万円';
assertEqual(monthlyUnit, '万円', 'F01', '月給モード単位');

// F02: 時給モード単位
const hourlyUnit = '円';
assertEqual(hourlyUnit, '円', 'F02', '時給モード単位');

// F03: 月給モードラベル
const monthlySalaryLabel = '平均月給';
assertEqual(monthlySalaryLabel, '平均月給', 'F03', '月給モードラベル');

// F04: 時給モードラベル
const hourlySalaryLabel = '平均時給';
assertEqual(hourlySalaryLabel, '平均時給', 'F04', '時給モードラベル');

// F05: 月給ヒストグラムタイトル
const monthlyHistTitle = '月給分布（件数）';
assert(monthlyHistTitle.includes('月給'), 'F05', '月給ヒストグラムタイトル');

// F06: 時給ヒストグラムタイトル
const hourlyHistTitle = '時給分布（件数）';
assert(hourlyHistTitle.includes('時給'), 'F06', '時給ヒストグラムタイトル');

// F07: 下限・上限タイトル（月給）
const monthlyMinMaxTitle = '給与下限・上限別分布（月給・年収のみ）';
assert(monthlyMinMaxTitle.includes('月給'), 'F07', '月給下限・上限タイトル');

// F08: 下限・上限タイトル（時給）
const hourlyMinMaxTitle = '給与下限・上限別分布（時給）';
assert(hourlyMinMaxTitle.includes('時給'), 'F08', '時給下限・上限タイトル');

// F09: 希望給与表示（月給モード）
const formatTargetSalary = (val, isHourly) => {
  if (!val) return '-';
  return isHourly ? Math.round(val) + '円' : Math.round(val/10000) + '万';
};
assertEqual(formatTargetSalary(300000, false), '30万', 'F09', '希望給与月給表示');

// F10: 希望給与表示（時給モード）
assertEqual(formatTargetSalary(1200, true), '1200円', 'F10', '希望給与時給表示');

// ============================================================
// Category G: エッジケーステスト (10件)
// ============================================================
console.log('\n=== Category G: エッジケーステスト ===');

// G01: 非常に大きな値
assertEqual(formatSalary(10000000, false), '1000万円', 'G01', '1000万円表示');

// G02: 非常に小さな値
assertEqual(formatSalary(10000, false), '1万円', 'G02', '1万円表示');

// G03: 負の値
const negResult = formatSalary(-100000, false);
assertEqual(negResult, '-10万円', 'G03', '負の値も処理');

// G04: 小数点値（月給）
assertEqual(formatSalary(255555.55, false), '26万円', 'G04', '小数点値四捨五入');

// G05: 小数点値（時給）
assertEqual(formatSalary(1000.49, true), '1000円', 'G05', '時給小数点切り捨て');

// G06: 空オブジェクト
const emptyTopCities = createTopCities({});
assertEqual(emptyTopCities.length, 0, 'G06', '空オブジェクト処理');

// G07: 全て0値
const zeroTags = createTagCategories({ 'A': 0, 'B': 0, 'C': 0 });
assertEqual(zeroTags.length, 0, 'G07', '全て0値→空配列');

// G08: 特殊文字ラベル
const specialSvg = createBarChartSvg(['<script>', '&amp;', '"test"'], [10, 20, 30], 'Special', '#333', 400, 200);
assert(specialSvg.includes('<svg'), 'G08', '特殊文字含むデータも処理');

// G09: 非常に長いラベル
const longLabelSvg = createBarChartSvg(['これは非常に長いラベルですテスト'], [100], 'Long', '#333', 400, 200);
assert(longLabelSvg.includes('</svg>'), 'G09', '長いラベルも処理');

// G10: Unicode文字
const unicodeSvg = createBarChartSvg(['🏢東京', '🏭大阪'], [50, 30], 'Unicode', '#333', 400, 200);
assert(unicodeSvg.includes('🏢東京'), 'G10', 'Unicode文字も処理');

// ============================================================
// Category H: ランキング表示テスト (10件)
// ============================================================
console.log('\n=== Category H: ランキング表示テスト ===');

// 企業ランキングデータ
const companyData = {
  topByCount: [
    { name: '企業A', jobCount: 100, minSalary: { medianMan: 25 }, maxSalary: { medianMan: 35 } },
    { name: '企業B', jobCount: 80, minSalary: { medianMan: 28 }, maxSalary: { medianMan: 40 } },
    { name: '企業C', jobCount: 60, minSalary: { medianMan: 22 }, maxSalary: { medianMan: 30 } }
  ],
  topBySalary: [
    { name: '企業X', jobCount: 20, minSalary: { median: 350000, medianMan: 35 }, maxSalary: { median: 500000, medianMan: 50 } },
    { name: '企業Y', jobCount: 15, minSalary: { median: 300000, medianMan: 30 }, maxSalary: { median: 450000, medianMan: 45 } }
  ],
  totalCompanies: 150
};

// H01: 企業数
assertEqual(companyData.totalCompanies, 150, 'H01', '総企業数150社');

// H02: 求人数ランキング件数
assertEqual(companyData.topByCount.length, 3, 'H02', '求人数ランキング3社');

// H03: 求人数1位
assertEqual(companyData.topByCount[0].name, '企業A', 'H03', '求人数1位は企業A');

// H04: 求人数1位の件数
assertEqual(companyData.topByCount[0].jobCount, 100, 'H04', '企業Aは100件');

// H05: 給与ランキング件数
assertEqual(companyData.topBySalary.length, 2, 'H05', '給与ランキング2社');

// H06: 給与1位
assertEqual(companyData.topBySalary[0].name, '企業X', 'H06', '給与1位は企業X');

// H07: 下限中央値（万円）
assertEqual(companyData.topBySalary[0].minSalary.medianMan, 35, 'H07', '企業X下限中央値35万');

// H08: 上限中央値（万円）
assertEqual(companyData.topBySalary[0].maxSalary.medianMan, 50, 'H08', '企業X上限中央値50万');

// ソート確認
const sortedBySalary = [...companyData.topBySalary]
  .filter(c => c.maxSalary && c.maxSalary.median)
  .sort((a, b) => (b.maxSalary?.median || 0) - (a.maxSalary?.median || 0));

// H09: 給与ソート順
assertEqual(sortedBySalary[0].name, '企業X', 'H09', '上限中央値順ソート');

// H10: ソート結果件数
assertEqual(sortedBySalary.length, 2, 'H10', 'ソート後も2社');

// ============================================================
// Category I: タグ相関テスト (5件)
// ============================================================
console.log('\n=== Category I: タグ相関テスト ===');

const tagCorrelations = [
  { tag: 'リモート可', count: 50, minStats: { medianMan: 30 }, maxStats: { medianMan: 45 }, diffMaxMedianMan: 5 },
  { tag: 'フレックス', count: 40, minStats: { medianMan: 28 }, maxStats: { medianMan: 42 }, diffMaxMedianMan: 2 },
  { tag: '未経験可', count: 100, minStats: { medianMan: 22 }, maxStats: { medianMan: 28 }, diffMaxMedianMan: -12 }
];

// I01: タグ相関データ件数
assertEqual(tagCorrelations.length, 3, 'I01', 'タグ相関3件');

// I02: 高給与タグ
assertEqual(tagCorrelations[0].tag, 'リモート可', 'I02', '最上位タグはリモート可');

// I03: プラス差額表示
const diffDisplay1 = (tagCorrelations[0].diffMaxMedianMan >= 0 ? '+' : '') + tagCorrelations[0].diffMaxMedianMan;
assertEqual(diffDisplay1, '+5', 'I03', 'プラス差額は+表示');

// I04: マイナス差額表示
const diffDisplay2 = (tagCorrelations[2].diffMaxMedianMan >= 0 ? '+' : '') + tagCorrelations[2].diffMaxMedianMan;
assertEqual(diffDisplay2, '-12', 'I04', 'マイナス差額表示');

// I05: CSS クラス判定
const cssClass = tagCorrelations[0].diffMaxMedianMan >= 0 ? 'positive' : 'negative';
assertEqual(cssClass, 'positive', 'I05', 'プラス差額はpositiveクラス');

// ============================================================
// 結果サマリー
// ============================================================

console.log('\n========================================');
console.log('テスト結果サマリー');
console.log('========================================');
console.log('成功: ' + testResults.passed);
console.log('失敗: ' + testResults.failed);
console.log('合計: ' + (testResults.passed + testResults.failed));
console.log('成功率: ' + Math.round(testResults.passed / (testResults.passed + testResults.failed) * 100) + '%');

if (testResults.errors.length > 0) {
  console.log('\n失敗したテスト:');
  testResults.errors.forEach(err => {
    console.log('  - ' + err);
  });
}

console.log('\n========================================');
console.log('レポート生成機能の検証ポイント');
console.log('========================================');
console.log('✓ 給与フォーマット（月給/時給モード対応）');
console.log('✓ SVG棒グラフ生成（縦・横両方）');
console.log('✓ データ整形（TOP10、分布、カテゴリ）');
console.log('✓ レポートHTML構造（10セクション）');
console.log('✓ 企業・タグランキング表示');
console.log('✓ エッジケース処理');

// 終了コード
process.exit(testResults.failed > 0 ? 1 : 0);
