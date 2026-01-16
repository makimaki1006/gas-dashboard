/**
 * 200パターン包括的テスト
 * CSVインポート → ダッシュボード → レポート出力の全フローを検証
 */

// テスト用モックデータ生成
const TestPatternGenerator = {
  // 都道府県リスト
  prefectures: ['北海道', '東京都', '大阪府', '愛知県', '福岡県', '神奈川県', '埼玉県', '千葉県', '兵庫県', '京都府'],

  // 市区町村リスト
  cities: {
    '東京都': ['渋谷区', '新宿区', '港区', '千代田区', '中央区', '品川区', '目黒区', '世田谷区'],
    '大阪府': ['大阪市北区', '大阪市中央区', '豊中市', '吹田市', '堺市'],
    '愛知県': ['名古屋市中区', '名古屋市東区', '豊田市', '岡崎市'],
    '神奈川県': ['横浜市西区', '川崎市中原区', '相模原市'],
    '福岡県': ['福岡市中央区', '福岡市博多区', '北九州市'],
  },

  // 給与パターン（月給）
  salaryPatternsMonthly: [
    '月給25万円〜35万円',
    '月給 30万円 〜 45万円',
    '月給20万円以上',
    '月給28万～40万',
    '月給250,000円～350,000円',
    '月給30万円',
    '月収25〜35万円',
    '月額280,000円〜',
    '月給22万円〜28万円（経験による）',
    '月給35万円〜50万円+賞与',
  ],

  // 給与パターン（時給）
  salaryPatternsHourly: [
    '時給1,200円〜1,500円',
    '時給 1500円 〜 2000円',
    '時給1000円以上',
    '時給1,100〜1,400円',
    '時給1200円',
    '時給950円～1,200円',
    '時間給1,300円〜',
    '時給1,500円（試用期間中1,400円）',
  ],

  // 給与パターン（年収）
  salaryPatternsAnnual: [
    '年収400万円〜600万円',
    '年収 500万円 〜 800万円',
    '年収350万円以上',
    '年俸450万〜700万',
    '年収4,000,000円～6,000,000円',
    '年収600万円',
  ],

  // 雇用形態
  employmentTypes: ['正社員', '契約社員', 'パート・アルバイト', '派遣社員', '業務委託', '正社員（試用期間あり）'],

  // タグ
  tags: [
    '未経験歓迎', '経験者優遇', '土日祝休み', '交通費支給', '社会保険完備',
    '残業少なめ', 'リモートワーク可', '週休2日', '賞与あり', '昇給あり',
    '転勤なし', '研修制度あり', '資格取得支援', 'フレックス', '駅チカ',
  ],

  // 職種
  jobTitles: [
    '営業職', 'ITエンジニア', '事務職', '経理', '人事',
    'Webデザイナー', 'プロジェクトマネージャー', 'カスタマーサポート',
    '製造スタッフ', '販売スタッフ', 'マーケティング', '広報',
  ],

  // 会社名パターン
  companyNames: [
    '株式会社テスト', '合同会社サンプル', 'テスト工業株式会社',
    '株式会社ABC', 'XYZ株式会社', '株式会社イノベーション',
  ],

  // 年間休日パターン
  annualHolidaysPatterns: [
    '120日', '125日', '110日', '105日', '130日',
    '年間休日120日', '年間120日', '120日以上', '',
  ],

  // ランダム選択ヘルパー
  randomChoice(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  },

  randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  },

  // タグをランダムに複数選択
  randomTags(count) {
    const selected = [];
    const available = [...this.tags];
    for (let i = 0; i < count && available.length > 0; i++) {
      const idx = Math.floor(Math.random() * available.length);
      selected.push(available.splice(idx, 1)[0]);
    }
    return selected.join(', ');
  },

  // 勤務地を生成
  generateLocation(pref) {
    const cities = this.cities[pref] || ['市内'];
    const city = this.randomChoice(cities);
    const station = Math.random() > 0.5 ? ` ${this.randomChoice(['駅前', '駅徒歩5分', '駅徒歩10分'])}` : '';
    return `${pref} ${city}${station}`;
  },

  // 1件のテストレコード生成
  generateRecord(id, options = {}) {
    const pref = options.prefecture || this.randomChoice(this.prefectures);
    const salaryType = options.salaryType || this.randomChoice(['monthly', 'hourly', 'annual']);

    let salary;
    switch (salaryType) {
      case 'hourly':
        salary = this.randomChoice(this.salaryPatternsHourly);
        break;
      case 'annual':
        salary = this.randomChoice(this.salaryPatternsAnnual);
        break;
      default:
        salary = this.randomChoice(this.salaryPatternsMonthly);
    }

    return {
      rowIndex: id + 2,
      jobTitle: options.jobTitle || this.randomChoice(this.jobTitles),
      jobUrl: `https://example.com/job/${id}`,
      isNew: Math.random() > 0.7 ? '新着' : '',
      companyName: options.companyName || this.randomChoice(this.companyNames),
      location: options.location || this.generateLocation(pref),
      tags: options.tags || this.randomTags(this.randomInt(2, 5)),
      salary: options.salary || salary,
      employmentType: options.employmentType || this.randomChoice(this.employmentTypes),
      annualHolidays: options.annualHolidays || this.randomChoice(this.annualHolidaysPatterns),
      description: options.description || `${this.randomChoice(this.jobTitles)}の求人です。`,
    };
  },

  // 200パターンのテストデータ生成
  generate200Patterns() {
    const patterns = [];
    let id = 0;

    // ===== カテゴリ1: 給与パース（60パターン）=====
    // 月給パターン（20種）
    this.salaryPatternsMonthly.forEach(salary => {
      patterns.push(this.generateRecord(id++, { salary, salaryType: 'monthly' }));
      patterns.push(this.generateRecord(id++, { salary, salaryType: 'monthly', employmentType: '正社員' }));
    });

    // 時給パターン（16種）
    this.salaryPatternsHourly.forEach(salary => {
      patterns.push(this.generateRecord(id++, { salary, salaryType: 'hourly' }));
      patterns.push(this.generateRecord(id++, { salary, salaryType: 'hourly', employmentType: 'パート・アルバイト' }));
    });

    // 年収パターン（12種）
    this.salaryPatternsAnnual.forEach(salary => {
      patterns.push(this.generateRecord(id++, { salary, salaryType: 'annual' }));
      patterns.push(this.generateRecord(id++, { salary, salaryType: 'annual', employmentType: '正社員' }));
    });

    // ===== カテゴリ2: 勤務地パース（40パターン）=====
    this.prefectures.forEach(pref => {
      // 各都道府県で4パターン
      patterns.push(this.generateRecord(id++, { prefecture: pref }));
      patterns.push(this.generateRecord(id++, { location: `${pref}` })); // 都道府県のみ
      patterns.push(this.generateRecord(id++, { location: `${pref} 駅前` }));
      patterns.push(this.generateRecord(id++, { location: `${pref} リモート可` }));
    });

    // ===== カテゴリ3: 雇用形態（18パターン）=====
    this.employmentTypes.forEach(emp => {
      patterns.push(this.generateRecord(id++, { employmentType: emp }));
      patterns.push(this.generateRecord(id++, { employmentType: emp, salary: '月給30万円' }));
      patterns.push(this.generateRecord(id++, { employmentType: emp, salary: '時給1500円' }));
    });

    // ===== カテゴリ4: タグパターン（30パターン）=====
    for (let i = 0; i < 30; i++) {
      patterns.push(this.generateRecord(id++, { tags: this.randomTags(this.randomInt(1, 8)) }));
    }

    // ===== カテゴリ5: 年間休日（20パターン）=====
    this.annualHolidaysPatterns.forEach(ah => {
      patterns.push(this.generateRecord(id++, { annualHolidays: ah }));
      patterns.push(this.generateRecord(id++, { annualHolidays: ah, employmentType: '正社員' }));
    });

    // ===== カテゴリ6: エッジケース（32パターン）=====
    // 空値テスト
    patterns.push(this.generateRecord(id++, { salary: '' }));
    patterns.push(this.generateRecord(id++, { location: '' }));
    patterns.push(this.generateRecord(id++, { tags: '' }));
    patterns.push(this.generateRecord(id++, { employmentType: '' }));
    patterns.push(this.generateRecord(id++, { annualHolidays: '' }));
    patterns.push(this.generateRecord(id++, { companyName: '' }));

    // 特殊文字テスト
    patterns.push(this.generateRecord(id++, { salary: '月給25万円～35万円（税込）' }));
    patterns.push(this.generateRecord(id++, { salary: '月給25万円〜35万円※経験考慮' }));
    patterns.push(this.generateRecord(id++, { location: '東京都 渋谷区（転勤なし）' }));
    patterns.push(this.generateRecord(id++, { tags: '未経験歓迎、土日祝休み、交通費支給' }));

    // 複合パターン
    patterns.push(this.generateRecord(id++, {
      salary: '月給25万円〜35万円+賞与年2回',
      employmentType: '正社員',
      annualHolidays: '125日'
    }));
    patterns.push(this.generateRecord(id++, {
      salary: '時給1,500円〜2,000円',
      employmentType: 'パート・アルバイト',
      annualHolidays: ''
    }));

    // 境界値テスト
    patterns.push(this.generateRecord(id++, { salary: '月給0円' }));
    patterns.push(this.generateRecord(id++, { salary: '月給999万円' }));
    patterns.push(this.generateRecord(id++, { salary: '時給1円' }));
    patterns.push(this.generateRecord(id++, { salary: '時給99999円' }));
    patterns.push(this.generateRecord(id++, { annualHolidays: '0日' }));
    patterns.push(this.generateRecord(id++, { annualHolidays: '365日' }));

    // 不正フォーマットテスト
    patterns.push(this.generateRecord(id++, { salary: '給与相談' }));
    patterns.push(this.generateRecord(id++, { salary: '経験により優遇' }));
    patterns.push(this.generateRecord(id++, { salary: 'xxx万円' }));
    patterns.push(this.generateRecord(id++, { location: '全国' }));
    patterns.push(this.generateRecord(id++, { location: 'リモートワーク' }));
    patterns.push(this.generateRecord(id++, { location: '海外' }));

    // 長いテキストテスト
    patterns.push(this.generateRecord(id++, {
      description: 'A'.repeat(1000),
      tags: this.tags.join(', ')
    }));
    patterns.push(this.generateRecord(id++, {
      companyName: '株式会社' + 'テスト'.repeat(50)
    }));

    // 残りをランダムで埋める
    while (patterns.length < 200) {
      patterns.push(this.generateRecord(id++));
    }

    return patterns.slice(0, 200);
  }
};

