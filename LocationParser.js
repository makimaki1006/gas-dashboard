/**
 * LocationParser.js - 所在地解析モジュール
 * 日本の住所表記を解析し、地域分類を行う
 * 全国対応・表記ゆれ対応強化版
 */

// 全政令指定都市の区リスト
const DESIGNATED_CITY_WARDS = {
  '札幌市': ['中央区', '北区', '東区', '白石区', '厚別区', '豊平区', '清田区', '南区', '西区', '手稲区'],
  '仙台市': ['青葉区', '宮城野区', '若林区', '太白区', '泉区'],
  'さいたま市': ['西区', '北区', '大宮区', '見沼区', '中央区', '桜区', '浦和区', '南区', '緑区', '岩槻区'],
  '千葉市': ['中央区', '花見川区', '稲毛区', '若葉区', '緑区', '美浜区'],
  '横浜市': ['鶴見区', '神奈川区', '西区', '中区', '南区', '保土ケ谷区', '磯子区', '金沢区', '港北区', '戸塚区', '港南区', '旭区', '緑区', '瀬谷区', '栄区', '泉区', '青葉区', '都筑区'],
  '川崎市': ['川崎区', '幸区', '中原区', '高津区', '多摩区', '宮前区', '麻生区'],
  '相模原市': ['緑区', '中央区', '南区'],
  '新潟市': ['北区', '東区', '中央区', '江南区', '秋葉区', '南区', '西区', '西蒲区'],
  '静岡市': ['葵区', '駿河区', '清水区'],
  '浜松市': ['中央区', '浜名区', '天竜区'],
  '名古屋市': ['千種区', '東区', '北区', '西区', '中村区', '中区', '昭和区', '瑞穂区', '熱田区', '中川区', '港区', '南区', '守山区', '緑区', '名東区', '天白区'],
  '京都市': ['北区', '上京区', '左京区', '中京区', '東山区', '下京区', '南区', '右京区', '伏見区', '山科区', '西京区'],
  '大阪市': ['都島区', '福島区', '此花区', '西区', '港区', '大正区', '天王寺区', '浪速区', '西淀川区', '東淀川区', '東成区', '生野区', '旭区', '城東区', '阿倍野区', '住吉区', '東住吉区', '西成区', '淀川区', '鶴見区', '住之江区', '平野区', '北区', '中央区'],
  '堺市': ['堺区', '中区', '東区', '西区', '南区', '北区', '美原区'],
  '神戸市': ['東灘区', '灘区', '兵庫区', '長田区', '須磨区', '垂水区', '北区', '中央区', '西区'],
  '岡山市': ['北区', '中区', '東区', '南区'],
  '広島市': ['中区', '東区', '南区', '西区', '安佐南区', '安佐北区', '安芸区', '佐伯区'],
  '北九州市': ['門司区', '若松区', '戸畑区', '小倉北区', '小倉南区', '八幡東区', '八幡西区'],
  '福岡市': ['東区', '博多区', '中央区', '南区', '西区', '城南区', '早良区'],
  '熊本市': ['中央区', '東区', '西区', '南区', '北区']
};


// 曖昧な住所表現のマッピング
const AMBIGUOUS_LOCATION_MAP = {
  // 都道府県略称
  '都内': { prefecture: '東京都', regionBlock: '関東', cityType: '東京都内' },
  '東京都内': { prefecture: '東京都', regionBlock: '関東', cityType: '東京都内' },
  '23区内': { prefecture: '東京都', regionBlock: '関東', cityType: '東京23区' },
  '23区': { prefecture: '東京都', regionBlock: '関東', cityType: '東京23区' },
  '県内': { prefecture: null, regionBlock: null, cityType: '県内' },
  '府内': { prefecture: null, regionBlock: null, cityType: '府内' },
  '道内': { prefecture: '北海道', regionBlock: '北海道・東北', cityType: '北海道内' },

  // 広域表現
  '首都圏': { prefecture: null, regionBlock: '関東', cityType: '首都圏' },
  '関東圏': { prefecture: null, regionBlock: '関東', cityType: '関東圏' },
  '関西圏': { prefecture: null, regionBlock: '近畿', cityType: '関西圏' },
  '近畿圏': { prefecture: null, regionBlock: '近畿', cityType: '近畿圏' },
  '東海': { prefecture: null, regionBlock: '中部', cityType: '東海' },
  '東海エリア': { prefecture: null, regionBlock: '中部', cityType: '東海' },
  '北関東': { prefecture: null, regionBlock: '関東', cityType: '北関東' },
  '南関東': { prefecture: null, regionBlock: '関東', cityType: '南関東' },
  '全国': { prefecture: null, regionBlock: '全国', cityType: '全国' },
  '各地': { prefecture: null, regionBlock: '全国', cityType: '全国' },

  // リモート・在宅
  '在宅': { prefecture: null, regionBlock: 'リモート', cityType: 'リモート' },
  '在宅勤務': { prefecture: null, regionBlock: 'リモート', cityType: 'リモート' },
  'リモート': { prefecture: null, regionBlock: 'リモート', cityType: 'リモート' },
  'フルリモート': { prefecture: null, regionBlock: 'リモート', cityType: 'フルリモート' },
  'テレワーク': { prefecture: null, regionBlock: 'リモート', cityType: 'リモート' },
  '完全在宅': { prefecture: null, regionBlock: 'リモート', cityType: 'フルリモート' }
};

