/**
 * Constants.js - マスタデータ・定数定義
 * 全モジュールで使用する共通定数を管理
 */

// ============================================
// 地域マスタデータ
// ============================================

/**
 * 東京23区リスト
 */
const TOKYO_23_WARDS = [
  '千代田区', '中央区', '港区', '新宿区', '文京区',
  '台東区', '墨田区', '江東区', '品川区', '目黒区',
  '大田区', '世田谷区', '渋谷区', '中野区', '杉並区',
  '豊島区', '北区', '荒川区', '板橋区', '練馬区',
  '足立区', '葛飾区', '江戸川区'
];

/**
 * 大阪市24区リスト
 */
const OSAKA_CITY_WARDS = [
  '北区', '都島区', '福島区', '此花区', '中央区',
  '西区', '港区', '大正区', '天王寺区', '浪速区',
  '西淀川区', '淀川区', '東淀川区', '東成区', '生野区',
  '旭区', '城東区', '鶴見区', '阿倍野区', '住之江区',
  '住吉区', '東住吉区', '平野区', '西成区'
];

/**
 * 政令指定都市リスト
 */
const DESIGNATED_CITIES = [
  '札幌市', '仙台市', 'さいたま市', '千葉市', '横浜市',
  '川崎市', '相模原市', '新潟市', '静岡市', '浜松市',
  '名古屋市', '京都市', '大阪市', '堺市', '神戸市',
  '岡山市', '広島市', '北九州市', '福岡市', '熊本市'
];
/** * さいたま市の区リスト */const SAITAMA_CITY_WARDS = [  '西区', '北区', '大宮区', '見沼区', '中央区',  '桜区', '浦和区', '南区', '緑区', '岩槻区'];/** * 横浜市の区リスト */const YOKOHAMA_CITY_WARDS = [  '鶴見区', '神奈川区', '西区', '中区', '南区',  '港南区', '保土ケ谷区', '旭区', '磯子区', '金沢区',  '港北区', '緑区', '青葉区', '都筑区', '戸塚区',  '栄区', '泉区', '瀬谷区'];/** * 川崎市の区リスト */const KAWASAKI_CITY_WARDS = [  '川崎区', '幸区', '中原区', '高津区', '宮前区',  '多摩区', '麻生区'];/** * 名古屋市の区リスト */const NAGOYA_CITY_WARDS = [  '千種区', '東区', '北区', '西区', '中村区',  '中区', '昭和区', '瑞穂区', '熱田区', '中川区',  '港区', '南区', '守山区', '緑区', '名東区', '天白区'];

/**
 * 都道府県と地方ブロックのマッピング
 */
const PREFECTURE_REGIONS = {
  // 北海道・東北
  '北海道': '北海道・東北',
  '青森県': '北海道・東北',
  '岩手県': '北海道・東北',
  '宮城県': '北海道・東北',
  '秋田県': '北海道・東北',
  '山形県': '北海道・東北',
  '福島県': '北海道・東北',
  // 関東
  '茨城県': '関東',
  '栃木県': '関東',
  '群馬県': '関東',
  '埼玉県': '関東',
  '千葉県': '関東',
  '東京都': '関東',
  '神奈川県': '関東',
  // 中部
  '新潟県': '中部',
  '富山県': '中部',
  '石川県': '中部',
  '福井県': '中部',
  '山梨県': '中部',
  '長野県': '中部',
  '岐阜県': '中部',
  '静岡県': '中部',
  '愛知県': '中部',
  // 近畿
  '三重県': '近畿',
  '滋賀県': '近畿',
  '京都府': '近畿',
  '大阪府': '近畿',
  '兵庫県': '近畿',
  '奈良県': '近畿',
  '和歌山県': '近畿',
  // 中国
  '鳥取県': '中国',
  '島根県': '中国',
  '岡山県': '中国',
  '広島県': '中国',
  '山口県': '中国',
  // 四国
  '徳島県': '四国',
  '香川県': '四国',
  '愛媛県': '四国',
  '高知県': '四国',
  // 九州・沖縄
  '福岡県': '九州・沖縄',
  '佐賀県': '九州・沖縄',
  '長崎県': '九州・沖縄',
  '熊本県': '九州・沖縄',
  '大分県': '九州・沖縄',
  '宮崎県': '九州・沖縄',
  '鹿児島県': '九州・沖縄',
  '沖縄県': '九州・沖縄'
};