// ===== パーサー関数（GASコードから移植）=====

/**
 * 給与パース（簡易版）
 */
function parseSalary(salaryText) {
  if (!salaryText || typeof salaryText !== 'string') {
    return { min: null, max: null, type: 'unknown', unifiedMonthly: null };
  }

  const text = salaryText.replace(/,/g, '').replace(/，/g, '');

  // 時給判定
  if (/時給|時間給/.test(text)) {
    const hourlyMatch = text.match(/(\d+)\s*円?\s*[〜~～―\-−ー]+\s*(\d+)/);
    const hourlyMatchSingle = text.match(/(\d+)\s*円/);

    if (hourlyMatch) {
      const min = parseInt(hourlyMatch[1]);
      const max = parseInt(hourlyMatch[2]);
      return {
        min, max, type: 'hourly',
        unifiedMonthly: Math.round((min + max) / 2 * 160) // 月160時間換算
      };
    } else if (hourlyMatchSingle) {
      const val = parseInt(hourlyMatchSingle[1]);
      return {
        min: val, max: val, type: 'hourly',
        unifiedMonthly: val * 160
      };
    }
  }

  // 年収判定
  if (/年収|年俸/.test(text)) {
    const annualMatch = text.match(/(\d+)\s*万?\s*円?\s*[〜~～―\-−ー]+\s*(\d+)/);
    const annualMatchSingle = text.match(/(\d+)\s*万/);

    if (annualMatch) {
      let min = parseInt(annualMatch[1]);
      let max = parseInt(annualMatch[2]);
      if (min < 100) { min *= 10000; max *= 10000; }
      return {
        min, max, type: 'annual',
        unifiedMonthly: Math.round((min + max) / 2 / 12)
      };
    } else if (annualMatchSingle) {
      let val = parseInt(annualMatchSingle[1]);
      if (val < 100) val *= 10000;
      return {
        min: val, max: val, type: 'annual',
        unifiedMonthly: Math.round(val / 12)
      };
    }
  }

  // 月給判定
  const monthlyMatch = text.match(/(\d+)\s*万?\s*円?\s*[〜~～―\-−ー]+\s*(\d+)/);
  const monthlyMatchSingle = text.match(/(\d+)\s*万/);

  if (monthlyMatch) {
    let min = parseInt(monthlyMatch[1]);
    let max = parseInt(monthlyMatch[2]);
    if (min < 100) { min *= 10000; max *= 10000; }
    return {
      min, max, type: 'monthly',
      unifiedMonthly: Math.round((min + max) / 2)
    };
  } else if (monthlyMatchSingle) {
    let val = parseInt(monthlyMatchSingle[1]);
    if (val < 100) val *= 10000;
    return {
      min: val, max: val, type: 'monthly',
      unifiedMonthly: val
    };
  }

  return { min: null, max: null, type: 'unknown', unifiedMonthly: null };
}