// 主要駅と市区町村のマッピング（全国版）
const STATION_TO_CITY = {
  // 北海道
  '札幌駅': { city: '札幌市中央区', prefecture: '北海道' },
  '函館駅': { city: '函館市', prefecture: '北海道' },
  '旭川駅': { city: '旭川市', prefecture: '北海道' },
  '帯広駅': { city: '帯広市', prefecture: '北海道' },
  '釧路駅': { city: '釧路市', prefecture: '北海道' },
  '小樽駅': { city: '小樽市', prefecture: '北海道' },
  '新千歳空港駅': { city: '千歳市', prefecture: '北海道' },
  // 東北
  '仙台駅': { city: '仙台市青葉区', prefecture: '宮城県' },
  '盛岡駅': { city: '盛岡市', prefecture: '岩手県' },
  '青森駅': { city: '青森市', prefecture: '青森県' },
  '秋田駅': { city: '秋田市', prefecture: '秋田県' },
  '山形駅': { city: '山形市', prefecture: '山形県' },
  '福島駅': { city: '福島市', prefecture: '福島県' },
  '郡山駅': { city: '郡山市', prefecture: '福島県' },
  // 関東（埼玉）
  '大宮駅': { city: 'さいたま市大宮区', prefecture: '埼玉県' },
  '浦和駅': { city: 'さいたま市浦和区', prefecture: '埼玉県' },
  '南浦和駅': { city: 'さいたま市南区', prefecture: '埼玉県' },
  '武蔵浦和駅': { city: 'さいたま市南区', prefecture: '埼玉県' },
  '北浦和駅': { city: 'さいたま市浦和区', prefecture: '埼玉県' },
  'さいたま新都心駅': { city: 'さいたま市中央区', prefecture: '埼玉県' },
  '川口駅': { city: '川口市', prefecture: '埼玉県' },
  '西川口駅': { city: '川口市', prefecture: '埼玉県' },
  '蕨駅': { city: '蕨市', prefecture: '埼玉県' },
  '川越駅': { city: '川越市', prefecture: '埼玉県' },
  '所沢駅': { city: '所沢市', prefecture: '埼玉県' },
  '越谷駅': { city: '越谷市', prefecture: '埼玉県' },
  '南越谷駅': { city: '越谷市', prefecture: '埼玉県' },
  '越谷レイクタウン駅': { city: '越谷市', prefecture: '埼玉県' },
  '草加駅': { city: '草加市', prefecture: '埼玉県' },
  '春日部駅': { city: '春日部市', prefecture: '埼玉県' },
  '熊谷駅': { city: '熊谷市', prefecture: '埼玉県' },
  '上尾駅': { city: '上尾市', prefecture: '埼玉県' },
  '戸田駅': { city: '戸田市', prefecture: '埼玉県' },
  '戸田公園駅': { city: '戸田市', prefecture: '埼玉県' },
  '朝霞駅': { city: '朝霞市', prefecture: '埼玉県' },
  '志木駅': { city: '志木市', prefecture: '埼玉県' },
  '和光市駅': { city: '和光市', prefecture: '埼玉県' },
  '三郷駅': { city: '三郷市', prefecture: '埼玉県' },
  '八潮駅': { city: '八潮市', prefecture: '埼玉県' },
  // 関東（千葉）
  '千葉駅': { city: '千葉市中央区', prefecture: '千葉県' },
  '船橋駅': { city: '船橋市', prefecture: '千葉県' },
  '西船橋駅': { city: '船橋市', prefecture: '千葉県' },
  '松戸駅': { city: '松戸市', prefecture: '千葉県' },
  '柏駅': { city: '柏市', prefecture: '千葉県' },
  '市川駅': { city: '市川市', prefecture: '千葉県' },
  '本八幡駅': { city: '市川市', prefecture: '千葉県' },
  '津田沼駅': { city: '習志野市', prefecture: '千葉県' },
  '成田駅': { city: '成田市', prefecture: '千葉県' },
  '舞浜駅': { city: '浦安市', prefecture: '千葉県' },
  '新浦安駅': { city: '浦安市', prefecture: '千葉県' },
  '海浜幕張駅': { city: '千葉市美浜区', prefecture: '千葉県' },
  '流山おおたかの森駅': { city: '流山市', prefecture: '千葉県' },
  // 関東（東京）
  '東京駅': { city: '千代田区', prefecture: '東京都' },
  '新宿駅': { city: '新宿区', prefecture: '東京都' },
  '渋谷駅': { city: '渋谷区', prefecture: '東京都' },
  '池袋駅': { city: '豊島区', prefecture: '東京都' },
  '品川駅': { city: '港区', prefecture: '東京都' },
  '上野駅': { city: '台東区', prefecture: '東京都' },
  '秋葉原駅': { city: '千代田区', prefecture: '東京都' },
  '六本木駅': { city: '港区', prefecture: '東京都' },
  '銀座駅': { city: '中央区', prefecture: '東京都' },
  '立川駅': { city: '立川市', prefecture: '東京都' },
  '八王子駅': { city: '八王子市', prefecture: '東京都' },
  '町田駅': { city: '町田市', prefecture: '東京都' },
  '吉祥寺駅': { city: '武蔵野市', prefecture: '東京都' },
  '三鷹駅': { city: '三鷹市', prefecture: '東京都' },
  '北千住駅': { city: '足立区', prefecture: '東京都' },
  '錦糸町駅': { city: '墨田区', prefecture: '東京都' },
  '蒲田駅': { city: '大田区', prefecture: '東京都' },
  '恵比寿駅': { city: '渋谷区', prefecture: '東京都' },
  '目黒駅': { city: '品川区', prefecture: '東京都' },
  '五反田駅': { city: '品川区', prefecture: '東京都' },
  '中野駅': { city: '中野区', prefecture: '東京都' },
  '荻窪駅': { city: '杉並区', prefecture: '東京都' },
  '赤羽駅': { city: '北区', prefecture: '東京都' },
  // 関東（神奈川）
  '横浜駅': { city: '横浜市西区', prefecture: '神奈川県' },
  '川崎駅': { city: '川崎市川崎区', prefecture: '神奈川県' },
  '武蔵小杉駅': { city: '川崎市中原区', prefecture: '神奈川県' },
  '溝の口駅': { city: '川崎市高津区', prefecture: '神奈川県' },
  '藤沢駅': { city: '藤沢市', prefecture: '神奈川県' },
  '小田原駅': { city: '小田原市', prefecture: '神奈川県' },
  '相模大野駅': { city: '相模原市南区', prefecture: '神奈川県' },
  '橋本駅': { city: '相模原市緑区', prefecture: '神奈川県' },
  '鎌倉駅': { city: '鎌倉市', prefecture: '神奈川県' },
  '海老名駅': { city: '海老名市', prefecture: '神奈川県' },
  // 中部
  '名古屋駅': { city: '名古屋市中村区', prefecture: '愛知県' },
  '栄駅': { city: '名古屋市中区', prefecture: '愛知県' },
  '金山駅': { city: '名古屋市中区', prefecture: '愛知県' },
  '豊橋駅': { city: '豊橋市', prefecture: '愛知県' },
  '岡崎駅': { city: '岡崎市', prefecture: '愛知県' },
  '静岡駅': { city: '静岡市葵区', prefecture: '静岡県' },
  '浜松駅': { city: '浜松市中央区', prefecture: '静岡県' },
  '新潟駅': { city: '新潟市中央区', prefecture: '新潟県' },
  '長野駅': { city: '長野市', prefecture: '長野県' },
  '金沢駅': { city: '金沢市', prefecture: '石川県' },
  '富山駅': { city: '富山市', prefecture: '富山県' },
  '岐阜駅': { city: '岐阜市', prefecture: '岐阜県' },
  '甲府駅': { city: '甲府市', prefecture: '山梨県' },
  // 近畿
  '大阪駅': { city: '大阪市北区', prefecture: '大阪府' },
  '梅田駅': { city: '大阪市北区', prefecture: '大阪府' },
  '難波駅': { city: '大阪市中央区', prefecture: '大阪府' },
  '天王寺駅': { city: '大阪市天王寺区', prefecture: '大阪府' },
  '京橋駅': { city: '大阪市都島区', prefecture: '大阪府' },
  '堺駅': { city: '堺市堺区', prefecture: '大阪府' },
  '京都駅': { city: '京都市下京区', prefecture: '京都府' },
  '河原町駅': { city: '京都市中京区', prefecture: '京都府' },
  '三宮駅': { city: '神戸市中央区', prefecture: '兵庫県' },
  '神戸駅': { city: '神戸市中央区', prefecture: '兵庫県' },
  '姫路駅': { city: '姫路市', prefecture: '兵庫県' },
  '奈良駅': { city: '奈良市', prefecture: '奈良県' },
  '和歌山駅': { city: '和歌山市', prefecture: '和歌山県' },
  '大津駅': { city: '大津市', prefecture: '滋賀県' },
  // 中国・四国・九州
  '広島駅': { city: '広島市南区', prefecture: '広島県' },
  '岡山駅': { city: '岡山市北区', prefecture: '岡山県' },
  '倉敷駅': { city: '倉敷市', prefecture: '岡山県' },
  '福山駅': { city: '福山市', prefecture: '広島県' },
  '高松駅': { city: '高松市', prefecture: '香川県' },
  '松山駅': { city: '松山市', prefecture: '愛媛県' },
  '高知駅': { city: '高知市', prefecture: '高知県' },
  '徳島駅': { city: '徳島市', prefecture: '徳島県' },
  '博多駅': { city: '福岡市博多区', prefecture: '福岡県' },
  '天神駅': { city: '福岡市中央区', prefecture: '福岡県' },
  '小倉駅': { city: '北九州市小倉北区', prefecture: '福岡県' },
  '熊本駅': { city: '熊本市西区', prefecture: '熊本県' },
  '鹿児島中央駅': { city: '鹿児島市', prefecture: '鹿児島県' },
  '長崎駅': { city: '長崎市', prefecture: '長崎県' },
  '大分駅': { city: '大分市', prefecture: '大分県' },
  '宮崎駅': { city: '宮崎市', prefecture: '宮崎県' },
  '佐賀駅': { city: '佐賀市', prefecture: '佐賀県' },
  '那覇駅': { city: '那覇市', prefecture: '沖縄県' }
};

