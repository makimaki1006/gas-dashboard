/**
 * 求人ボックスCSVから年間休日パターンを分析
 */
const fs = require('fs');
const path = require('path');

// CSVファイルを読み込み
const csvPath = 'C:/Users/fuji1/Downloads/xn--pckua2a7gp15o89zb-2026-01-15 (2).csv';
const csvContent = fs.readFileSync(csvPath, 'utf-8');

// 行に分割
const lines = csvContent.split('\n');
console.log('総行数:', lines.length);

// ヘッダー解析
const headers = lines[0].split(',');
const pResultLinesIndex = headers.findIndex(h => h.includes('p-result_lines'));
console.log('p-result_lines カラムインデックス:', pResultLinesIndex);

// 年間休日関連のパターンを収集
const patterns = new Map();
const matchedTexts = [];

// 各行からp-result_linesを抽出して分析
for (let i = 1; i < lines.length; i++) {
  const line = lines[i];
  if (!line.trim()) continue;

  // CSVの簡易パース（カンマ区切り、引用符考慮なし）
  // p-result_linesは7番目のカラム（インデックス6）
  const parts = line.split(',');
  const text = parts.slice(6).join(',');  // 7番目以降を結合（テキスト内にカンマがある可能性）

  if (!text) continue;

  // 年間休日関連のパターンを探索
  const regexes = [
    { name: '年間休日:数字日', regex: /年間休日[:\s:：]*(\d{2,3})日/g },
    { name: '<年間休日>数字日', regex: /<年間休日>(\d{2,3})日?/g },
    { name: '年間休日数 数字日', regex: /年間休日数[:\s:：]*(\d{2,3})日?/g },
    { name: '年間休日数字（日なし）', regex: /年間休日(\d{2,3})(?!\d)/g },
    { name: '年休数字日', regex: /年休[:\s:：]*(\d{2,3})日/g },
    { name: '休日数字日', regex: /(?<!年間)休日[:\s:：]*(\d{2,3})日/g },
    { name: '数字日/年', regex: /(\d{2,3})日\s*\/\s*年/g },
    { name: '数字日（年間休日）', regex: /(\d{2,3})日[（(]年間休日[）)]/g },
    { name: '数字日（年間）', regex: /(\d{2,3})日[（(]年間[）)]/g }
  ];

  for (const { name, regex } of regexes) {
    let match;
    while ((match = regex.exec(text)) !== null) {
      const value = parseInt(match[1]);
      if (value >= 50 && value <= 200) {
        if (!patterns.has(name)) {
          patterns.set(name, []);
        }
        patterns.get(name).push({
          value,
          context: text.substring(Math.max(0, match.index - 30), match.index + match[0].length + 30)
        });
      }
    }
  }

  // 全ての「年間休日」周辺のテキストを収集
  const yearlyHolidayMatches = text.match(/年間休日.{0,30}/g);
  if (yearlyHolidayMatches) {
    matchedTexts.push(...yearlyHolidayMatches);
  }
}

// 結果出力
console.log('\n=== パターン別マッチ数 ===');
for (const [name, matches] of patterns) {
  console.log(`${name}: ${matches.length}件`);
}

console.log('\n=== サンプルマッチ（各パターン最大5件） ===');
for (const [name, matches] of patterns) {
  console.log(`\n【${name}】`);
  const samples = matches.slice(0, 5);
  samples.forEach((m, i) => {
    console.log(`  ${i + 1}. [${m.value}日] ...${m.context.replace(/\n/g, ' ')}...`);
  });
}

console.log('\n=== ユニークな「年間休日」周辺パターン（最大50件） ===');
const uniquePatterns = [...new Set(matchedTexts)].slice(0, 50);
uniquePatterns.forEach((p, i) => {
  console.log(`${i + 1}. ${p.replace(/\n/g, ' ')}`);
});

// 抽出できた値の統計
console.log('\n=== 抽出された年間休日の値 ===');
const allValues = [];
for (const matches of patterns.values()) {
  allValues.push(...matches.map(m => m.value));
}
const uniqueValues = [...new Set(allValues)].sort((a, b) => a - b);
console.log('ユニーク値:', uniqueValues.join(', '));
console.log('最小:', Math.min(...uniqueValues));
console.log('最大:', Math.max(...uniqueValues));