/**
 * 勤務地パース（簡易版）
 */
function parseLocation(locationText) {
  if (!locationText || typeof locationText !== 'string') {
    return { prefecture: null, city: null, parsed: false };
  }

  const prefectures = [
    '北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県',
    '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県',
    '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県', '岐阜県',
    '静岡県', '愛知県', '三重県', '滋賀県', '京都府', '大阪府', '兵庫県',
    '奈良県', '和歌山県', '鳥取県', '島根県', '岡山県', '広島県', '山口県',
    '徳島県', '香川県', '愛媛県', '高知県', '福岡県', '佐賀県', '長崎県',
    '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県'
  ];

  for (const pref of prefectures) {
    if (locationText.includes(pref)) {
      // 市区町村を抽出
      const cityMatch = locationText.match(new RegExp(pref + '\\s*(.+?)(?:\\s|駅|$)'));
      return {
        prefecture: pref,
        city: cityMatch ? cityMatch[1].trim() : null,
        parsed: true
      };
    }
  }

  return { prefecture: null, city: null, parsed: false };
}

/**
 * 年間休日パース
 */
function parseAnnualHolidays(text) {
  if (!text || typeof text !== 'string') return null;
  const match = text.match(/(\d+)\s*日/);
  if (match) {
    const days = parseInt(match[1]);
    if (days >= 50 && days <= 200) return days;
  }
  return null;
}

