const { chromium } = require('playwright');

(async () => {
  console.log('=== ContentEditable Playwrightテスト ===\n');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto('file:///C:/Users/fuji1/projects/gas-dashboard/tests/test_contenteditable.html');
  await page.waitForTimeout(1000);

  let passed = 0;
  let failed = 0;

  // Test 1: contenteditable要素の数
  const editableCount = await page.evaluate(() => {
    return document.querySelectorAll('[contenteditable="true"]').length;
  });
  if (editableCount > 10) {
    console.log('✅ T1: contenteditable要素数 =', editableCount);
    passed++;
  } else {
    console.log('❌ T1: contenteditable要素数 =', editableCount, '(少ない)');
    failed++;
  }

  // Test 2: h1が編集可能か
  const h1Editable = await page.evaluate(() => {
    const h1 = document.querySelector('h1');
    return h1 && h1.getAttribute('contenteditable') === 'true';
  });
  if (h1Editable) {
    console.log('✅ T2: h1は編集可能');
    passed++;
  } else {
    console.log('❌ T2: h1が編集不可');
    failed++;
  }

  // Test 3: h1テキスト編集テスト
  await page.click('h1');
  await page.keyboard.press('End');
  await page.keyboard.type('（編集済み）');
  const h1Text = await page.textContent('h1');
  if (h1Text.includes('編集済み')) {
    console.log('✅ T3: h1テキスト編集成功 →', h1Text);
    passed++;
  } else {
    console.log('❌ T3: h1テキスト編集失敗');
    failed++;
  }

  // Test 4: テーブルセル編集
  const firstTd = await page.locator('td').first();
  await firstTd.click();
  await page.keyboard.press('Control+a');
  await page.keyboard.type('変更後');
  const tdText = await firstTd.textContent();
  if (tdText === '変更後') {
    console.log('✅ T4: テーブルセル編集成功');
    passed++;
  } else {
    console.log('❌ T4: テーブルセル編集失敗 →', tdText);
    failed++;
  }

  // Test 5: 統計値編集
  const statValue = await page.locator('.stat-value').first();
  await statValue.click();
  await page.keyboard.press('Control+a');
  await page.keyboard.type('9,999');
  const statText = await statValue.textContent();
  if (statText === '9,999') {
    console.log('✅ T5: 統計値編集成功');
    passed++;
  } else {
    console.log('❌ T5: 統計値編集失敗 →', statText);
    failed++;
  }

  // Test 6: 編集後の下線スタイル確認
  const borderStyle = await page.evaluate(() => {
    const el = document.querySelector('.stat-value');
    return el.style.borderBottom;
  });
  if (borderStyle.includes('ffc107')) {
    console.log('✅ T6: 編集後に黄色下線が表示される');
    passed++;
  } else {
    console.log('❌ T6: 編集後下線なし →', borderStyle);
    failed++;
  }

  // Test 7: edit-guideは編集不可
  const guideEditable = await page.evaluate(() => {
    const guide = document.querySelector('.edit-guide');
    return guide && guide.getAttribute('contenteditable') === 'true';
  });
  if (!guideEditable) {
    console.log('✅ T7: edit-guideは編集不可（正常）');
    passed++;
  } else {
    console.log('❌ T7: edit-guideが編集可能になっている（異常）');
    failed++;
  }

  // Test 8: 段落(p)が編集可能か
  const pEditable = await page.evaluate(() => {
    const p = document.querySelector('.section p');
    return p && p.getAttribute('contenteditable') === 'true';
  });
  if (pEditable) {
    console.log('✅ T8: 段落(p)は編集可能');
    passed++;
  } else {
    console.log('❌ T8: 段落(p)が編集不可');
    failed++;
  }

  await browser.close();

  console.log('\n========================================');
  console.log('テスト結果: ' + passed + '/' + (passed + failed) + ' 合格');
  console.log('合格率: ' + Math.round(passed / (passed + failed) * 100) + '%');
  console.log('========================================');

  process.exit(failed > 0 ? 1 : 0);
})();
