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

// 政令指定都市の都道府県マッピング
const DESIGNATED_CITY_PREFECTURE = {
  '札幌市': '北海道', '仙台市': '宮城県', 'さいたま市': '埼玉県', '千葉市': '千葉県',
  '横浜市': '神奈川県', '川崎市': '神奈川県', '相模原市': '神奈川県', '新潟市': '新潟県',
  '静岡市': '静岡県', '浜松市': '静岡県', '名古屋市': '愛知県', '京都市': '京都府',
  '大阪市': '大阪府', '堺市': '大阪府', '神戸市': '兵庫県', '岡山市': '岡山県',
  '広島市': '広島県', '北九州市': '福岡県', '福岡市': '福岡県', '熊本市': '熊本県'
};

function parseLocation(locationText) {
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

  // 都道府県から推測
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
  return null;
}

function tryTokyoWardMatch(text) {
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
  const abbreviations = { '東京': '東京都', '大阪': '大阪府', '京都': '京都府', '北海道': '北海道' };
  for (const [abbr, full] of Object.entries(abbreviations)) {
    if (text.includes(abbr)) return full;
  }
  return null;
}

function extractCityWard(text, prefecture) {
  if (!prefecture) return null;
  const parts = text.split(/\s+/).filter(p => p);

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

  // 市町村の抽出
  for (const part of parts) {
    if (part.endsWith('市') && part.length > 1) return part;
  }
  for (const part of parts) {
    if (part.endsWith('区') && part.length > 1) return part;
  }
  for (const part of parts) {
    if ((part.endsWith('町') || part.endsWith('村')) && part.length > 1) return part;
  }

  // 正規表現で市町村を抽出
  const cityPatterns = [/([^\s市区町村]+市)/, /([^\s市区町村]+区)/, /([^\s市区町村]+町)/, /([^\s市区町村]+村)/];
  for (const pattern of cityPatterns) {
    const match = text.match(pattern);
    if (match) return match[1];
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
    const key = location.cityWard || '不明';
    cityCounts[key] = (cityCounts[key] || 0) + 1;
  });
  const sorted = Object.entries(cityCounts).sort((a, b) => b[1] - a[1]).slice(0, topN);
  const result = {};
  sorted.forEach(function(item) { result[item[0]] = item[1]; });
  return result;
}

function testLocationParser() {
  var testCases = [
    '東京都渋谷区神宮前', '埼玉県 さいたま市 大宮区', '大宮駅', '川口市',
    '北海道札幌市中央区', '福岡県福岡市博多区', '博多駅', '大阪市北区',
    '名古屋駅周辺', '広島県広島市中区', '渋谷区', '新宿駅から徒歩5分'
  ];
  console.log('=== 所在地解析テスト ===');
  testCases.forEach(function(testCase) {
    var result = parseLocation(testCase);
    console.log('入力: ' + testCase + ' -> 県: ' + result.prefecture + ', 市区町村: ' + result.cityWard);
  });
}

function debugUnknownLocations() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const dataSheet = ss.getSheetByName('データ');
  if (!dataSheet) { console.log('データシートが見つかりません'); return; }
  const rawData = getRawDataFromSheet(dataSheet);
  const parsedData = parseAllData(rawData);
  const unknown = parsedData.filter(r => !r.locationParsed.cityWard || r.locationParsed.cityWard === '不明');
  console.log('=== 不明な住所一覧 (' + unknown.length + '件) ===');
  unknown.slice(0, 30).forEach((r, i) => { console.log((i + 1) + ': "' + r.location + '"'); });
  return { total: parsedData.length, unknown: unknown.length };
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
 */
function parseLocationWithMaster(locationText) {
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

  // スプレッドシートの市町村マスタから検索
  const cityMaster = loadCityMasterFromSheet();
  if (cityMaster) {
    const cityResult = tryCityMatchWithMaster(text, cityMaster);
    if (cityResult) return cityResult;
  }

  // デフォルトの解析を実行
  return parseLocation(locationText);
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

function tryCityMatchWithMaster(text, cityMaster) {
  const parts = text.split(/[\s　]+/).filter(p => p);

  for (const part of parts) {
    if (cityMaster[part]) {
      const prefecture = cityMaster[part];
      return {
        originalText: text,
        regionBlock: PREFECTURE_REGIONS[prefecture],
        prefecture: prefecture,
        cityType: determineCityType(prefecture, part),
        cityWard: part,
        stationName: extractStationName(text),
        isComplete: true
      };
    }
  }

  const sortedCities = Object.keys(cityMaster).sort((a, b) => b.length - a.length);
  for (const city of sortedCities) {
    if (text.includes(city)) {
      const prefecture = cityMaster[city];
      return {
        originalText: text,
        regionBlock: PREFECTURE_REGIONS[prefecture],
        prefecture: prefecture,
        cityType: determineCityType(prefecture, city),
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