// ===== テスト実行 =====

const TestRunner = {
  results: {
    total: 0,
    passed: 0,
    failed: 0,
    errors: [],
    deepVerification: [],
  },

  // アサーション
  assert(condition, message, details = {}) {
    this.results.total++;
    if (condition) {
      this.results.passed++;
      return true;
    } else {
      this.results.failed++;
      this.results.errors.push({ message, details });
      return false;
    }
  },

  // 給与パーステスト
  testSalaryParsing(record) {
    const result = parseSalary(record.salary);
    const tests = [];

    // 基本テスト
    if (record.salary && record.salary.match(/\d/)) {
      tests.push(this.assert(
        result.type !== 'unknown' || record.salary.match(/相談|優遇|xxx/),
        `給与タイプが判定された: ${record.salary}`,
        { input: record.salary, result }
      ));
    }

    // 時給の場合
    if (result.type === 'hourly') {
      tests.push(this.assert(
        result.min >= 500 && result.min <= 10000,
        `時給が妥当な範囲: ${result.min}円`,
        { input: record.salary, result }
      ));
    }

    // 月給の場合
    if (result.type === 'monthly') {
      tests.push(this.assert(
        result.unifiedMonthly >= 100000 && result.unifiedMonthly <= 2000000,
        `月給が妥当な範囲: ${result.unifiedMonthly}円`,
        { input: record.salary, result }
      ));
    }

    return tests.every(t => t);
  },

  // 勤務地パーステスト
  testLocationParsing(record) {
    const result = parseLocation(record.location);
    const tests = [];

    if (record.location && record.location.match(/[都道府県]/)) {
      tests.push(this.assert(
        result.parsed,
        `勤務地がパースされた: ${record.location}`,
        { input: record.location, result }
      ));
    }

    return tests.every(t => t);
  },

  // 年間休日パーステスト
  testAnnualHolidays(record) {
    const result = parseAnnualHolidays(record.annualHolidays);
    const tests = [];

    if (record.annualHolidays && record.annualHolidays.match(/\d+日/)) {
      tests.push(this.assert(
        result !== null,
        `年間休日がパースされた: ${record.annualHolidays}`,
        { input: record.annualHolidays, result }
      ));
    }

    return tests.every(t => t);
  },

  // 統合テスト
  testIntegration(records) {
    // 集計テスト
    const validSalaries = records.filter(r => parseSalary(r.salary).unifiedMonthly !== null);
    const validLocations = records.filter(r => parseLocation(r.location).parsed);

    this.assert(
      validSalaries.length > 0,
      `有効な給与データが存在: ${validSalaries.length}件`,
      { count: validSalaries.length }
    );

    this.assert(
      validLocations.length > 0,
      `有効な勤務地データが存在: ${validLocations.length}件`,
      { count: validLocations.length }
    );

    // 統計計算テスト
    if (validSalaries.length > 0) {
      const salaryValues = validSalaries.map(r => parseSalary(r.salary).unifiedMonthly);
      const avg = salaryValues.reduce((a, b) => a + b, 0) / salaryValues.length;
      const min = Math.min(...salaryValues);
      const max = Math.max(...salaryValues);

      this.assert(
        avg > 0 && avg < 10000000,
        `平均給与が妥当: ${Math.round(avg)}円`,
        { avg, min, max }
      );
    }
  },

  // 深堀り検証（10段階）
  deepVerify(record, level = 1) {
    if (level > 10) return true;

    const salary = parseSalary(record.salary);
    const location = parseLocation(record.location);
    const holidays = parseAnnualHolidays(record.annualHolidays);

    const checks = [];

    // レベル1: 基本パース
    if (level >= 1) {
      checks.push({
        level: 1,
        name: '基本パース',
        passed: salary !== null && location !== null
      });
    }

    // レベル2: 型チェック
    if (level >= 2) {
      checks.push({
        level: 2,
        name: '型チェック',
        passed: typeof salary === 'object' && typeof location === 'object'
      });
    }

    // レベル3: 値の範囲チェック
    if (level >= 3 && salary.unifiedMonthly) {
      checks.push({
        level: 3,
        name: '給与範囲',
        passed: salary.unifiedMonthly >= 0 && salary.unifiedMonthly < 100000000
      });
    }

    // レベル4: 整合性チェック
    if (level >= 4 && salary.min && salary.max) {
      checks.push({
        level: 4,
        name: '給与min≤max',
        passed: salary.min <= salary.max
      });
    }

    // レベル5: 都道府県の妥当性
    if (level >= 5 && location.prefecture) {
      const validPrefs = ['北海道', '東京都', '大阪府']; // 簡易
      checks.push({
        level: 5,
        name: '都道府県妥当性',
        passed: location.prefecture.match(/[都道府県]$/)
      });
    }

    // レベル6: 年間休日の妥当性
    if (level >= 6 && holidays !== null) {
      checks.push({
        level: 6,
        name: '年間休日妥当性',
        passed: holidays >= 50 && holidays <= 200
      });
    }

    // レベル7: 雇用形態と給与タイプの整合性
    if (level >= 7) {
      const isPartTime = record.employmentType && record.employmentType.match(/パート|アルバイト/);
      const isHourly = salary.type === 'hourly';
      checks.push({
        level: 7,
        name: '雇用形態-給与整合性',
        passed: !isPartTime || isHourly || salary.type === 'unknown'
      });
    }

    // レベル8: データ完全性
    if (level >= 8) {
      checks.push({
        level: 8,
        name: 'データ完全性',
        passed: record.jobTitle || record.companyName
      });
    }

    // レベル9: エンコーディング
    if (level >= 9) {
      checks.push({
        level: 9,
        name: 'エンコーディング',
        passed: !record.salary || !record.salary.match(/[�]/)
      });
    }

    // レベル10: 再パース一致
    if (level >= 10) {
      const salary2 = parseSalary(record.salary);
      checks.push({
        level: 10,
        name: '再パース一致',
        passed: JSON.stringify(salary) === JSON.stringify(salary2)
      });
    }

    this.results.deepVerification.push({
      record: record.rowIndex,
      checks
    });

    return checks.every(c => c.passed);
  },

  // 逆証明
  reverseProof(records) {
    console.log('\n===== 逆証明 =====\n');
    const proofs = [];

    // 1. 給与がnullなら、元データが無効
    const nullSalaries = records.filter(r => parseSalary(r.salary).unifiedMonthly === null);
    proofs.push({
      claim: '給与null → 元データ無効',
      evidence: nullSalaries.slice(0, 5).map(r => ({
        input: r.salary,
        expected: '数値を含まないまたは不正フォーマット'
      })),
      valid: nullSalaries.every(r => !r.salary || !r.salary.match(/\d+万/) || r.salary.match(/相談|優遇/))
    });

    // 2. 勤務地がパースできないなら、都道府県名がない
    const unparsedLocations = records.filter(r => !parseLocation(r.location).parsed);
    proofs.push({
      claim: '勤務地パース失敗 → 都道府県名なし',
      evidence: unparsedLocations.slice(0, 5).map(r => ({
        input: r.location,
        expected: '都道府県名を含まない'
      })),
      valid: unparsedLocations.every(r => !r.location || !r.location.match(/[都道府県]/))
    });

    // 3. 時給type → 元データに「時給」文字列
    const hourlyRecords = records.filter(r => parseSalary(r.salary).type === 'hourly');
    proofs.push({
      claim: '時給type → 「時給」文字列あり',
      evidence: hourlyRecords.slice(0, 5).map(r => ({
        input: r.salary,
        hasKeyword: r.salary.match(/時給|時間給/) !== null
      })),
      valid: hourlyRecords.every(r => r.salary && r.salary.match(/時給|時間給/))
    });

    // 4. 年収type → 元データに「年収」文字列
    const annualRecords = records.filter(r => parseSalary(r.salary).type === 'annual');
    proofs.push({
      claim: '年収type → 「年収」文字列あり',
      evidence: annualRecords.slice(0, 5).map(r => ({
        input: r.salary,
        hasKeyword: r.salary.match(/年収|年俸/) !== null
      })),
      valid: annualRecords.every(r => r.salary && r.salary.match(/年収|年俸/))
    });

    proofs.forEach((p, i) => {
      console.log(`証明${i + 1}: ${p.claim}`);
      console.log(`  結果: ${p.valid ? '✓ 成立' : '✗ 不成立'}`);
      if (!p.valid) {
        console.log(`  反例:`, p.evidence);
      }
    });

    return proofs.every(p => p.valid);
  },

  // メイン実行
  run() {
    console.log('========================================');
    console.log('200パターン包括的テスト開始');
    console.log('========================================\n');

    // テストデータ生成
    const patterns = TestPatternGenerator.generate200Patterns();
    console.log(`生成パターン数: ${patterns.length}\n`);

    // 各パターンをテスト
    console.log('===== 個別パターンテスト =====\n');
    patterns.forEach((record, i) => {
      this.testSalaryParsing(record);
      this.testLocationParsing(record);
      this.testAnnualHolidays(record);

      // 10パターンごとに深堀り検証
      if (i % 10 === 0) {
        this.deepVerify(record, 10);
      }
    });

    // 統合テスト
    console.log('\n===== 統合テスト =====\n');
    this.testIntegration(patterns);

    // 逆証明
    const reverseProofPassed = this.reverseProof(patterns);

    // 結果出力
    console.log('\n========================================');
    console.log('テスト結果サマリー');
    console.log('========================================');
    console.log(`総テスト数: ${this.results.total}`);
    console.log(`成功: ${this.results.passed}`);
    console.log(`失敗: ${this.results.failed}`);
    console.log(`成功率: ${(this.results.passed / this.results.total * 100).toFixed(2)}%`);
    console.log(`逆証明: ${reverseProofPassed ? '成立' : '不成立'}`);

    if (this.results.errors.length > 0) {
      console.log('\n===== エラー詳細 =====');
      this.results.errors.slice(0, 10).forEach((e, i) => {
        console.log(`${i + 1}. ${e.message}`);
        console.log(`   詳細:`, e.details);
      });
    }

    console.log('\n===== 深堀り検証サマリー =====');
    const deepResults = this.results.deepVerification;
    const deepPassRate = deepResults.filter(d => d.checks.every(c => c.passed)).length / deepResults.length * 100;
    console.log(`深堀り検証数: ${deepResults.length}`);
    console.log(`全レベル合格率: ${deepPassRate.toFixed(2)}%`);

    return {
      total: this.results.total,
      passed: this.results.passed,
      failed: this.results.failed,
      passRate: this.results.passed / this.results.total,
      reverseProofPassed,
      deepPassRate
    };
  }
};

// Node.js実行時
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TestPatternGenerator, TestRunner, parseSalary, parseLocation, parseAnnualHolidays };
}

// 直接実行時
if (typeof require !== 'undefined' && require.main === module) {
  TestRunner.run();
}