// 東京23区マッピング
const TOKYO_WARDS_MAP = {
  '千代田区': '東京都', '中央区': '東京都', '港区': '東京都', '新宿区': '東京都',
  '文京区': '東京都', '台東区': '東京都', '墨田区': '東京都', '江東区': '東京都',
  '品川区': '東京都', '目黒区': '東京都', '大田区': '東京都', '世田谷区': '東京都',
  '渋谷区': '東京都', '中野区': '東京都', '杉並区': '東京都', '豊島区': '東京都',
  '北区': '東京都', '荒川区': '東京都', '板橋区': '東京都', '練馬区': '東京都',
  '足立区': '東京都', '葛飾区': '東京都', '江戸川区': '東京都'
};

// 東京23区の省略形マッピング（「渋谷」→「渋谷区」など）
// ※「中央」「北」「港」など短い名前は他の地名・施設名と混同するため除外
const TOKYO_WARD_ALIASES = {
  '千代田': '千代田区', '新宿': '新宿区',
  '文京': '文京区', '台東': '台東区', '墨田': '墨田区', '江東': '江東区',
  '品川': '品川区', '目黒': '目黒区', '大田': '大田区', '世田谷': '世田谷区',
  '渋谷': '渋谷区', '中野': '中野区', '杉並': '杉並区', '豊島': '豊島区',
  '荒川': '荒川区', '板橋': '板橋区', '練馬': '練馬区',
  '足立': '足立区', '葛飾': '葛飾区', '江戸川': '江戸川区'
  // 除外: '中央'（中央病院、中央通りなど）, '北'（北病院、北町など）, '港'（港町など）
};

// 政令指定都市の都道府県マッピング
const DESIGNATED_CITY_PREFECTURE = {
  '札幌市': '北海道', '仙台市': '宮城県', 'さいたま市': '埼玉県', '千葉市': '千葉県',
  '横浜市': '神奈川県', '川崎市': '神奈川県', '相模原市': '神奈川県', '新潟市': '新潟県',
  '静岡市': '静岡県', '浜松市': '静岡県', '名古屋市': '愛知県', '京都市': '京都府',
  '大阪市': '大阪府', '堺市': '大阪府', '神戸市': '兵庫県', '岡山市': '岡山県',
  '広島市': '広島県', '北九州市': '福岡県', '福岡市': '福岡県', '熊本市': '熊本県'
};

// 政令指定都市の省略形マッピング（「名古屋」→「名古屋市」など）
const DESIGNATED_CITY_ALIASES = {
  '札幌': '札幌市', '仙台': '仙台市', 'さいたま': 'さいたま市', '千葉': '千葉市',
  '横浜': '横浜市', '川崎': '川崎市', '相模原': '相模原市', '新潟': '新潟市',
  '静岡': '静岡市', '浜松': '浜松市', '名古屋': '名古屋市', '京都': '京都市',
  '大阪': '大阪市', '堺': '堺市', '神戸': '神戸市', '岡山': '岡山市',
  '広島': '広島市', '北九州': '北九州市', '福岡': '福岡市', '熊本': '熊本市'
};

function parseLocation(locationText) {
  if (!locationText || locationText === '') {
    return createEmptyLocationResult();
  }
  const text = normalizeLocationText(locationText);

  // 駅名から推測（駅名は場所が一意に決まるので最優先）
  const stationResult = tryStationMatch(text);
  if (stationResult) return stationResult;

  // 🔴 新ロジック: 市区町村から都道府県を逆引き（検証付き）
  const validatedResult = tryValidatedLocationMatch(text);
  if (validatedResult) return validatedResult;

  // フォールバック: 従来のロジック（上記で解決できない場合）
  const prefecture = extractPrefecture(text);
  const cityWard = extractCityWard(text, prefecture);
  const regionBlock = prefecture ? PREFECTURE_REGIONS[prefecture] : null;
  const cityType = determineCityType(prefecture, cityWard);
  const stationName = extractStationName(text);

  return {
    originalText: locationText,
    regionBlock: regionBlock,
    prefecture: prefecture,
    cityType: cityType,
    cityWard: cityWard,
    stationName: stationName,
    isComplete: prefecture !== null && cityWard !== null
  };
}

/**
 * 🔴 新ロジック: 都道府県と市区町村をセットで検証
 * 市区町村を先に特定し、その市区町村が属する都道府県を逆引きする
 */