/**
 * 都道府県リスト（検索用）
 */
const PREFECTURES = Object.keys(PREFECTURE_REGIONS);

/**
 * 都道府県別最低賃金（2025年10月施行）
 * データソース: 厚生労働省 令和7年度地域別最低賃金
 * https://www.mhlw.go.jp/stf/newpage_63030.html
 */
const MIN_WAGE_BY_PREFECTURE = {
  // 北海道・東北
  '北海道': 1075,
  '青森県': 1029,
  '岩手県': 1031,
  '宮城県': 1038,
  '秋田県': 1031,
  '山形県': 1032,
  '福島県': 1038,
  // 関東
  '茨城県': 1074,
  '栃木県': 1058,
  '群馬県': 1063,
  '埼玉県': 1141,
  '千葉県': 1140,
  '東京都': 1226,
  '神奈川県': 1225,
  // 中部
  '新潟県': 1050,
  '富山県': 1062,
  '石川県': 1054,
  '福井県': 1053,
  '山梨県': 1052,
  '長野県': 1061,
  '岐阜県': 1065,
  '静岡県': 1097,
  '愛知県': 1140,
  // 近畿
  '三重県': 1087,
  '滋賀県': 1080,
  '京都府': 1122,
  '大阪府': 1177,
  '兵庫県': 1116,
  '奈良県': 1051,
  '和歌山県': 1045,
  // 中国
  '鳥取県': 1030,
  '島根県': 1033,
  '岡山県': 1047,
  '広島県': 1085,
  '山口県': 1043,
  // 四国
  '徳島県': 1046,
  '香川県': 1038,
  '愛媛県': 1033,
  '高知県': 1023,
  // 九州・沖縄
  '福岡県': 1057,
  '佐賀県': 1030,
  '長崎県': 1031,
  '熊本県': 1034,
  '大分県': 1035,
  '宮崎県': 1023,
  '鹿児島県': 1026,
  '沖縄県': 1023
};

/**
 * 全国加重平均最低賃金（2025年10月施行）
 */
const MIN_WAGE_NATIONAL_AVERAGE = 1121;

// ============================================
// 雇用形態マスタデータ
// ============================================

/**
 * 雇用形態の正規化マッピング
 */
const EMPLOYMENT_TYPE_MAP = {
  // 正規雇用
  '正社員': { category: '正規雇用', subcategory: '正社員', code: 'FT' },
  '正職員': { category: '正規雇用', subcategory: '正社員', code: 'FT' },
  '無期雇用': { category: '正規雇用', subcategory: '正社員', code: 'FT' },

  // 契約系
  '契約社員': { category: '非正規雇用', subcategory: '契約社員', code: 'CT' },
  '嘱託社員': { category: '非正規雇用', subcategory: '契約社員', code: 'CT' },
  '嘱託': { category: '非正規雇用', subcategory: '契約社員', code: 'CT' },
  '準社員': { category: '非正規雇用', subcategory: '契約社員', code: 'CT' },

  // 派遣系
  '派遣社員': { category: '非正規雇用', subcategory: '派遣社員', code: 'DP' },
  '派遣': { category: '非正規雇用', subcategory: '派遣社員', code: 'DP' },
  '紹介予定派遣': { category: '非正規雇用', subcategory: '派遣社員', code: 'DP' },
  '無期雇用派遣': { category: '非正規雇用', subcategory: '派遣社員', code: 'DP' },

  // パート・アルバイト系
  'パート': { category: '非正規雇用', subcategory: 'パート・アルバイト', code: 'PT' },
  'アルバイト': { category: '非正規雇用', subcategory: 'パート・アルバイト', code: 'PT' },
  'パート・アルバイト': { category: '非正規雇用', subcategory: 'パート・アルバイト', code: 'PT' },

  // その他
  '業務委託': { category: 'その他', subcategory: '業務委託', code: 'FC' },
  'フリーランス': { category: 'その他', subcategory: '業務委託', code: 'FC' }
};

