/**
 * 実データでの年間休日抽出テスト
 * 求人ボックスCSVからの抽出率を検証
 */
const fs = require('fs');

// 更新されたパターン（Constants.jsと同期）
const ANNUAL_HOLIDAYS_PATTERNS = [
  // === 求人ボックス実データ分析に基づくパターン（優先度順） ===

  // 1. 最頻出パターン: 年間休日:数字日（410件マッチ）
  /年間休日[:\s:：・]*(\d{2,3})\s*日/,           // 年間休日:120日, 年間休日 120日

  // 2. HTMLタグ風パターン（90件マッチ）
  /<年間休日>(\d{2,3})日?/,                      // <年間休日>120日
  /年間休日>(\d{2,3})日?/,                       // 年間休日>120日（開始タグ欠落）

  // 3. 年間休日数パターン（54件マッチ）
  /年間休日数[:\s:：・]*(\d{2,3})\s*日?/,        // 年間休日数 120日, 年間休日数120日

  // 4. 「は」「が」挿入パターン
  /年間休日[はが](\d{2,3})日?/,                  // 年間休日は125日

  // 5. 感嘆符・句読点付きパターン
  /年間休日(\d{2,3})日?[!！。、]/,               // 年間休日124日!

  // 6. 数字のみ続くパターン（361件マッチ - 広範囲）
  /年間休日[:\s:：・]*(\d{2,3})(?!\d)/,          // 年間休日120（日なし）

  // 7. 後置パターン
  /(\d{2,3})\s*日[（(]?\s*年間休日\s*[）)]?/,    // 120日（年間休日）
  /(\d{2,3})\s*日[（(]?\s*年間\s*[）)]?/,        // 120日（年間）

  // === 年休・休日パターン（98件マッチ） ===
  /年休(\d{2,3})日[～〜]?/,                      // 年休120日～（タグ形式）
  /年休[:\s:：・]*(\d{2,3})\s*日/,               // 年休:120日

  // === 「休日」キーワード周辺 ===
  /(?<!年間)休日[:\s:：・]*(\d{2,3})\s*日/,      // 休日:120日（年間休日と重複防止）
  /休日数[:\s:：・]*(\d{2,3})\s*日?/,            // 休日数120日

  // === その他のパターン ===
  /年[間]?休[日暇][:\s:：・]*(\d{2,3})\s*日?/,   // 年間休暇120日
  /(\d{2,3})\s*日\s*[\/\／]\s*年/,               // 120日/年

  // === 特殊区切りパターン ===
  /年間休日\](\d{2,3})日?/,                      // 年間休日]110日（特殊区切り）

  // === フォールバック（最後に試行） ===
  /休日.*?(\d{2,3})\s*日/                        // 休日...120日（広いマッチ）
];

/**
 * 年間休日をテキストから抽出
 */
function extractAnnualHolidays(text) {
  if (!text || typeof text !== 'string') {
    return null;
  }

  for (const pattern of ANNUAL_HOLIDAYS_PATTERNS) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const days = parseInt(match[1], 10);
      // 見切れデータ対策：2桁は70以上のみ許可
      // - 2桁（70-99）: 実在する範囲
      // - 3桁（100-180）: 一般的な範囲
      // - 70未満の2桁（11,12等）はトランケートの可能性大
      const isValid = (days >= 70 && days <= 99) || (days >= 100 && days <= 180);
      if (isValid) {
        return days;
      }
    }
  }

  return null;
}

// CSVファイルを読み込み
const csvPath = 'C:/Users/fuji1/Downloads/xn--pckua2a7gp15o89zb-2026-01-15 (2).csv';
const csvContent = fs.readFileSync(csvPath, 'utf-8');
const lines = csvContent.split('\n');

console.log('='.repeat(60));
console.log('求人ボックス実データでの年間休日抽出テスト');
console.log('='.repeat(60));
console.log('総行数:', lines.length - 1, '(ヘッダー除く)');

// 統計
let totalRecords = 0;
let extractedCount = 0;
let hasKeywordCount = 0;
const extractedValues = [];
const failedExtractions = [];

// 各行から抽出テスト
for (let i = 1; i < lines.length; i++) {
  const line = lines[i];
  if (!line.trim()) continue;
  totalRecords++;

  // p-result_linesを取得（7番目のカラム）
  const parts = line.split(',');
  const text = parts.slice(6).join(',');

  // 年間休日キーワードの有無チェック
  const hasKeyword = /年間休日|年休|休日.*日/.test(text);
  if (hasKeyword) {
    hasKeywordCount++;
  }

  // 抽出テスト
  const extracted = extractAnnualHolidays(text);
  if (extracted !== null) {
    extractedCount++;
    extractedValues.push(extracted);
  } else if (hasKeyword && text.includes('年間休日')) {
    // 「年間休日」があるのに抽出できなかったケースを記録
    const match = text.match(/年間休日.{0,30}/);
    if (match) {
      failedExtractions.push(match[0]);
    }
  }
}

// 結果出力
console.log('\n=== 抽出結果 ===');
console.log('処理レコード数:', totalRecords);
console.log('「年間休日」等キーワード含有:', hasKeywordCount, `(${Math.round(hasKeywordCount/totalRecords*100)}%)`);
console.log('抽出成功:', extractedCount, `(${Math.round(extractedCount/totalRecords*100)}%)`);
console.log('キーワード含有からの抽出率:', `${Math.round(extractedCount/hasKeywordCount*100)}%`);

// 値の分布
const sorted = [...extractedValues].sort((a, b) => a - b);
console.log('\n=== 抽出値の統計 ===');
console.log('最小値:', Math.min(...sorted));
console.log('最大値:', Math.max(...sorted));
console.log('平均値:', Math.round(sorted.reduce((a,b)=>a+b,0) / sorted.length * 10) / 10);
console.log('中央値:', sorted[Math.floor(sorted.length / 2)]);

// 値の分布（10日刻み）
console.log('\n=== 値の分布（10日刻み） ===');
const distribution = {};
sorted.forEach(v => {
  const bin = Math.floor(v / 10) * 10;
  const label = `${bin}～${bin+9}日`;
  distribution[label] = (distribution[label] || 0) + 1;
});
Object.entries(distribution)
  .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
  .forEach(([label, count]) => {
    const bar = '█'.repeat(Math.min(50, Math.round(count / 5)));
    console.log(`${label.padEnd(12)} ${String(count).padStart(4)}件 ${bar}`);
  });

// 抽出失敗ケース
if (failedExtractions.length > 0) {
  console.log('\n=== 抽出失敗パターン（最大20件） ===');
  const uniqueFailed = [...new Set(failedExtractions)].slice(0, 20);
  uniqueFailed.forEach((p, i) => {
    console.log(`${i + 1}. ${p.replace(/\n/g, ' ')}`);
  });
}

console.log('\n' + '='.repeat(60));
console.log('テスト完了');
console.log('='.repeat(60));