function tryValidatedLocationMatch(text) {
  // 🔴 政令指定都市名が含まれるかチェック（東京23区チェックをスキップするため）
  const hasDesignatedCityName = Object.keys(DESIGNATED_CITY_WARDS).some(cityName => text.includes(cityName));

  // 🔴 FIX: 「東京都」が明示的に含まれる場合は東京23区を最優先
  const hasTokyoPrefecture = text.includes('東京都') || text.includes('東京 ');

  // 🔴 FIX: 東京23区と政令指定都市で共有される区名（曖昧な区名）
  // これらの区名のみの場合は東京にデフォルトしない
  const SHARED_WARD_NAMES = ['北区', '中央区'];

  // 1. 東京23区をチェック（区名から東京都を確定）
  // ※ 政令指定都市名（札幌市、さいたま市等）が含まれる場合はスキップ
  // 🔴 FIX: ただし「東京都」が明示されている場合は必ずチェック
  if (!hasDesignatedCityName || hasTokyoPrefecture) {
    for (const ward of Object.keys(TOKYO_WARDS_MAP)) {
      if (text.includes(ward)) {
        // 🔴 FIX: 共有区名（北区、中央区）の場合は追加のコンテキストが必要
        const isSharedWard = SHARED_WARD_NAMES.includes(ward);

        // 🔴 FIX: 共有区名の場合、テキストが区名のみ（または区名+少数文字）なら曖昧として扱う
        const textWithoutWard = text.replace(ward, '').trim();
        const isWardOnly = textWithoutWard.length < 3; // 区名以外がほぼない場合

        if (isSharedWard && isWardOnly && !hasTokyoPrefecture) {
          // 共有区名のみの場合はスキップ（後続処理で曖昧として扱う）
          continue;
        }

        // 🔴 FIX: 東京都が明示されている場合、または他の都道府県の位置情報が含まれていない場合のみ東京と判定
        if (hasTokyoPrefecture || !checkConflictingLocation(text, '東京都')) {
          return {
            originalText: text,
            regionBlock: '関東',
            prefecture: '東京都',
            cityType: '東京23区',
            cityWard: ward,
            stationName: extractStationName(text),
            isComplete: true
          };
        }
      }
    }
  }

  // 2. 政令指定都市の区をチェック（区名から市・都道府県を確定）
  for (const [cityName, wards] of Object.entries(DESIGNATED_CITY_WARDS)) {
    for (const ward of wards) {
      // 区名がテキストに含まれるかチェック
      if (text.includes(ward)) {
        // この区名が一意かチェック（他の政令指定都市にも同名の区があるか）
        const matchingCities = findCitiesWithWard(ward);

        if (matchingCities.length === 1) {
          // 一意に確定できる
          const prefecture = DESIGNATED_CITY_PREFECTURE[cityName];
          return {
            originalText: text,
            regionBlock: PREFECTURE_REGIONS[prefecture],
            prefecture: prefecture,
            cityType: '政令指定都市',
            cityWard: cityName + ward,
            stationName: extractStationName(text),
            isComplete: true
          };
        } else if (matchingCities.length > 1) {
          // 複数の都市に同名の区がある場合、市名も含まれているか確認
          for (const candidateCity of matchingCities) {
            if (text.includes(candidateCity)) {
              const prefecture = DESIGNATED_CITY_PREFECTURE[candidateCity];
              return {
                originalText: text,
                regionBlock: PREFECTURE_REGIONS[prefecture],
                prefecture: prefecture,
                cityType: '政令指定都市',
                cityWard: candidateCity + ward,
                stationName: extractStationName(text),
                isComplete: true
              };
            }
          }
          // 市名がない場合、都道府県名から絞り込み
          for (const candidateCity of matchingCities) {
            const prefecture = DESIGNATED_CITY_PREFECTURE[candidateCity];
            if (text.includes(prefecture)) {
              return {
                originalText: text,
                regionBlock: PREFECTURE_REGIONS[prefecture],
                prefecture: prefecture,
                cityType: '政令指定都市',
                cityWard: candidateCity + ward,
                stationName: extractStationName(text),
                isComplete: true
              };
            }
          }
        }
      }
    }
  }

  // 3. 政令指定都市の市名をチェック（市名から都道府県を確定）
  // 完全な市名でマッチ
  for (const [cityName, wards] of Object.entries(DESIGNATED_CITY_WARDS)) {
    if (text.includes(cityName)) {
      const prefecture = DESIGNATED_CITY_PREFECTURE[cityName];
      let finalCity = cityName;
      for (const ward of wards) {
        if (text.includes(ward)) {
          finalCity = cityName + ward;
          break;
        }
      }
      return {
        originalText: text,
        regionBlock: PREFECTURE_REGIONS[prefecture],
        prefecture: prefecture,
        cityType: '政令指定都市',
        cityWard: finalCity,
        stationName: extractStationName(text),
        isComplete: true
      };
    }
  }

  // 4. 省略形の政令指定都市をチェック（検証付き）
  // 長い名前から先にチェック
  const sortedAliases = Object.keys(DESIGNATED_CITY_ALIASES).sort((a, b) => b.length - a.length);
  for (const alias of sortedAliases) {
    // 🔴 重要: 「京都」は「東京都」の部分文字列なので、特別処理が必要
    // 「東京」を含む場合は「京都」のマッチをスキップ
    if (alias === '京都' && text.includes('東京')) {
      continue;
    }

    // 🔴 FIX: エイリアスが都道府県名の一部の場合はスキップ
    // 例: 「大阪府」の「大阪」を「大阪市」としてマッチさせない
    const aliasIndex = text.indexOf(alias);
    if (aliasIndex !== -1) {
      const afterAlias = text.substring(aliasIndex + alias.length);
      // エイリアスの直後が「府」「県」「都」「道」の場合は都道府県名なのでスキップ
      if (afterAlias.startsWith('府') || afterAlias.startsWith('県') ||
          afterAlias.startsWith('都') || afterAlias.startsWith('道')) {
        continue;
      }
    }

    if (text.includes(alias)) {
      const cityName = DESIGNATED_CITY_ALIASES[alias];
      const prefecture = DESIGNATED_CITY_PREFECTURE[cityName];
      const wards = DESIGNATED_CITY_WARDS[cityName] || [];

      // 🔴 検証: この市の区がテキストに含まれるか、または他の都道府県の地名が含まれていないか
      let hasMatchingWard = false;
      let finalCity = cityName;
      for (const ward of wards) {
        if (text.includes(ward)) {
          hasMatchingWard = true;
          finalCity = cityName + ward;
          break;
        }
      }

      // 区がマッチするか、他の都道府県の地名が含まれていない場合のみ採用
      if (hasMatchingWard) {
        return {
          originalText: text,
          regionBlock: PREFECTURE_REGIONS[prefecture],
          prefecture: prefecture,
          cityType: '政令指定都市',
          cityWard: finalCity,
          stationName: extractStationName(text),
          isComplete: true
        };
      }

      // 区がない場合、他の都道府県の市区町村がテキストにないか確認
      // （例: 「東京都渋谷区」に「京都」がマッチしても、「渋谷区」は京都の区ではない）
      const hasConflictingLocation = checkConflictingLocation(text, prefecture);
      if (!hasConflictingLocation) {
        return {
          originalText: text,
          regionBlock: PREFECTURE_REGIONS[prefecture],
          prefecture: prefecture,
          cityType: '政令指定都市',
          cityWard: finalCity,
          stationName: extractStationName(text),
          isComplete: true
        };
      }
      // 衝突がある場合はこの候補をスキップして次を試す
    }
  }

  // 5. 東京23区の省略形エイリアスをチェック（「渋谷」→「渋谷区」など）
  // ※ TOKYO_WARD_ALIASESを使用
  const sortedWardAliases = Object.keys(TOKYO_WARD_ALIASES).sort((a, b) => b.length - a.length);
  for (const alias of sortedWardAliases) {
    if (text.includes(alias)) {
      const ward = TOKYO_WARD_ALIASES[alias];
      return {
        originalText: text,
        regionBlock: '関東',
        prefecture: '東京都',
        cityType: '東京23区',
        cityWard: ward,
        stationName: extractStationName(text),
        isComplete: true
      };
    }
  }

  return null;
}