/**
 * 雇用形態検索キーワード（優先度順）
 */
const EMPLOYMENT_TYPE_KEYWORDS = [
  '正社員', '正職員', '無期雇用',
  '契約社員', '嘱託社員', '嘱託', '準社員',
  '紹介予定派遣', '無期雇用派遣', '派遣社員', '派遣',
  'パート・アルバイト', 'パート', 'アルバイト',
  '業務委託', 'フリーランス'
];

// ============================================
// 給与関連定数
// ============================================

/**
 * 給与タイプ
 */
const SALARY_TYPES = {
  HOURLY: 'hourly',    // 時給
  DAILY: 'daily',      // 日給
  MONTHLY: 'monthly',  // 月給
  ANNUAL: 'annual'     // 年俸/年収
};

/**
 * 給与換算パラメータ（動的設定可能）
 * 時給・日給から月給への換算基準
 */
const SALARY_CONVERSION_PARAMS = {
  hoursPerDay: 8,           // 1日の労働時間
  daysPerWeek: 5,           // 週の勤務日数（正社員基準）
  weeksPerMonth: 4,         // 月の週数
  daysPerMonth: 20,         // 月の稼働日数（正社員基準）
  monthsPerYear: 12,        // 年間月数
  // パート・アルバイト向けパラメータ
  partTimeHoursPerDay: 5,   // パートの1日労働時間
  partTimeDaysPerWeek: 3,   // パートの週勤務日数
};

/**
 * 給与換算係数（パラメータから計算）
 */
const SALARY_CONVERSION_RATES = {
  // 正社員基準（8時間×20日=160時間）
  hourly_to_monthly: SALARY_CONVERSION_PARAMS.hoursPerDay * SALARY_CONVERSION_PARAMS.daysPerMonth,  // 160
  daily_to_monthly: SALARY_CONVERSION_PARAMS.daysPerMonth,  // 20
  monthly_to_annual: SALARY_CONVERSION_PARAMS.monthsPerYear,  // 12
  annual_to_monthly: 1 / SALARY_CONVERSION_PARAMS.monthsPerYear,
  monthly_to_hourly: 1 / (SALARY_CONVERSION_PARAMS.hoursPerDay * SALARY_CONVERSION_PARAMS.daysPerMonth),
  monthly_to_daily: 1 / SALARY_CONVERSION_PARAMS.daysPerMonth,
  // パート・アルバイト基準（5時間×3日×4週=60時間）
  hourly_to_monthly_parttime: SALARY_CONVERSION_PARAMS.partTimeHoursPerDay * SALARY_CONVERSION_PARAMS.partTimeDaysPerWeek * SALARY_CONVERSION_PARAMS.weeksPerMonth  // 60
};

/**
 * 給与レンジカテゴリ（月給ベース）
 */
const SALARY_RANGES_MONTHLY = [
  { min: 0, max: 180000, label: '～18万円', code: 'M1' },
  { min: 180001, max: 220000, label: '18～22万円', code: 'M2' },
  { min: 220001, max: 260000, label: '22～26万円', code: 'M3' },
  { min: 260001, max: 300000, label: '26～30万円', code: 'M4' },
  { min: 300001, max: 350000, label: '30～35万円', code: 'M5' },
  { min: 350001, max: 400000, label: '35～40万円', code: 'M6' },
  { min: 400001, max: 500000, label: '40～50万円', code: 'M7' },
  { min: 500001, max: Infinity, label: '50万円～', code: 'M8' }
];

/**
 * 給与レンジカテゴリ（年収ベース）
 */