/**
 * 指定した区名を持つ政令指定都市のリストを返す
 */
function findCitiesWithWard(wardName) {
  const cities = [];
  for (const [cityName, wards] of Object.entries(DESIGNATED_CITY_WARDS)) {
    if (wards.includes(wardName)) {
      cities.push(cityName);
    }
  }
  return cities;
}

/**
 * テキストに、指定した都道府県以外の市区町村が含まれているかチェック
 * （誤マッチを防ぐための検証）
 */
function checkConflictingLocation(text, supposedPrefecture) {
  // 東京23区のチェック
  if (supposedPrefecture !== '東京都') {
    for (const ward of Object.keys(TOKYO_WARDS_MAP)) {
      if (text.includes(ward)) {
        return true; // 東京の区が含まれているのに東京都以外を推測 → 衝突
      }
    }
  }

  // 他の政令指定都市の区のチェック
  for (const [cityName, wards] of Object.entries(DESIGNATED_CITY_WARDS)) {
    const cityPref = DESIGNATED_CITY_PREFECTURE[cityName];
    if (cityPref === supposedPrefecture) continue; // 同じ都道府県はスキップ

    for (const ward of wards) {
      // 一意な区名のみチェック（「中央区」などは複数都市にある）
      const matchingCities = findCitiesWithWard(ward);
      if (matchingCities.length === 1 && text.includes(ward)) {
        return true; // 他の都道府県の区が含まれている → 衝突
      }
    }
  }

  return false;
}


/**
 * 曖昧な住所表現をマッチング
 */
function tryAmbiguousMatch(text) {
  // 長いキーワードから優先的にマッチ
  const sortedKeys = Object.keys(AMBIGUOUS_LOCATION_MAP).sort((a, b) => b.length - a.length);

  for (const keyword of sortedKeys) {
    if (text.includes(keyword)) {
      const mapping = AMBIGUOUS_LOCATION_MAP[keyword];
      return {
        originalText: text,
        regionBlock: mapping.regionBlock,
        prefecture: mapping.prefecture,
        cityType: mapping.cityType,
        cityWard: keyword,
        stationName: extractStationName(text),
        isComplete: mapping.prefecture !== null,
        isAmbiguous: true
      };
    }
  }
  return null;
}

function tryStationMatch(text) {
  // 「駅前」「駅周辺」を含む場合は先に正規化
  let cleanText = text.replace(/JR|ＪＲ|私鉄|地下鉄/g, '');
  cleanText = cleanText.replace(/駅前|駅周辺|駅近/g, '駅');

  const stationMatch = cleanText.match(/([^\s\d]+駅)/);
  if (!stationMatch) return null;

  // 「駅駅」のような重複を防止
  const stationName = stationMatch[1].replace(/駅+$/, '駅');
  const mapping = STATION_TO_CITY[stationName];

  if (mapping) {
    return {
      originalText: text,
      regionBlock: PREFECTURE_REGIONS[mapping.prefecture],
      prefecture: mapping.prefecture,
      cityType: determineCityType(mapping.prefecture, mapping.city),
      cityWard: mapping.city,
      stationName: stationName,
      isComplete: true
    };
  }
  return null;
}

function tryDesignatedCityMatch(text) {
  // 完全な市名でマッチ
  for (const [cityName, wards] of Object.entries(DESIGNATED_CITY_WARDS)) {
    if (text.includes(cityName)) {
      const prefecture = DESIGNATED_CITY_PREFECTURE[cityName];
      let finalCity = cityName;
      for (const ward of wards) {
        if (text.includes(ward)) {
          finalCity = cityName + ward;
          break;
        }
      }
      return {
        originalText: text,
        regionBlock: PREFECTURE_REGIONS[prefecture],
        prefecture: prefecture,
        cityType: '政令指定都市',
        cityWard: finalCity,
        stationName: extractStationName(text),
        isComplete: true
      };
    }
  }

  // 省略形でマッチ（「名古屋」→「名古屋市」など）
  // 長い名前から先にチェック
  const sortedAliases = Object.keys(DESIGNATED_CITY_ALIASES).sort((a, b) => b.length - a.length);
  for (const alias of sortedAliases) {
    // 🔴 重要: 「京都」は「東京都」の部分文字列なので、特別処理が必要
    // 「東京」を含む場合は「京都」のマッチをスキップ
    if (alias === '京都' && text.includes('東京')) {
      continue;
    }

    // 🔴 FIX: エイリアスが都道府県名の一部の場合はスキップ
    // 例: 「大阪府」の「大阪」を「大阪市」としてマッチさせない
    const aliasIndex = text.indexOf(alias);
    if (aliasIndex !== -1) {
      const afterAlias = text.substring(aliasIndex + alias.length);
      if (afterAlias.startsWith('府') || afterAlias.startsWith('県') ||
          afterAlias.startsWith('都') || afterAlias.startsWith('道')) {
        continue;
      }
    }

    if (text.includes(alias)) {
      const cityName = DESIGNATED_CITY_ALIASES[alias];
      const prefecture = DESIGNATED_CITY_PREFECTURE[cityName];
      const wards = DESIGNATED_CITY_WARDS[cityName] || [];
      let finalCity = cityName;
      for (const ward of wards) {
        if (text.includes(ward)) {
          finalCity = cityName + ward;
          break;
        }
      }
      return {
        originalText: text,
        regionBlock: PREFECTURE_REGIONS[prefecture],
        prefecture: prefecture,
        cityType: '政令指定都市',
        cityWard: finalCity,
        stationName: extractStationName(text),
        isComplete: true
      };
    }
  }

  return null;
}

function tryTokyoWardMatch(text) {
  // 完全な区名でマッチ（「渋谷区」など）
  for (const ward of Object.keys(TOKYO_WARDS_MAP)) {
    if (text.includes(ward)) {
      return {
        originalText: text,
        regionBlock: '関東',
        prefecture: '東京都',
        cityType: '東京23区',
        cityWard: ward,
        stationName: extractStationName(text),
        isComplete: true
      };
    }
  }

  // 省略形でマッチ（「渋谷」→「渋谷区」など）
  // 長い名前から先にチェック（「世田谷」を「田」より先に）
  const sortedAliases = Object.keys(TOKYO_WARD_ALIASES).sort((a, b) => b.length - a.length);
  for (const alias of sortedAliases) {
    if (text.includes(alias)) {
      const ward = TOKYO_WARD_ALIASES[alias];
      return {
        originalText: text,
        regionBlock: '関東',
        prefecture: '東京都',
        cityType: '東京23区',
        cityWard: ward,
        stationName: extractStationName(text),
        isComplete: true
      };
    }
  }

  return null;
}

function createEmptyLocationResult() {
  return { originalText: '', regionBlock: null, prefecture: null, cityType: null, cityWard: null, stationName: null, isComplete: false };
}

function normalizeLocationText(text) {
  return text.replace(/　/g, ' ').replace(/\s+/g, ' ').trim();
}