const SALARY_RANGES_ANNUAL = [
  { min: 0, max: 3000000, label: '～300万円', code: 'A1' },
  { min: 3000001, max: 4000000, label: '300～400万円', code: 'A2' },
  { min: 4000001, max: 5000000, label: '400～500万円', code: 'A3' },
  { min: 5000001, max: 6000000, label: '500～600万円', code: 'A4' },
  { min: 6000001, max: 8000000, label: '600～800万円', code: 'A5' },
  { min: 8000001, max: Infinity, label: '800万円～', code: 'A6' }
];

/**
 * 給与レンジカテゴリ（時給ベース）
 */
const SALARY_RANGES_HOURLY = [
  { min: 0, max: 1000, label: '～1,000円', code: 'H1' },
  { min: 1001, max: 1200, label: '1,000～1,200円', code: 'H2' },
  { min: 1201, max: 1500, label: '1,200～1,500円', code: 'H3' },
  { min: 1501, max: 2000, label: '1,500～2,000円', code: 'H4' },
  { min: 2001, max: Infinity, label: '2,000円～', code: 'H5' }
];

// ============================================
// タグカテゴリ分類
// ============================================

/**
 * タグのカテゴリ分類
 */
const TAG_CATEGORIES = {
  'アクセス': [
    '駅近5分以内', '駅近10分以内', '車通勤OK', 'バイク通勤OK',
    '駐車場あり', '送迎あり'
  ],
  '勤務期間': [
    '単発', '短期', '長期', '春夏冬休み期間限定'
  ],
  'シフト': [
    'シフト制', 'シフト自由', '月1シフト提出', '週1シフト提出', '隔週シフト提出'
  ],
  '勤務日数': [
    '週1日からOK', '週2・3日からOK', '週4日以上OK', '土日祝のみOK', '平日のみOK'
  ],
  '残業・休暇': [
    '残業なし', '残業月20時間以内', '残業月20時間以上',
    '長期休暇あり', '家庭都合休OK', '産休・育休取得実績あり'
  ],
  '給与・待遇': [
    '賞与あり', '昇給あり', '昇格あり', '扶養内勤務OK',
    '即日払いOK', '週払いOK', '現金払いOK', '給料前払いOK'
  ],
  '雇用形態': [
    '無期雇用派遣', '社員登用あり', 'マネージャー採用'
  ],
  '福利厚生': [
    '食事補助あり', '交通費支給', '交通費', '寮・社宅あり', '住宅手当あり',
    'ストックオプションあり', '社会保険完備', '研修あり',
    '資格取得支援あり', '社割あり', '育児サポートあり',
    '社内ベンチャー制度あり', '独立支援あり'
  ],
  '働き方': [
    '副業・WワークOK', '完全在宅', '在宅OK', '海外出張あり', '転勤なし'
  ],
  '歓迎条件': [
    '高校生歓迎', '学生歓迎', 'フリーター歓迎', '主婦・主夫歓迎',
    '留学生活躍中', '40代以上も応募可', '50代以上も応募可', '60代以上も応募可',
    'U・Iターン歓迎', 'ブランクOK', '障がい者採用', '新卒', '第二新卒歓迎'
  ],
  '経験・資格': [
    '学歴不問', '未経験者歓迎', '経験者歓迎', '有資格者歓迎',
    '中国語', 'PCスキル', '英語'
  ],
  '職場環境': [
    'オープニングスタッフ', '服装自由', '制服貸与',
    'ピアスOK', '髪型・髪色自由', 'ひげOK', 'ネイルOK'
  ],
  '応募': [
    '履歴書不要', '大量募集', '即日勤務OK', '友達と応募OK'
  ]
};

/**
 * 全タグリスト（フラット化）
 */
const ALL_TAGS = Object.values(TAG_CATEGORIES).flat();

// ============================================
// ダッシュボード設定
// ============================================

/**
 * チャートカラーパレット
 */
const CHART_COLORS = {
  primary: ['#4285f4', '#34a853', '#fbbc05', '#ea4335', '#673ab7', '#00bcd4', '#ff5722', '#795548'],
  pastel: ['#a8d5ff', '#98e698', '#ffe082', '#ffab91', '#ce93d8', '#80deea', '#ffcc80', '#bcaaa4'],
  gradient: {
    blue: ['#e3f2fd', '#90caf9', '#42a5f5', '#1e88e5', '#1565c0'],
    green: ['#e8f5e9', '#a5d6a7', '#66bb6a', '#43a047', '#2e7d32']
  }
};