function extractPrefecture(text) {
  const sortedPrefectures = [...PREFECTURES].sort((a, b) => b.length - a.length);
  for (const pref of sortedPrefectures) {
    if (text.includes(pref)) return pref;
  }
  const parts = text.split(/\s+/).filter(p => p);
  for (const pref of sortedPrefectures) {
    if (parts.includes(pref)) return pref;
  }
  // 省略形でマッチ
  // 🔴 重要: 「東京」を「京都」より先にチェック（「東京都」に「京都」が含まれる問題を回避）
  const abbreviations = [
    { abbr: '東京', full: '東京都' },  // 東京を最優先
    { abbr: '北海道', full: '北海道' },
    { abbr: '大阪', full: '大阪府' },
    { abbr: '京都', full: '京都府' }   // 京都は最後（東京との誤マッチ防止）
  ];
  for (const { abbr, full } of abbreviations) {
    // 「京都」をチェックする前に「東京」が含まれていないことを確認
    if (abbr === '京都' && text.includes('東京')) {
      continue;
    }
    if (text.includes(abbr)) return full;
  }
  return null;
}

function extractCityWard(text, prefecture) {
  // 都道府県を除去したテキストでも検索（連続した「埼玉県川口市」パターン対応）
  let textWithoutPref = text;
  if (prefecture) {
    textWithoutPref = text.replace(prefecture, '').trim();
  }

  const parts = text.split(/\s+/).filter(p => p);
  const partsWithoutPref = prefecture ? textWithoutPref.split(/\s+/).filter(p => p) : parts;

  // 東京23区
  if (prefecture === '東京都') {
    for (const ward of TOKYO_23_WARDS) {
      if (text.includes(ward) || parts.includes(ward)) return ward;
    }
  }

  // 政令指定都市の処理
  for (const [cityName, wards] of Object.entries(DESIGNATED_CITY_WARDS)) {
    if (text.includes(cityName)) {
      for (const ward of wards) {
        if (text.includes(ward)) return cityName + ward;
      }
      return cityName;
    }
  }

  // 都道府県除去後のテキストから市町村を抽出（優先）
  for (const part of partsWithoutPref) {
    if (part.endsWith('市') && part.length > 1) return part;
  }
  for (const part of partsWithoutPref) {
    if (part.endsWith('区') && part.length > 1) return part;
  }
  for (const part of partsWithoutPref) {
    if ((part.endsWith('町') || part.endsWith('村')) && part.length > 1) return part;
  }

  // 都道府県の直後の市町村を抽出（「埼玉県川口市」パターン）
  // 都道府県を除去した後の最初の市町村をマッチ
  const afterPrefPatterns = [
    /^([^市区町村\s]+市)/,  // 先頭の市
    /^([^市区町村\s]+区)/,  // 先頭の区
    /^([^市区町村\s]+町)/,  // 先頭の町
    /^([^市区町村\s]+村)/   // 先頭の村
  ];
  for (const pattern of afterPrefPatterns) {
    const match = textWithoutPref.match(pattern);
    if (match && match[1].length > 1) return match[1];
  }

  // フォールバック: 元テキストのパーツから
  for (const part of parts) {
    if (part.endsWith('市') && part.length > 1 && !part.includes('県') && !part.includes('都') && !part.includes('府') && !part.includes('道')) return part;
  }
  for (const part of parts) {
    if (part.endsWith('区') && part.length > 1) return part;
  }
  for (const part of parts) {
    if ((part.endsWith('町') || part.endsWith('村')) && part.length > 1) return part;
  }

  // 最終フォールバック: 正規表現で市町村を抽出（都道府県除去後）
  const fallbackPatterns = [/([^県都府道\s]+市)/, /([^県都府道\s]+区)/, /([^県都府道\s]+町)/, /([^県都府道\s]+村)/];
  for (const pattern of fallbackPatterns) {
    const match = textWithoutPref.match(pattern);
    if (match && match[1].length > 1) return match[1];
  }

  return null;
}

function determineCityType(prefecture, cityWard) {
  if (!prefecture || !cityWard) return '不明';
  if (prefecture === '東京都' && TOKYO_23_WARDS.includes(cityWard)) return '東京23区';
  if (prefecture === '大阪府' && (cityWard === '大阪市' || cityWard.startsWith('大阪市'))) return '大阪市';
  for (const cityName of Object.keys(DESIGNATED_CITY_WARDS)) {
    if (cityWard.startsWith(cityName)) return '政令指定都市';
  }
  if (cityWard.endsWith('市')) return 'その他市';
  if (cityWard.endsWith('区')) return 'その他区';
  if (cityWard.endsWith('町')) return '町';
  if (cityWard.endsWith('村')) return '村';
  return 'その他';
}

function extractStationName(text) {
  // 「駅前」「駅周辺」などを除外して純粋な駅名を抽出
  // 「JR」「私鉄」などのプレフィックスも処理
  let cleanText = text.replace(/JR|ＪＲ|私鉄|地下鉄/g, '');

  // 「駅前」「駅周辺」「駅近」を先に除去してから駅名を抽出
  cleanText = cleanText.replace(/駅前|駅周辺|駅近|駅徒歩/g, '駅');

  const stationMatch = cleanText.match(/([^\s\d]+駅)/);
  if (stationMatch) {
    // 「駅駅」のような重複を防止
    return stationMatch[1].replace(/駅+$/, '駅');
  }
  return null;
}

function parseLocationBatch(locationDataArray) {
  return locationDataArray.map(location => parseLocation(location));
}

function getPrefectureDistribution(parsedLocations) {
  const distribution = {};
  PREFECTURES.forEach(pref => { distribution[pref] = 0; });
  distribution['不明'] = 0;
  parsedLocations.forEach(location => {
    if (location.prefecture) { distribution[location.prefecture]++; }
    else { distribution['不明']++; }
  });
  const nonZero = {};
  Object.entries(distribution).forEach(([key, value]) => { if (value > 0) nonZero[key] = value; });
  return { all: distribution, nonZero: nonZero };
}

function getRegionBlockDistribution(parsedLocations) {
  const distribution = { '北海道・東北': 0, '関東': 0, '中部': 0, '近畿': 0, '中国': 0, '四国': 0, '九州・沖縄': 0, '不明': 0 };
  parsedLocations.forEach(location => {
    if (location.regionBlock) { distribution[location.regionBlock]++; }
    else { distribution['不明']++; }
  });
  return distribution;
}

function getCityTypeDistribution(parsedLocations) {
  const distribution = { '東京23区': 0, '大阪市': 0, '政令指定都市': 0, 'その他市': 0, 'その他区': 0, '町': 0, '村': 0, 'その他': 0, '不明': 0 };
  parsedLocations.forEach(location => {
    const cityType = location.cityType || '不明';
    if (distribution.hasOwnProperty(cityType)) { distribution[cityType]++; }
    else { distribution['その他']++; }
  });
  return distribution;
}

function getTopCitiesDistribution(parsedLocations, topN) {
  topN = topN || 10;
  const cityCounts = {};
  parsedLocations.forEach(location => {
    const cityWard = location.cityWard;
    if (cityWard) {
      cityCounts[cityWard] = (cityCounts[cityWard] || 0) + 1;
    }
  });
  const sorted = Object.entries(cityCounts).sort((a, b) => b[1] - a[1]).slice(0, topN);
  const result = {};
  sorted.forEach(function(item) { result[item[0]] = item[1]; });
  return result;
}

/**
 * 検索対象シートからコンテキスト都道府県を取得
 * 検索対象の市区町村名から都道府県を推測する
 * @returns {string|null} 都道府県名（推測できない場合はnull）
 */
function getContextPrefectureFromTarget() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('検索対象');
    if (!sheet) return null;

    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return null;

    // 最初の検索対象から都道府県を推測
    const firstTarget = sheet.getRange(2, 1).getValue();
    if (!firstTarget) return null;

    const text = String(firstTarget).trim();

    // 直接都道府県名が入っている場合
    const directPref = extractPrefecture(text);
    if (directPref) return directPref;

    // 政令指定都市から推測
    for (const [cityName, pref] of Object.entries(DESIGNATED_CITY_PREFECTURE)) {
      if (text.includes(cityName)) return pref;
    }

    // 東京23区から推測
    for (const ward of Object.keys(TOKYO_WARDS_MAP)) {
      if (text.includes(ward)) return '東京都';
    }

    // 市町村マスタから推測
    const cityMaster = loadCityMasterFromSheet();
    if (cityMaster) {
      for (const [city, pref] of Object.entries(cityMaster)) {
        if (text.includes(city)) return pref;
      }
    }

    return null;
  } catch (e) {
    console.warn('コンテキスト都道府県の取得に失敗:', e);
    return null;
  }
}

// ===== スプレッドシート連携機能 =====

// マスターデータのキャッシュ（セッション内）
let _cityMasterCache = null;
let _stationMasterCache = null;

// ScriptCacheを使用した永続キャッシュ（6時間）
const MASTER_CACHE_TTL = 21600; // 6時間

/**
 * ScriptCacheからマスターデータを取得（高速）
 */