/**
 * ダッシュボードデフォルト設定
 */
const DASHBOARD_CONFIG = {
  refreshInterval: 0,  // 自動更新なし（手動のみ）
  defaultDateRange: 30, // 過去30日
  maxDataPoints: 1000,  // 最大表示データ数
  chartAnimationDuration: 750
};

// ============================================
// キャッシュ設定
// ============================================

/**
 * キャッシュTTL（秒）
 */
const CACHE_TTL = {
  summary: 3600,      // 1時間
  aggregations: 1800, // 30分
  filters: 7200       // 2時間
};

// ============================================
// データソース設定
// ============================================

/**
 * データソース識別キー
 */
const DATA_SOURCE_TYPES = {
  INDEED: 'indeed',
  KYUJIN_BOX: 'kyujin_box',
  UNKNOWN: 'unknown'
};

/**
 * データソース別カラムマッピング
 * 各データソースのCSVカラム名を内部フィールド名にマッピング
 */
const DATA_SOURCE_COLUMNS = {
  // Indeed形式（CSSクラス名ベースのヘッダー）
  [DATA_SOURCE_TYPES.INDEED]: {
    // 識別用カラム（Indeedはjobsearch-JobCard-tagまたはjcs-/css-接頭辞のカラムで判定）
    // 複数のIndeed形式に対応するため、いくつかのパターンをチェック
    identifierColumns: ['jobsearch-JobCard-tag', 'jcs-JobTitle', 'css-bxyec3'],
    // カラムマッピング（動的検出を使用するため参考情報）
    columns: {
      url: 'jcs-JobTitle href',  // または css-bxyec3 href
      title: 'jcs-JobTitle',     // または css-bxyec3
      company: '会社名',
      location: '勤務地',
      salary: '給与',
      employmentType: '雇用形態',
      description: '仕事内容',
      tags: ['jobsearch-JobCard-tag']  // 複数カラム
    },
    // 年間休日情報のソース（カラム名またはnull）
    annualHolidaysSource: null  // Indeedには年間休日カラムなし
  },

  // 求人ボックス形式
  [DATA_SOURCE_TYPES.KYUJIN_BOX]: {
    // 識別用カラム（このカラムが存在すれば求人ボックスと判定）
    identifierColumns: ['p-result_name', 'p-result_company', 'c-icon'],
    // カラムマッピング
    columns: {
      url: 'p-result_title_link href',
      title: 'p-result_name',
      company: 'p-result_company',
      location: 'c-icon',           // 勤務地
      salary: 'c-icon (2)',         // 給与
      employmentType: 'c-icon (3)', // 雇用形態
      description: 'p-result_lines', // 詳細テキスト（年間休日含む）
      newLabel: 'p-result_new',     // 新着フラグ
      // タグカラム（複数）
      tags: [
        'p-result_tag_feature--ver2',
        'p-result_tag_feature--ver2 (2)',
        'p-result_tag_feature--ver2 (3)',
        'p-result_tag_feature--ver2 (4)',
        'p-result_tag_feature--ver2 (5)',
        'p-result_tag_feature--ver2 (6)',
        'p-result_tag_feature--ver2 (7)'
      ]
    },
    // 年間休日情報のソース（descriptionから抽出）
    annualHolidaysSource: 'description'
  }
};

/**
 * 年間休日抽出用正規表現パターン
 * 求人ボックスのp-result_linesから年間休日を抽出
 * 優先度順（上から順にマッチを試行）
 */
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
 * 年間休日のカテゴリ分類（統計用）
 * 75日～130日超の範囲をカバー
 */