function getMasterFromScriptCache(key) {
  try {
    const cache = CacheService.getScriptCache();
    const cached = cache.get(key);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (e) {
    console.warn("ScriptCache読み込みエラー:", e);
  }
  return null;
}

/**
 * ScriptCacheにマスターデータを保存
 */
function setMasterToScriptCache(key, data) {
  try {
    const cache = CacheService.getScriptCache();
    const jsonStr = JSON.stringify(data);
    // 100KB制限を超える場合は分割
    if (jsonStr.length > 90000) {
      console.log(key + "は大きすぎるためScriptCacheに保存できません");
      return false;
    }
    cache.put(key, jsonStr, MASTER_CACHE_TTL);
    console.log(key + "をScriptCacheに保存しました");
    return true;
  } catch (e) {
    console.warn("ScriptCache保存エラー:", e);
    return false;
  }
}

/**
 * 市町村マスタシートからデータを読み込む（ScriptCache優先）
 * シート構造: A:市町村名, B:都道府県, C:別名/表記ゆれ（カンマ区切り）
 */
function loadCityMasterFromSheet() {
  // 1. セッションキャッシュチェック
  if (_cityMasterCache) return _cityMasterCache;

  // 2. ScriptCacheチェック
  const cached = getMasterFromScriptCache("cityMaster");
  if (cached) {
    console.log("市町村マスタをScriptCacheから読み込み");
    _cityMasterCache = cached;
    return cached;
  }

  // 3. スプレッドシートから読み込み
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("市町村マスタ");

  if (!sheet) {
    console.log("市町村マスタシートが見つかりません。デフォルトデータを使用します。");
    return null;
  }

  const data = sheet.getDataRange().getValues();
  const cityMap = {};

  for (let i = 1; i < data.length; i++) {
    const cityName = data[i][0];
    const prefecture = data[i][1];
    const aliases = data[i][2] ? String(data[i][2]).split(",").map(s => s.trim()) : [];

    if (cityName && prefecture) {
      cityMap[cityName] = prefecture;
      aliases.forEach(alias => {
        if (alias) cityMap[alias] = prefecture;
      });
    }
  }

  // 4. キャッシュに保存
  _cityMasterCache = cityMap;
  setMasterToScriptCache("cityMaster", cityMap);
  console.log("市町村マスタを読み込みました: " + Object.keys(cityMap).length + "件");
  return cityMap;
}

/**
 * 駅名マスタシートからデータを読み込む（ScriptCache優先）
 * シート構造: A:駅名, B:市区町村名, C:都道府県
 */
function loadStationMasterFromSheet() {
  // 1. セッションキャッシュチェック
  if (_stationMasterCache) return _stationMasterCache;

  // 2. ScriptCacheチェック
  const cached = getMasterFromScriptCache("stationMaster");
  if (cached) {
    console.log("駅名マスタをScriptCacheから読み込み");
    _stationMasterCache = cached;
    return cached;
  }

  // 3. スプレッドシートから読み込み
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("駅名マスタ");

  if (!sheet) {
    console.log("駅名マスタシートが見つかりません。デフォルトデータを使用します。");
    return null;
  }

  const data = sheet.getDataRange().getValues();
  const stationMap = {};

  for (let i = 1; i < data.length; i++) {
    const stationName = data[i][0];
    const cityName = data[i][1];
    const prefecture = data[i][2];

    if (stationName && cityName && prefecture) {
      stationMap[stationName] = { city: cityName, prefecture: prefecture };
    }
  }

  // 4. キャッシュに保存
  _stationMasterCache = stationMap;
  setMasterToScriptCache("stationMaster", stationMap);
  console.log("駅名マスタを読み込みました: " + Object.keys(stationMap).length + "件");
  return stationMap;
}

/**
 * マスタデータを使用して住所を解析（スプレッドシート優先）
 * @param {string} locationText - 解析対象の住所テキスト
 * @param {string|null} contextPrefecture - コンテキスト都道府県（検索対象から取得、都道府県不明時のデフォルト）
 */
function parseLocationWithMaster(locationText, contextPrefecture) {
  if (!locationText || locationText === '') {
    return createEmptyLocationResult();
  }
  const text = normalizeLocationText(locationText);

  // スプレッドシートの駅名マスタから検索
  const stationMaster = loadStationMasterFromSheet();
  if (stationMaster) {
    const stationResult = tryStationMatchWithMaster(text, stationMaster);
    if (stationResult) return stationResult;
  }

  // スプレッドシートの市町村マスタから検索（コンテキスト都道府県を優先）
  const cityMaster = loadCityMasterFromSheet();
  if (cityMaster) {
    const cityResult = tryCityMatchWithMaster(text, cityMaster, contextPrefecture);
    if (cityResult) return cityResult;
  }

  // デフォルトの解析を実行（コンテキスト都道府県を渡す）
  return parseLocationWithContext(locationText, contextPrefecture);
}

/**
 * コンテキスト都道府県を考慮した住所解析
 * @param {string} locationText - 解析対象の住所テキスト
 * @param {string|null} contextPrefecture - コンテキスト都道府県
 */
function parseLocationWithContext(locationText, contextPrefecture) {
  if (!locationText || locationText === '') {
    return createEmptyLocationResult();
  }
  const text = normalizeLocationText(locationText);

  // 駅名から推測
  const stationResult = tryStationMatch(text);
  if (stationResult) return stationResult;

  // 政令指定都市から推測
  const designatedResult = tryDesignatedCityMatch(text);
  if (designatedResult) return designatedResult;

  // 東京23区から推測
  const tokyoResult = tryTokyoWardMatch(text);
  if (tokyoResult) return tokyoResult;

  // 都道府県を抽出（テキストから見つからない場合はコンテキストを使用）
  let prefecture = extractPrefecture(text);
  const usedContext = !prefecture && contextPrefecture;
  if (!prefecture && contextPrefecture) {
    prefecture = contextPrefecture;
  }

  const cityWard = extractCityWard(text, prefecture);
  const regionBlock = prefecture ? PREFECTURE_REGIONS[prefecture] : null;
  const cityType = determineCityType(prefecture, cityWard);
  const stationName = extractStationName(text);

  return {
    originalText: locationText,
    regionBlock: regionBlock,
    prefecture: prefecture,
    cityType: cityType,
    cityWard: cityWard,
    stationName: stationName,
    isComplete: prefecture !== null && cityWard !== null,
    usedContextPrefecture: usedContext  // コンテキスト都道府県を使用したかどうか
  };
}

function tryStationMatchWithMaster(text, stationMaster) {
  // 「駅前」「駅周辺」を含む場合は先に正規化
  let cleanText = text.replace(/JR|ＪＲ|私鉄|地下鉄/g, '');
  cleanText = cleanText.replace(/駅前|駅周辺|駅近/g, '駅');

  const stationMatch = cleanText.match(/([^\s\d]+駅)/);
  if (!stationMatch) return null;

  // 「駅駅」のような重複を防止
  const stationName = stationMatch[1].replace(/駅+$/, '駅');
  const masterMapping = stationMaster[stationName];
  if (masterMapping) {
    return {
      originalText: text,
      regionBlock: PREFECTURE_REGIONS[masterMapping.prefecture],
      prefecture: masterMapping.prefecture,
      cityType: determineCityType(masterMapping.prefecture, masterMapping.city),
      cityWard: masterMapping.city,
      stationName: stationName,
      isComplete: true
    };
  }

  // デフォルトのマッピングをフォールバック
  const defaultMapping = STATION_TO_CITY[stationName];
  if (defaultMapping) {
    return {
      originalText: text,
      regionBlock: PREFECTURE_REGIONS[defaultMapping.prefecture],
      prefecture: defaultMapping.prefecture,
      cityType: determineCityType(defaultMapping.prefecture, defaultMapping.city),
      cityWard: defaultMapping.city,
      stationName: stationName,
      isComplete: true
    };
  }

  return null;
}

function tryCityMatchWithMaster(text, cityMaster, contextPrefecture) {
  const parts = text.split(/[\s　]+/).filter(p => p);

  // コンテキスト都道府県がある場合、その都道府県のものを優先
  for (const part of parts) {
    if (cityMaster[part]) {
      const masterPref = cityMaster[part];
      // コンテキスト都道府県があり、マスタの都道府県と異なる場合はスキップ
      // （同名市町村の誤解釈を防止）
      if (contextPrefecture && masterPref !== contextPrefecture) {
        continue;
      }
      return {
        originalText: text,
        regionBlock: PREFECTURE_REGIONS[masterPref],
        prefecture: masterPref,
        cityType: determineCityType(masterPref, part),
        cityWard: part,
        stationName: extractStationName(text),
        isComplete: true
      };
    }
  }

  const sortedCities = Object.keys(cityMaster).sort((a, b) => b.length - a.length);
  for (const city of sortedCities) {
    if (text.includes(city)) {
      const masterPref = cityMaster[city];
      // コンテキスト都道府県があり、マスタの都道府県と異なる場合はスキップ
      if (contextPrefecture && masterPref !== contextPrefecture) {
        continue;
      }
      return {
        originalText: text,
        regionBlock: PREFECTURE_REGIONS[masterPref],
        prefecture: masterPref,
        cityType: determineCityType(masterPref, city),
        cityWard: city,
        stationName: extractStationName(text),
        isComplete: true
      };
    }
  }

  return null;
}

function clearLocationMasterCache() {
  // セッションキャッシュをクリア
  _cityMasterCache = null;
  _stationMasterCache = null;

  // ScriptCacheもクリア
  try {
    const cache = CacheService.getScriptCache();
    cache.removeAll(["cityMaster", "stationMaster"]);
    console.log("市町村・駅名マスタのキャッシュをクリアしました（Session + ScriptCache）");
  } catch (e) {
    console.log("市町村・駅名マスタのキャッシュをクリアしました（Sessionのみ）");
  }
}

/**
 * 市町村マスタシートを作成（テンプレート）
 */
function createCityMasterSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('市町村マスタ');

  if (!sheet) {
    sheet = ss.insertSheet('市町村マスタ');
  }

  sheet.getRange('A1:C1').setValues([['市町村名', '都道府県', '別名/表記ゆれ']]);
  sheet.getRange('A1:C1').setFontWeight('bold');
  sheet.getRange('A1:C1').setBackground('#4a90d9');
  sheet.getRange('A1:C1').setFontColor('white');

  const sampleData = [
    ['川口市', '埼玉県', ''],
    ['越谷市', '埼玉県', ''],
    ['草加市', '埼玉県', ''],
    ['春日部市', '埼玉県', ''],
    ['船橋市', '千葉県', ''],
    ['柏市', '千葉県', ''],
    ['武蔵野市', '東京都', '']
  ];
  sheet.getRange(2, 1, sampleData.length, 3).setValues(sampleData);
  sheet.setColumnWidth(1, 150);
  sheet.setColumnWidth(2, 100);
  sheet.setColumnWidth(3, 200);

  console.log('市町村マスタシートを作成しました');
}

/**
 * 駅名マスタシートを作成（テンプレート）
 */
function createStationMasterSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('駅名マスタ');

  if (!sheet) {
    sheet = ss.insertSheet('駅名マスタ');
  }

  sheet.getRange('A1:C1').setValues([['駅名', '市区町村名', '都道府県']]);
  sheet.getRange('A1:C1').setFontWeight('bold');
  sheet.getRange('A1:C1').setBackground('#4a90d9');
  sheet.getRange('A1:C1').setFontColor('white');

  const sampleData = [
    ['獨協大学前駅', '草加市', '埼玉県'],
    ['谷塚駅', '草加市', '埼玉県'],
    ['新田駅', '草加市', '埼玉県'],
    ['せんげん台駅', '越谷市', '埼玉県'],
    ['北越谷駅', '越谷市', '埼玉県']
  ];
  sheet.getRange(2, 1, sampleData.length, 3).setValues(sampleData);
  sheet.setColumnWidth(1, 180);
  sheet.setColumnWidth(2, 150);
  sheet.setColumnWidth(3, 100);

  console.log('駅名マスタシートを作成しました');
}