const ANNUAL_HOLIDAYS_RANGES = [
  { min: 0, max: 89, label: '～89日', code: 'H0', description: '週休1.5日程度' },
  { min: 90, max: 104, label: '90～104日', code: 'H1', description: '週休2日未満' },
  { min: 105, max: 119, label: '105～119日', code: 'H2', description: '週休2日程度' },
  { min: 120, max: 124, label: '120～124日', code: 'H3', description: '週休2日+祝日' },
  { min: 125, max: 129, label: '125～129日', code: 'H4', description: '完全週休2日+α' },
  { min: 130, max: Infinity, label: '130日～', code: 'H5', description: '優良企業' }
];

// ============================================
// エクスポート用（モジュールパターン）
// ============================================

/**
 * 定数をまとめて取得
 */
function getConstants() {
  return {
    // 地域
    TOKYO_23_WARDS,
    OSAKA_CITY_WARDS,
    DESIGNATED_CITIES,
    PREFECTURE_REGIONS,
    PREFECTURES,
    // 最低賃金
    MIN_WAGE_BY_PREFECTURE,
    MIN_WAGE_NATIONAL_AVERAGE,
    // 雇用形態
    EMPLOYMENT_TYPE_MAP,
    EMPLOYMENT_TYPE_KEYWORDS,
    // 給与
    SALARY_TYPES,
    SALARY_CONVERSION_RATES,
    SALARY_RANGES_MONTHLY,
    SALARY_RANGES_ANNUAL,
    SALARY_RANGES_HOURLY,
    // タグ
    TAG_CATEGORIES,
    ALL_TAGS,
    // ダッシュボード
    CHART_COLORS,
    DASHBOARD_CONFIG,
    // キャッシュ
    CACHE_TTL,
    // データソース
    DATA_SOURCE_TYPES,
    DATA_SOURCE_COLUMNS,
    ANNUAL_HOLIDAYS_PATTERNS,
    ANNUAL_HOLIDAYS_RANGES
  };
}

/**
 * データソースを自動判定（改良版：部分一致対応）
 * @param {string[]} headers - CSVヘッダー配列
 * @returns {string} データソースタイプ
 */
function detectDataSource(headers) {
  if (!headers || !Array.isArray(headers)) {
    return DATA_SOURCE_TYPES.UNKNOWN;
  }

  const headerList = headers.map(h => h.trim());

  // 各データソースの識別カラムをチェック
  for (const [sourceType, config] of Object.entries(DATA_SOURCE_COLUMNS)) {
    const identifiers = config.identifierColumns;

    // 部分一致でチェック（ヘッダーの先頭部分が識別カラム名と一致するか）
    // 例: "jobsearch-JobCard-tag (2)" は "jobsearch-JobCard-tag" にマッチ
    const matchCount = identifiers.filter(col => {
      return headerList.some(header =>
        header === col ||
        header.startsWith(col + ' ') ||
        header.startsWith(col + '(')
      );
    }).length;

    // 識別カラムの半数以上がマッチすればそのソースと判定
    if (matchCount >= Math.ceil(identifiers.length / 2)) {
      return sourceType;
    }
  }

  return DATA_SOURCE_TYPES.UNKNOWN;
}

/**
 * 年間休日をテキストから抽出
 * @param {string} text - 抽出元テキスト
 * @returns {number|null} 年間休日数（見つからない場合はnull）
 */
function extractAnnualHolidays(text) {
  if (!text || typeof text !== 'string') {
    return null;
  }

  for (const pattern of ANNUAL_HOLIDAYS_PATTERNS) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const days = parseInt(match[1], 10);
      // 妥当な範囲チェック（見切れデータ対策）
      // - 2桁（70-99）: 70日台は週休1日程度で実在、80-99も実データに存在
      // - 3桁（100-180）: 一般的な範囲
      // - 注意: 2桁で70未満（11, 12等）はCSVトランケートの可能性大なので除外
      //         （例: 年間休日11... は元々110日等が見切れたデータ）
      const isValid = (days >= 70 && days <= 99) || (days >= 100 && days <= 180);
      if (isValid) {
        return days;
      }
    }
  }

  return null;
}

/**
 * 年間休日のカテゴリを取得
 * @param {number} days - 年間休日数
 * @returns {Object|null} カテゴリ情報
 */
function getAnnualHolidaysCategory(days) {
  if (days === null || days === undefined) {
    return null;
  }

  for (const range of ANNUAL_HOLIDAYS_RANGES) {
    if (days >= range.min && days <= range.max) {
      return range;
    }
  }

  return null;
}

// ============================================
// 数値フォーマット用ユーティリティ関数
// ============================================

/**
 * パーセンテージを小数点第1位にフォーマット
 * @param {number} value - 0-100の値
 * @returns {number} 小数点第1位に丸めた値
 */
function formatRate(value) {
  if (value === null || value === undefined || isNaN(value)) {
    return 0;
  }
  return Math.round(value * 10) / 10;
}

/**
 * 比率からパーセンテージを計算（小数点第1位）
 * @param {number} numerator - 分子
 * @param {number} denominator - 分母
 * @returns {number} 小数点第1位のパーセンテージ
 */
function calcRate(numerator, denominator) {
  if (!denominator || denominator === 0) {
    return 0;
  }
  return Math.round((numerator / denominator) * 100 * 10) / 10;
}

/**
 * 金額を万円単位でフォーマット（小数点第1位）
 * @param {number} value - 円単位の金額
 * @returns {string} "XX.X万円" 形式の文字列
 */
function formatManYen(value) {
  if (value === null || value === undefined || isNaN(value)) {
    return '-';
  }
  return (Math.round(value / 1000) / 10).toFixed(1) + '万円';
}

/**
 * 数値を小数点第1位にフォーマット
 * @param {number} value - 数値
 * @returns {number} 小数点第1位に丸めた値
 */
function formatDecimal1(value) {
  if (value === null || value === undefined || isNaN(value)) {
    return 0;
  }
  return Math.round(value * 10) / 10;
}

// ============================================
// 最低賃金関連ユーティリティ
// ============================================

/**
 * 都道府県名から最低賃金を取得
 * @param {string} prefecture - 都道府県名（「県」「府」「都」付き）
 * @returns {number|null} 最低賃金（円）、見つからない場合はnull
 */
function getMinWage(prefecture) {
  if (!prefecture) return null;
  return MIN_WAGE_BY_PREFECTURE[prefecture] || null;
}

/**
 * 時給と最低賃金を比較
 * @param {number} hourlyWage - 時給（円）
 * @param {string} prefecture - 都道府県名
 * @returns {Object} 比較結果
 */
function compareWithMinWage(hourlyWage, prefecture) {
  const minWage = getMinWage(prefecture);
  if (!minWage || !hourlyWage) {
    return {
      minWage: minWage,
      difference: null,
      ratio: null,
      isBelowMinWage: null,
      differencePercent: null
    };
  }

  const difference = hourlyWage - minWage;
  const ratio = hourlyWage / minWage;
  const differencePercent = ((hourlyWage - minWage) / minWage) * 100;

  return {
    minWage: minWage,
    difference: difference,
    ratio: Math.round(ratio * 100) / 100,
    isBelowMinWage: hourlyWage < minWage,
    differencePercent: Math.round(differencePercent * 10) / 10
  };
}

/**
 * 最低賃金比率のカテゴリを取得
 * @param {number} ratio - 最低賃金に対する比率（1.0 = 最低賃金と同額）
 * @returns {Object} カテゴリ情報
 */
function getMinWageRatioCategory(ratio) {
  if (ratio === null || ratio === undefined) {
    return { label: '不明', code: 'UNKNOWN', color: '#999' };
  }

  if (ratio < 1.0) {
    return { label: '最低賃金未満', code: 'BELOW', color: '#e53935' };
  } else if (ratio < 1.05) {
    return { label: '最低賃金水準', code: 'MIN', color: '#fb8c00' };
  } else if (ratio < 1.15) {
    return { label: '最低賃金+5〜15%', code: 'LOW', color: '#fdd835' };
  } else if (ratio < 1.30) {
    return { label: '最低賃金+15〜30%', code: 'MID', color: '#7cb342' };
  } else {
    return { label: '最低賃金+30%以上', code: 'HIGH', color: '#43a047' };
  }
}
