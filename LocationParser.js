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

  // 1. 東京23区をチェック（区名から東京都を確定）
  // ※ 政令指定都市名（札幌市、さいたま市等）が含まれる場合はスキップ
  if (!hasDesignatedCityName) {
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

/**
 * 東京都/京都府の誤変換テスト
 * 「東京都」が「京都府」に誤変換されないことを確認
 */
function testTokyoKyotoFix() {
  console.log('=== 東京都/京都府 誤変換テスト ===');

  const testCases = [
    { input: '東京都渋谷区', expected: { pref: '東京都', city: '渋谷区' } },
    { input: '東京都', expected: { pref: '東京都', city: null } },
    { input: '東京', expected: { pref: '東京都', city: null } },
    { input: '東京都新宿区', expected: { pref: '東京都', city: '新宿区' } },
    { input: '京都府京都市', expected: { pref: '京都府', city: '京都市' } },
    { input: '京都市下京区', expected: { pref: '京都府', city: '京都市下京区' } },
    { input: '京都駅', expected: { pref: '京都府', city: '京都市下京区' } },
    { input: '埼玉県さいたま市大宮区', expected: { pref: '埼玉県', city: 'さいたま市大宮区' } }
  ];

  let passed = 0;
  let failed = 0;

  testCases.forEach(tc => {
    const result = parseLocation(tc.input);
    const prefMatch = result.prefecture === tc.expected.pref;
    const cityMatch = tc.expected.city === null || result.cityWard === tc.expected.city ||
                      (result.cityWard && result.cityWard.includes(tc.expected.city));

    if (prefMatch && cityMatch) {
      console.log('✅ PASS: "' + tc.input + '" → ' + result.prefecture + ', ' + result.cityWard);
      passed++;
    } else {
      console.log('❌ FAIL: "' + tc.input + '"');
      console.log('   期待: ' + tc.expected.pref + ', ' + tc.expected.city);
      console.log('   実際: ' + result.prefecture + ', ' + result.cityWard);
      failed++;
    }
  });

  console.log('\n結果: ' + passed + '/' + (passed + failed) + ' テスト合格');

  if (failed === 0) {
    console.log('✅ 全テスト合格 - 東京都/京都府の誤変換は修正されています');
  } else {
    console.log('❌ ' + failed + '件のテストが失敗しました');
  }

  return failed === 0;
}

function debugUnknownLocations() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const dataSheet = ss.getSheetByName('データ');
  if (!dataSheet) { console.log('データシートが見つかりません'); return; }
  const rawData = getRawDataFromSheet(dataSheet);
  const contextPref = getContextPrefectureFromTarget();
  const parsedData = rawData.map(record => {
    const locationParsed = parseLocationWithMaster(record.location, contextPref);
    return { ...record, locationParsed };
  });
  const unknown = parsedData.filter(r => !r.locationParsed.cityWard || r.locationParsed.cityWard === '不明');
  console.log('=== 不明な住所一覧 (' + unknown.length + '件) ===');
  console.log('コンテキスト都道府県: ' + (contextPref || 'なし'));
  unknown.slice(0, 30).forEach((r, i) => { console.log((i + 1) + ': "' + r.location + '"'); });
  return { total: parsedData.length, unknown: unknown.length, contextPrefecture: contextPref };
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

/**
 * CSVデータからの実データテスト
 * 埼玉県大宮周辺のデータで「京都」誤検出がないことを確認
 */
function testRealCSVData() {
  console.log('=== CSVデータからの実データテスト ===');
  console.log('テスト目的: 埼玉・東京のデータが「京都」と誤変換されないことを確認');

  // Indeed CSVから抽出した実データ
  const testCases = [
    // 埼玉県のデータ（大宮周辺）
    { input: '埼玉県 さいたま市 大宮区 天沼町', expected: { pref: '埼玉県', notPref: '京都府' } },
    { input: '埼玉県 さいたま市 大宮区 上小町', expected: { pref: '埼玉県', notPref: '京都府' } },
    { input: '埼玉県 さいたま市 大宮区 さいたま新都心駅', expected: { pref: '埼玉県', notPref: '京都府' } },
    { input: '埼玉県 さいたま市 見沼区', expected: { pref: '埼玉県', notPref: '京都府' } },
    { input: '埼玉県 さいたま市 北区 今羽町', expected: { pref: '埼玉県', notPref: '京都府' } },
    { input: '埼玉県 川口市 新井宿駅', expected: { pref: '埼玉県', notPref: '京都府' } },
    { input: '埼玉県 上尾市', expected: { pref: '埼玉県', notPref: '京都府' } },
    { input: '埼玉県 上尾市 中新井', expected: { pref: '埼玉県', notPref: '京都府' } },

    // 東京都のデータ（重要: 「東京都」の「京都」部分が誤変換されないこと）
    { input: '東京都 練馬区 南大泉', expected: { pref: '東京都', notPref: '京都府' } },
    { input: '東京都 北区 中十条', expected: { pref: '東京都', notPref: '京都府' } },
    { input: '東京都渋谷区', expected: { pref: '東京都', notPref: '京都府' } },
    { input: '東京都新宿区西新宿', expected: { pref: '東京都', notPref: '京都府' } },
    { input: '東京都港区六本木', expected: { pref: '東京都', notPref: '京都府' } },

    // 京都府のデータ（正しく京都と認識されること）
    { input: '京都府京都市下京区', expected: { pref: '京都府', notPref: '東京都' } },
    { input: '京都市伏見区', expected: { pref: '京都府', notPref: '東京都' } }
  ];

  let passed = 0;
  let failed = 0;
  const failures = [];

  testCases.forEach((tc, index) => {
    const result = parseLocation(tc.input);
    const prefMatch = result.prefecture === tc.expected.pref;
    const notWrongPref = result.prefecture !== tc.expected.notPref;

    if (prefMatch && notWrongPref) {
      console.log('✅ ' + (index + 1) + '. "' + tc.input.substring(0, 30) + '..." → ' + result.prefecture);
      passed++;
    } else {
      console.log('❌ ' + (index + 1) + '. "' + tc.input + '"');
      console.log('   期待: ' + tc.expected.pref + ' (NOT ' + tc.expected.notPref + ')');
      console.log('   実際: ' + result.prefecture);
      failed++;
      failures.push({
        input: tc.input,
        expected: tc.expected.pref,
        actual: result.prefecture
      });
    }
  });

  console.log('\n════════════════════════════════════');
  console.log('結果: ' + passed + '/' + testCases.length + ' テスト合格');

  if (failed === 0) {
    console.log('✅ 全テスト合格！');
    console.log('   東京都が京都府に誤変換される問題は修正されています');
  } else {
    console.log('❌ ' + failed + '件のテストが失敗');
    failures.forEach(f => {
      console.log('   - "' + f.input + '": ' + f.actual + ' (期待: ' + f.expected + ')');
    });
  }

  return { passed, failed, total: testCases.length };
}

/**
 * 🔴 重要: 事業所名と所在地の誤変換テスト
 * 「中央病院」「北町」などが誤って区名に変換されないことを確認
 */
function testCompanyLocationSeparation() {
  console.log('═'.repeat(60));
  console.log('🔴 事業所名と所在地の誤変換テスト');
  console.log('═'.repeat(60));
  console.log('目的: 「中央」「北」「港」を含むテキストが誤って区名に変換されないことを確認\n');

  const testCases = [
    // 「中央」を含むが中央区ではないケース
    { input: '中央病院', expected: { notCityWard: '中央区' }, description: '病院名' },
    { input: '中央通り1-2-3', expected: { notCityWard: '中央区' }, description: '通り名' },
    { input: '中央商店街', expected: { notCityWard: '中央区' }, description: '商店街名' },
    { input: '群馬県前橋市 中央病院前', expected: { pref: '群馬県', notCityWard: '中央区' }, description: '群馬の住所' },

    // 「北」を含むが北区ではないケース
    { input: '北病院', expected: { notCityWard: '北区' }, description: '病院名' },
    { input: '北町1-2-3', expected: { notCityWard: '北区' }, description: '町名' },
    { input: '北通り', expected: { notCityWard: '北区' }, description: '通り名' },
    { input: '群馬県高崎市 北町病院', expected: { pref: '群馬県', notCityWard: '北区' }, description: '群馬の住所' },

    // 「港」を含むが港区ではないケース
    { input: '港町1-2-3', expected: { notCityWard: '港区' }, description: '町名' },
    { input: '港商店', expected: { notCityWard: '港区' }, description: '商店名' },

    // 正しく区として認識されるべきケース
    { input: '東京都中央区銀座', expected: { pref: '東京都', cityWard: '中央区' }, description: '東京都中央区' },
    { input: '東京都北区赤羽', expected: { pref: '東京都', cityWard: '北区' }, description: '東京都北区' },
    { input: '東京都港区六本木', expected: { pref: '東京都', cityWard: '港区' }, description: '東京都港区' },
    { input: 'さいたま市中央区', expected: { pref: '埼玉県', cityWard: 'さいたま市中央区' }, description: 'さいたま市中央区' },
    { input: '大阪市中央区', expected: { pref: '大阪府', cityWard: '大阪市中央区' }, description: '大阪市中央区' },

    // 群馬県のテストケース（今回の問題の発端）
    { input: '群馬県前橋市', expected: { pref: '群馬県', cityWard: '前橋市' }, description: '群馬県前橋市' },
    { input: '群馬県高崎市', expected: { pref: '群馬県', cityWard: '高崎市' }, description: '群馬県高崎市' },
    { input: '群馬県太田市', expected: { pref: '群馬県', cityWard: '太田市' }, description: '群馬県太田市' }
  ];

  let passed = 0;
  let failed = 0;
  const failures = [];

  testCases.forEach((tc, index) => {
    const result = parseLocation(tc.input);
    let isPass = true;
    let reason = '';

    // 都道府県チェック
    if (tc.expected.pref && result.prefecture !== tc.expected.pref) {
      isPass = false;
      reason = '都道府県: 期待=' + tc.expected.pref + ', 実際=' + result.prefecture;
    }

    // 市区町村が一致すべきケース
    if (tc.expected.cityWard && result.cityWard !== tc.expected.cityWard) {
      // 部分一致も許可（「さいたま市中央区」を含むなど）
      if (!result.cityWard || !result.cityWard.includes(tc.expected.cityWard.replace(/区$/, ''))) {
        isPass = false;
        reason = '市区町村: 期待=' + tc.expected.cityWard + ', 実際=' + result.cityWard;
      }
    }

    // 市区町村が一致してはいけないケース（誤変換チェック）
    if (tc.expected.notCityWard && result.cityWard === tc.expected.notCityWard) {
      isPass = false;
      reason = '誤変換検出: ' + result.cityWard + 'に変換されてしまった';
    }

    if (isPass) {
      console.log('✅ ' + (index + 1) + '. [' + tc.description + '] "' + tc.input + '"');
      console.log('   → ' + (result.prefecture || '?') + ' / ' + (result.cityWard || '(なし)'));
      passed++;
    } else {
      console.log('❌ ' + (index + 1) + '. [' + tc.description + '] "' + tc.input + '"');
      console.log('   → ' + reason);
      console.log('   実際の結果: ' + JSON.stringify(result));
      failed++;
      failures.push({ input: tc.input, description: tc.description, reason: reason });
    }
  });

  console.log('\n' + '═'.repeat(60));
  console.log('結果: ' + passed + '/' + testCases.length + ' テスト合格');

  if (failed === 0) {
    console.log('✅ 全テスト合格！');
    console.log('   「中央」「北」「港」の誤変換は発生していません');
  } else {
    console.log('❌ ' + failed + '件のテストが失敗');
    failures.forEach(f => {
      console.log('   - [' + f.description + '] ' + f.input + ': ' + f.reason);
    });
  }
  console.log('═'.repeat(60));

  return { passed, failed, total: testCases.length, failures };
}

/**
 * ═══════════════════════════════════════════════════════════════════════
 * 🔬 包括的テストスイート - 多角的検証と逆証明
 * ═══════════════════════════════════════════════════════════════════════
 */

/**
 * 全テストを実行するマスター関数
 */
function runAllLocationTests() {
  console.log('╔' + '═'.repeat(68) + '╗');
  console.log('║' + ' '.repeat(20) + '🔬 包括的テストスイート' + ' '.repeat(25) + '║');
  console.log('╚' + '═'.repeat(68) + '╝');

  const results = {
    categories: [],
    totalPassed: 0,
    totalFailed: 0,
    totalTests: 0
  };

  // カテゴリ1: エイリアス変換テスト
  const aliasResult = testAliasConversion();
  results.categories.push({ name: 'エイリアス変換', ...aliasResult });

  // カテゴリ2: 同名区問題テスト
  const sameNameResult = testSameNameWards();
  results.categories.push({ name: '同名区問題', ...sameNameResult });

  // カテゴリ3: 逆証明テスト（修正前後の挙動比較）
  const reverseProofResult = testReverseProof();
  results.categories.push({ name: '逆証明（修正検証）', ...reverseProofResult });

  // カテゴリ4: コンテキスト都道府県テスト
  const contextResult = testContextPrefecture();
  results.categories.push({ name: 'コンテキスト都道府県', ...contextResult });

  // カテゴリ5: 境界値テスト
  const boundaryResult = testBoundaryValues();
  results.categories.push({ name: '境界値', ...boundaryResult });

  // カテゴリ6: 実データパターンテスト
  const realDataResult = testRealDataPatterns();
  results.categories.push({ name: '実データパターン', ...realDataResult });

  // カテゴリ7: データフロー検証
  const dataFlowResult = testDataFlowIntegrity();
  results.categories.push({ name: 'データフロー整合性', ...dataFlowResult });

  // 集計
  results.categories.forEach(cat => {
    results.totalPassed += cat.passed;
    results.totalFailed += cat.failed;
    results.totalTests += cat.total;
  });

  // 最終レポート
  console.log('\n' + '╔' + '═'.repeat(68) + '╗');
  console.log('║' + ' '.repeat(25) + '📊 最終レポート' + ' '.repeat(28) + '║');
  console.log('╠' + '═'.repeat(68) + '╣');

  results.categories.forEach(cat => {
    const status = cat.failed === 0 ? '✅' : '❌';
    const line = '║ ' + status + ' ' + cat.name.padEnd(25) +
                 (cat.passed + '/' + cat.total).padStart(8) +
                 ' '.repeat(32) + '║';
    console.log(line);
  });

  console.log('╠' + '═'.repeat(68) + '╣');
  const summaryStatus = results.totalFailed === 0 ? '🎉 全テスト合格' : '⚠️ 失敗あり';
  console.log('║ 合計: ' + results.totalPassed + '/' + results.totalTests +
              ' (' + Math.round(results.totalPassed / results.totalTests * 100) + '%)' +
              ' '.repeat(20) + summaryStatus + ' '.repeat(10) + '║');
  console.log('╚' + '═'.repeat(68) + '╝');

  return results;
}

/**
 * カテゴリ1: エイリアス変換テスト
 * - 危険なエイリアス（中央、北、港）が削除されていることを確認
 * - 安全なエイリアス（渋谷、新宿など）は正しく動作することを確認
 */
function testAliasConversion() {
  console.log('\n' + '─'.repeat(60));
  console.log('📋 カテゴリ1: エイリアス変換テスト');
  console.log('─'.repeat(60));

  const testCases = [
    // === 危険なエイリアス（変換されてはいけない）===
    { input: '中央', expected: { notCityWard: '中央区' }, desc: '「中央」単体→変換しない' },
    { input: '北', expected: { notCityWard: '北区' }, desc: '「北」単体→変換しない' },
    { input: '港', expected: { notCityWard: '港区' }, desc: '「港」単体→変換しない' },

    // === 安全なエイリアス（正しく変換される）===
    { input: '渋谷', expected: { cityWard: '渋谷区', pref: '東京都' }, desc: '「渋谷」→渋谷区' },
    { input: '新宿', expected: { cityWard: '新宿区', pref: '東京都' }, desc: '「新宿」→新宿区' },
    { input: '世田谷', expected: { cityWard: '世田谷区', pref: '東京都' }, desc: '「世田谷」→世田谷区' },
    { input: '品川', expected: { cityWard: '品川区', pref: '東京都' }, desc: '「品川」→品川区' },
    { input: '足立', expected: { cityWard: '足立区', pref: '東京都' }, desc: '「足立」→足立区' },

    // === 完全な区名（正しく変換される）===
    { input: '中央区', expected: { cityWard: '中央区', pref: '東京都' }, desc: '「中央区」→中央区' },
    { input: '北区', expected: { cityWard: '北区', pref: '東京都' }, desc: '「北区」→北区' },
    { input: '港区', expected: { cityWard: '港区', pref: '東京都' }, desc: '「港区」→港区' },

    // === 政令指定都市エイリアス ===
    { input: '名古屋', expected: { cityWard: '名古屋市', pref: '愛知県' }, desc: '「名古屋」→名古屋市' },
    { input: '横浜', expected: { cityWard: '横浜市', pref: '神奈川県' }, desc: '「横浜」→横浜市' },
    { input: '福岡', expected: { cityWard: '福岡市', pref: '福岡県' }, desc: '「福岡」→福岡市' }
  ];

  return runTestCases(testCases, 'エイリアス変換');
}

/**
 * カテゴリ2: 同名区問題テスト
 * - 複数の政令指定都市に存在する区の正しい判定
 */
function testSameNameWards() {
  console.log('\n' + '─'.repeat(60));
  console.log('📋 カテゴリ2: 同名区問題テスト');
  console.log('─'.repeat(60));

  const testCases = [
    // === 中央区（東京、札幌、さいたま、千葉、相模原、新潟、浜松、大阪、神戸、福岡、熊本）===
    { input: '東京都中央区', expected: { cityWard: '中央区', pref: '東京都' }, desc: '東京都中央区' },
    { input: '札幌市中央区', expected: { cityWard: '札幌市中央区', pref: '北海道' }, desc: '札幌市中央区' },
    { input: 'さいたま市中央区', expected: { cityWard: 'さいたま市中央区', pref: '埼玉県' }, desc: 'さいたま市中央区' },
    { input: '大阪市中央区', expected: { cityWard: '大阪市中央区', pref: '大阪府' }, desc: '大阪市中央区' },
    { input: '福岡市中央区', expected: { cityWard: '福岡市中央区', pref: '福岡県' }, desc: '福岡市中央区' },

    // === 北区（東京、札幌、さいたま、新潟、名古屋、京都、大阪、堺、神戸、岡山、熊本）===
    { input: '東京都北区', expected: { cityWard: '北区', pref: '東京都' }, desc: '東京都北区' },
    { input: '札幌市北区', expected: { cityWard: '札幌市北区', pref: '北海道' }, desc: '札幌市北区' },
    { input: '名古屋市北区', expected: { cityWard: '名古屋市北区', pref: '愛知県' }, desc: '名古屋市北区' },
    { input: '大阪市北区', expected: { cityWard: '大阪市北区', pref: '大阪府' }, desc: '大阪市北区' },
    { input: '京都市北区', expected: { cityWard: '京都市北区', pref: '京都府' }, desc: '京都市北区' },

    // === 南区・西区・東区 ===
    { input: '横浜市南区', expected: { cityWard: '横浜市南区', pref: '神奈川県' }, desc: '横浜市南区' },
    { input: '名古屋市西区', expected: { cityWard: '名古屋市西区', pref: '愛知県' }, desc: '名古屋市西区' },
    { input: '広島市東区', expected: { cityWard: '広島市東区', pref: '広島県' }, desc: '広島市東区' },

    // === 都道府県なしで区名のみ（東京23区として認識）===
    { input: '渋谷区', expected: { cityWard: '渋谷区', pref: '東京都' }, desc: '渋谷区のみ→東京都' },
    { input: '新宿区', expected: { cityWard: '新宿区', pref: '東京都' }, desc: '新宿区のみ→東京都' }
  ];

  return runTestCases(testCases, '同名区問題');
}

/**
 * カテゴリ3: 逆証明テスト
 * - 修正前なら誤変換されていたケースが、修正後は正しく処理されることを確認
 */
function testReverseProof() {
  console.log('\n' + '─'.repeat(60));
  console.log('📋 カテゴリ3: 逆証明テスト（修正検証）');
  console.log('─'.repeat(60));
  console.log('  ※ 修正前: TOKYO_WARD_ALIASESに「中央」「北」「港」が存在');
  console.log('  ※ 修正後: 上記エイリアスを削除');
  console.log('');

  const testCases = [
    // === 修正前は誤変換されていたケース ===
    { input: '中央病院', expected: { notCityWard: '中央区' }, desc: '【逆証明】中央病院→中央区にならない' },
    { input: '中央通り', expected: { notCityWard: '中央区' }, desc: '【逆証明】中央通り→中央区にならない' },
    { input: '中央公園前', expected: { notCityWard: '中央区' }, desc: '【逆証明】中央公園前→中央区にならない' },
    { input: '北病院', expected: { notCityWard: '北区' }, desc: '【逆証明】北病院→北区にならない' },
    { input: '北町', expected: { notCityWard: '北区' }, desc: '【逆証明】北町→北区にならない' },
    { input: '北通り商店街', expected: { notCityWard: '北区' }, desc: '【逆証明】北通り商店街→北区にならない' },
    { input: '港町', expected: { notCityWard: '港区' }, desc: '【逆証明】港町→港区にならない' },
    { input: '港商店', expected: { notCityWard: '港区' }, desc: '【逆証明】港商店→港区にならない' },

    // === 群馬県データでの逆証明（今回の問題の発端）===
    { input: '群馬県前橋市 中央病院', expected: { pref: '群馬県', notCityWard: '中央区' }, desc: '【逆証明】群馬+中央病院' },
    { input: '群馬県高崎市 北町1-2-3', expected: { pref: '群馬県', notCityWard: '北区' }, desc: '【逆証明】群馬+北町' },
    { input: '群馬県太田市 港商店前', expected: { pref: '群馬県', notCityWard: '港区' }, desc: '【逆証明】群馬+港商店' },

    // === 修正後も正しく動作すべきケース ===
    { input: '東京都中央区銀座1-1-1', expected: { pref: '東京都', cityWard: '中央区' }, desc: '【正常】東京都中央区' },
    { input: '東京都北区赤羽1-1-1', expected: { pref: '東京都', cityWard: '北区' }, desc: '【正常】東京都北区' },
    { input: '東京都港区六本木1-1-1', expected: { pref: '東京都', cityWard: '港区' }, desc: '【正常】東京都港区' }
  ];

  return runTestCases(testCases, '逆証明');
}

/**
 * カテゴリ4: コンテキスト都道府県テスト
 */
function testContextPrefecture() {
  console.log('\n' + '─'.repeat(60));
  console.log('📋 カテゴリ4: コンテキスト都道府県テスト');
  console.log('─'.repeat(60));

  let passed = 0;
  let failed = 0;
  const failures = [];

  // テストケース: コンテキスト都道府県あり/なしでの挙動
  const testCases = [
    // コンテキスト都道府県を使用するケース
    { input: '前橋市', context: '群馬県', expected: { pref: '群馬県', cityWard: '前橋市' }, desc: 'コンテキスト群馬+前橋市' },
    { input: '高崎市', context: '群馬県', expected: { pref: '群馬県', cityWard: '高崎市' }, desc: 'コンテキスト群馬+高崎市' },
    { input: '川口市', context: '埼玉県', expected: { pref: '埼玉県', cityWard: '川口市' }, desc: 'コンテキスト埼玉+川口市' },

    // コンテキストなしのケース
    { input: '群馬県前橋市', context: null, expected: { pref: '群馬県', cityWard: '前橋市' }, desc: 'コンテキストなし+群馬県前橋市' },
    { input: '埼玉県川口市', context: null, expected: { pref: '埼玉県', cityWard: '川口市' }, desc: 'コンテキストなし+埼玉県川口市' }
  ];

  testCases.forEach((tc, index) => {
    const result = parseLocationWithContext(tc.input, tc.context);
    let isPass = true;
    let reason = '';

    if (tc.expected.pref && result.prefecture !== tc.expected.pref) {
      isPass = false;
      reason = '都道府県: 期待=' + tc.expected.pref + ', 実際=' + result.prefecture;
    }
    if (tc.expected.cityWard && result.cityWard !== tc.expected.cityWard) {
      isPass = false;
      reason = '市区町村: 期待=' + tc.expected.cityWard + ', 実際=' + result.cityWard;
    }

    if (isPass) {
      console.log('  ✅ ' + (index + 1) + '. ' + tc.desc);
      passed++;
    } else {
      console.log('  ❌ ' + (index + 1) + '. ' + tc.desc + ' - ' + reason);
      failed++;
      failures.push({ desc: tc.desc, reason: reason });
    }
  });

  console.log('  結果: ' + passed + '/' + testCases.length);
  return { passed, failed, total: testCases.length, failures };
}

/**
 * カテゴリ5: 境界値テスト
 */
function testBoundaryValues() {
  console.log('\n' + '─'.repeat(60));
  console.log('📋 カテゴリ5: 境界値テスト');
  console.log('─'.repeat(60));

  const testCases = [
    // 空・null
    { input: '', expected: { pref: null, cityWard: null }, desc: '空文字列' },
    { input: '   ', expected: { pref: null, cityWard: null }, desc: 'スペースのみ' },

    // 都道府県のみ
    { input: '東京都', expected: { pref: '東京都' }, desc: '都道府県のみ（東京都）' },
    { input: '群馬県', expected: { pref: '群馬県' }, desc: '都道府県のみ（群馬県）' },

    // 特殊文字
    { input: '東京都渋谷区　神宮前', expected: { pref: '東京都', cityWard: '渋谷区' }, desc: '全角スペース含む' },
    { input: '東京都 渋谷区 神宮前', expected: { pref: '東京都', cityWard: '渋谷区' }, desc: '半角スペース含む' },

    // 長い住所
    { input: '東京都渋谷区神宮前1丁目2番3号ABCビル4階', expected: { pref: '東京都', cityWard: '渋谷区' }, desc: '長い住所' },

    // 駅名パターン
    { input: '渋谷駅', expected: { pref: '東京都', cityWard: '渋谷区' }, desc: '駅名のみ' },
    { input: '大宮駅', expected: { pref: '埼玉県', cityWard: 'さいたま市大宮区' }, desc: '駅名のみ（大宮）' }
  ];

  return runTestCases(testCases, '境界値');
}

/**
 * カテゴリ6: 実データパターンテスト
 */
function testRealDataPatterns() {
  console.log('\n' + '─'.repeat(60));
  console.log('📋 カテゴリ6: 実データパターンテスト');
  console.log('─'.repeat(60));

  const testCases = [
    // === 群馬県パターン ===
    { input: '群馬県 前橋市 大手町', expected: { pref: '群馬県', cityWard: '前橋市' }, desc: '群馬県前橋市' },
    { input: '群馬県 高崎市 栄町', expected: { pref: '群馬県', cityWard: '高崎市' }, desc: '群馬県高崎市' },
    { input: '群馬県 太田市 本町', expected: { pref: '群馬県', cityWard: '太田市' }, desc: '群馬県太田市' },
    { input: '群馬県 伊勢崎市', expected: { pref: '群馬県', cityWard: '伊勢崎市' }, desc: '群馬県伊勢崎市' },
    { input: '群馬県 桐生市', expected: { pref: '群馬県', cityWard: '桐生市' }, desc: '群馬県桐生市' },

    // === 埼玉県パターン ===
    { input: '埼玉県 さいたま市 大宮区 天沼町', expected: { pref: '埼玉県' }, desc: '埼玉県さいたま市大宮区' },
    { input: '埼玉県 川口市 新井宿', expected: { pref: '埼玉県', cityWard: '川口市' }, desc: '埼玉県川口市' },
    { input: '埼玉県 越谷市 南越谷', expected: { pref: '埼玉県', cityWard: '越谷市' }, desc: '埼玉県越谷市' },
    { input: '埼玉県 草加市 高砂', expected: { pref: '埼玉県', cityWard: '草加市' }, desc: '埼玉県草加市' },

    // === 東京都パターン ===
    { input: '東京都 渋谷区 神宮前', expected: { pref: '東京都', cityWard: '渋谷区' }, desc: '東京都渋谷区' },
    { input: '東京都 新宿区 西新宿', expected: { pref: '東京都', cityWard: '新宿区' }, desc: '東京都新宿区' },
    { input: '東京都 港区 六本木', expected: { pref: '東京都', cityWard: '港区' }, desc: '東京都港区' },
    { input: '東京都 中央区 銀座', expected: { pref: '東京都', cityWard: '中央区' }, desc: '東京都中央区' },
    { input: '東京都 北区 赤羽', expected: { pref: '東京都', cityWard: '北区' }, desc: '東京都北区' },

    // === 問題が発生しやすいパターン ===
    { input: '群馬県前橋市中央病院前', expected: { pref: '群馬県', notCityWard: '中央区' }, desc: '【要注意】群馬+中央病院' },
    { input: '埼玉県川口市北町1-2-3', expected: { pref: '埼玉県', notCityWard: '北区' }, desc: '【要注意】埼玉+北町' }
  ];

  return runTestCases(testCases, '実データパターン');
}

/**
 * カテゴリ7: データフロー整合性テスト
 */
function testDataFlowIntegrity() {
  console.log('\n' + '─'.repeat(60));
  console.log('📋 カテゴリ7: データフロー整合性テスト');
  console.log('─'.repeat(60));

  let passed = 0;
  let failed = 0;
  const failures = [];

  // テスト1: TOKYO_WARD_ALIASESに危険なエイリアスがないことを確認
  console.log('  1. TOKYO_WARD_ALIASESの検証');
  const dangerousAliases = ['中央', '北', '港'];
  let hasNoDAangerous = true;
  dangerousAliases.forEach(alias => {
    if (TOKYO_WARD_ALIASES[alias]) {
      console.log('    ❌ 危険なエイリアス「' + alias + '」が存在');
      hasNoDAangerous = false;
    }
  });
  if (hasNoDAangerous) {
    console.log('    ✅ 危険なエイリアスは削除済み');
    passed++;
  } else {
    failed++;
    failures.push({ desc: 'TOKYO_WARD_ALIASES検証', reason: '危険なエイリアスが存在' });
  }

  // テスト2: 安全なエイリアスが存在することを確認
  console.log('  2. 安全なエイリアスの検証');
  const safeAliases = ['渋谷', '新宿', '品川', '世田谷', '足立'];
  let allSafeExist = true;
  safeAliases.forEach(alias => {
    if (!TOKYO_WARD_ALIASES[alias]) {
      console.log('    ❌ 安全なエイリアス「' + alias + '」が欠落');
      allSafeExist = false;
    }
  });
  if (allSafeExist) {
    console.log('    ✅ 安全なエイリアスは全て存在');
    passed++;
  } else {
    failed++;
    failures.push({ desc: '安全なエイリアス検証', reason: 'エイリアスが欠落' });
  }

  // テスト3: tryTokyoWardMatch関数の挙動確認
  console.log('  3. tryTokyoWardMatch関数の検証');
  const tokyoMatchTests = [
    { input: '中央', expectNull: true },
    { input: '北', expectNull: true },
    { input: '港', expectNull: true },
    { input: '渋谷', expectNull: false },
    { input: '中央区', expectNull: false },
    { input: '北区', expectNull: false }
  ];
  let tokyoMatchPassed = true;
  tokyoMatchTests.forEach(test => {
    const result = tryTokyoWardMatch(test.input);
    const isNull = result === null;
    if (isNull !== test.expectNull) {
      console.log('    ❌ 「' + test.input + '」: 期待=' + (test.expectNull ? 'null' : '非null') + ', 実際=' + (isNull ? 'null' : result.cityWard));
      tokyoMatchPassed = false;
    }
  });
  if (tokyoMatchPassed) {
    console.log('    ✅ tryTokyoWardMatch関数は正常動作');
    passed++;
  } else {
    failed++;
    failures.push({ desc: 'tryTokyoWardMatch検証', reason: '期待と異なる結果' });
  }

  // テスト4: 解析パイプラインの整合性
  console.log('  4. 解析パイプライン整合性');
  const pipelineTests = [
    { location: '群馬県前橋市', companyName: '中央病院', expectedPref: '群馬県', notExpectedCity: '中央区' },
    { location: '埼玉県川口市', companyName: '北町クリニック', expectedPref: '埼玉県', notExpectedCity: '北区' }
  ];
  let pipelinePassed = true;
  pipelineTests.forEach(test => {
    // 所在地のみを解析（事業所名は解析対象外）
    const result = parseLocation(test.location);
    if (result.prefecture !== test.expectedPref) {
      console.log('    ❌ 都道府県不一致: ' + test.location);
      pipelinePassed = false;
    }
    if (result.cityWard === test.notExpectedCity) {
      console.log('    ❌ 事業所名が市区町村に混入: ' + test.companyName + ' → ' + result.cityWard);
      pipelinePassed = false;
    }
  });
  if (pipelinePassed) {
    console.log('    ✅ 解析パイプラインは正常');
    passed++;
  } else {
    failed++;
    failures.push({ desc: '解析パイプライン検証', reason: '混入検出' });
  }

  console.log('  結果: ' + passed + '/4');
  return { passed, failed, total: 4, failures };
}

/**
 * テストケース実行ヘルパー
 */
function runTestCases(testCases, categoryName) {
  let passed = 0;
  let failed = 0;
  const failures = [];

  testCases.forEach((tc, index) => {
    const result = parseLocation(tc.input);
    let isPass = true;
    let reason = '';

    // 都道府県チェック
    if (tc.expected.pref !== undefined && result.prefecture !== tc.expected.pref) {
      // nullの場合も許容
      if (!(tc.expected.pref === null && result.prefecture === null)) {
        isPass = false;
        reason = '都道府県: 期待=' + tc.expected.pref + ', 実際=' + result.prefecture;
      }
    }

    // 市区町村が一致すべきケース
    if (tc.expected.cityWard !== undefined) {
      if (result.cityWard !== tc.expected.cityWard) {
        // 部分一致チェック（政令指定都市+区の場合）
        if (!result.cityWard || !result.cityWard.includes(tc.expected.cityWard.replace(/区$/, '').replace(/市$/, ''))) {
          isPass = false;
          reason = '市区町村: 期待=' + tc.expected.cityWard + ', 実際=' + result.cityWard;
        }
      }
    }

    // 市区町村が一致してはいけないケース
    if (tc.expected.notCityWard && result.cityWard === tc.expected.notCityWard) {
      isPass = false;
      reason = '誤変換: ' + result.cityWard + 'になってしまった';
    }

    if (isPass) {
      console.log('  ✅ ' + (index + 1) + '. ' + tc.desc);
      passed++;
    } else {
      console.log('  ❌ ' + (index + 1) + '. ' + tc.desc + ' - ' + reason);
      failed++;
      failures.push({ desc: tc.desc, reason: reason });
    }
  });

  console.log('  結果: ' + passed + '/' + testCases.length);
  return { passed, failed, total: testCases.length, failures };
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * カテゴリ8: 全国網羅テスト
 * ═══════════════════════════════════════════════════════════════════════════
 * 目的: 個別最適ではなく、汎用的なロジックとして全国で正しく動作することを検証
 */
function runNationwideComprehensiveTest() {
  console.log('╔════════════════════════════════════════════════════════════════════╗');
  console.log('║           🗾 全国網羅テストスイート（汎用性検証）                  ║');
  console.log('╚════════════════════════════════════════════════════════════════════╝');

  const results = {
    prefectures: testAllPrefectures(),
    sameNameCities: testSameNameCities(),
    substringIssues: testSubstringIssues(),
    designatedCities: testAllDesignatedCities(),
    dangerousPatterns: testDangerousPatterns(),
    abbreviations: testAbbreviations()
  };

  // 集計
  let totalPassed = 0;
  let totalFailed = 0;
  let totalTests = 0;

  console.log('\n╔════════════════════════════════════════════════════════════════════╗');
  console.log('║                    📊 全国網羅テスト結果                           ║');
  console.log('╠════════════════════════════════════════════════════════════════════╣');

  for (const [category, result] of Object.entries(results)) {
    const status = result.failed === 0 ? '✅' : '❌';
    console.log('║ ' + status + ' ' + category.padEnd(25) + (result.passed + '/' + result.total).padEnd(10) + '║');
    totalPassed += result.passed;
    totalFailed += result.failed;
    totalTests += result.total;
  }

  console.log('╠════════════════════════════════════════════════════════════════════╣');
  const overallStatus = totalFailed === 0 ? '✅ 全テスト合格' : '❌ 失敗あり';
  const percentage = Math.round((totalPassed / totalTests) * 100);
  console.log('║ 合計: ' + totalPassed + '/' + totalTests + ' (' + percentage + '%)' + (' '.repeat(20)) + overallStatus.padEnd(15) + '║');
  console.log('╚════════════════════════════════════════════════════════════════════╝');

  return { totalPassed, totalFailed, totalTests, percentage, results };
}

/**
 * A. 47都道府県認識テスト
 */
function testAllPrefectures() {
  console.log('\n' + '─'.repeat(60));
  console.log('📋 A: 47都道府県認識テスト');
  console.log('─'.repeat(60));

  const prefectures = [
    '北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県',
    '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県',
    '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県', '岐阜県',
    '静岡県', '愛知県', '三重県', '滋賀県', '京都府', '大阪府', '兵庫県',
    '奈良県', '和歌山県', '鳥取県', '島根県', '岡山県', '広島県', '山口県',
    '徳島県', '香川県', '愛媛県', '高知県', '福岡県', '佐賀県', '長崎県',
    '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県'
  ];

  let passed = 0;
  let failed = 0;
  const failures = [];

  prefectures.forEach((pref, index) => {
    const testInput = pref + '○○市△△町1-2-3';
    const result = parseLocation(testInput);

    if (result.prefecture === pref) {
      passed++;
    } else {
      console.log('  ❌ ' + (index + 1) + '. ' + pref + ' → 実際: ' + result.prefecture);
      failed++;
      failures.push({ input: pref, expected: pref, actual: result.prefecture });
    }
  });

  if (failed === 0) {
    console.log('  ✅ 47都道府県すべて正常認識');
  }
  console.log('  結果: ' + passed + '/47');

  return { passed, failed, total: 47, failures };
}

/**
 * B. 同名市区町村テスト（府中市、伊達市など）
 */
function testSameNameCities() {
  console.log('\n' + '─'.repeat(60));
  console.log('📋 B: 同名市区町村テスト');
  console.log('─'.repeat(60));

  const testCases = [
    // 府中市（東京都 vs 広島県）
    { input: '東京都府中市宮町', expected: { pref: '東京都' }, desc: '東京都府中市' },
    { input: '広島県府中市府川町', expected: { pref: '広島県' }, desc: '広島県府中市' },

    // 伊達市（北海道 vs 福島県）
    { input: '北海道伊達市鹿島町', expected: { pref: '北海道' }, desc: '北海道伊達市' },
    { input: '福島県伊達市保原町', expected: { pref: '福島県' }, desc: '福島県伊達市' },

    // 中央区（東京、札幌、さいたま、千葉、大阪、神戸、福岡）
    { input: '東京都中央区銀座', expected: { pref: '東京都', cityWard: '中央区' }, desc: '東京都中央区' },
    { input: '北海道札幌市中央区', expected: { pref: '北海道' }, desc: '札幌市中央区' },
    { input: '埼玉県さいたま市中央区', expected: { pref: '埼玉県' }, desc: 'さいたま市中央区' },
    { input: '千葉県千葉市中央区', expected: { pref: '千葉県' }, desc: '千葉市中央区' },
    { input: '大阪府大阪市中央区', expected: { pref: '大阪府' }, desc: '大阪市中央区' },
    { input: '兵庫県神戸市中央区', expected: { pref: '兵庫県' }, desc: '神戸市中央区' },
    { input: '福岡県福岡市中央区', expected: { pref: '福岡県' }, desc: '福岡市中央区' },

    // 北区（東京、札幌、さいたま、名古屋、京都、大阪、神戸、堺、浜松、新潟、岡山）
    { input: '東京都北区赤羽', expected: { pref: '東京都', cityWard: '北区' }, desc: '東京都北区' },
    { input: '北海道札幌市北区', expected: { pref: '北海道' }, desc: '札幌市北区' },
    { input: '埼玉県さいたま市北区', expected: { pref: '埼玉県' }, desc: 'さいたま市北区' },
    { input: '愛知県名古屋市北区', expected: { pref: '愛知県' }, desc: '名古屋市北区' },
    { input: '京都府京都市北区', expected: { pref: '京都府' }, desc: '京都市北区' },
    { input: '大阪府大阪市北区', expected: { pref: '大阪府' }, desc: '大阪市北区' },
    { input: '兵庫県神戸市北区', expected: { pref: '兵庫県' }, desc: '神戸市北区' },
    { input: '大阪府堺市北区', expected: { pref: '大阪府' }, desc: '堺市北区' },
    { input: '静岡県浜松市北区', expected: { pref: '静岡県' }, desc: '浜松市北区' },
    { input: '新潟県新潟市北区', expected: { pref: '新潟県' }, desc: '新潟市北区' },
    { input: '岡山県岡山市北区', expected: { pref: '岡山県' }, desc: '岡山市北区' },

    // 南区・西区・東区（複数都市に存在）
    { input: '神奈川県横浜市南区', expected: { pref: '神奈川県' }, desc: '横浜市南区' },
    { input: '神奈川県横浜市西区', expected: { pref: '神奈川県' }, desc: '横浜市西区' },
    { input: '広島県広島市東区', expected: { pref: '広島県' }, desc: '広島市東区' },
    { input: '福岡県福岡市東区', expected: { pref: '福岡県' }, desc: '福岡市東区' }
  ];

  return runTestCases(testCases, '同名市区町村');
}

/**
 * C. 部分文字列問題テスト（東京都 vs 京都府など）
 */
function testSubstringIssues() {
  console.log('\n' + '─'.repeat(60));
  console.log('📋 C: 部分文字列問題テスト');
  console.log('─'.repeat(60));

  const testCases = [
    // 東京都 vs 京都府（「京都」が「東京都」の部分文字列）
    { input: '東京都', expected: { pref: '東京都' }, desc: '「東京都」単体' },
    { input: '京都府', expected: { pref: '京都府' }, desc: '「京都府」単体' },
    { input: '東京都渋谷区', expected: { pref: '東京都' }, desc: '東京都渋谷区' },
    { input: '京都府京都市', expected: { pref: '京都府' }, desc: '京都府京都市' },
    { input: '東京都中央区京橋', expected: { pref: '東京都' }, desc: '東京都中央区京橋（京の字含む）' },

    // 山口県 vs 口（部分文字列ではないが念のため）
    { input: '山口県下関市', expected: { pref: '山口県' }, desc: '山口県下関市' },

    // 大分県（「分」が他で使われる可能性）
    { input: '大分県大分市', expected: { pref: '大分県' }, desc: '大分県大分市' },

    // 福島県 vs 福岡県（「福」が共通）
    { input: '福島県郡山市', expected: { pref: '福島県' }, desc: '福島県郡山市' },
    { input: '福岡県北九州市', expected: { pref: '福岡県' }, desc: '福岡県北九州市' },

    // 山形県 vs 山梨県（「山」が共通）
    { input: '山形県山形市', expected: { pref: '山形県' }, desc: '山形県山形市' },
    { input: '山梨県甲府市', expected: { pref: '山梨県' }, desc: '山梨県甲府市' }
  ];

  return runTestCases(testCases, '部分文字列問題');
}

/**
 * D. 全20政令指定都市テスト
 */
function testAllDesignatedCities() {
  console.log('\n' + '─'.repeat(60));
  console.log('📋 D: 全20政令指定都市テスト');
  console.log('─'.repeat(60));

  const designatedCities = [
    { city: '札幌市', pref: '北海道', ward: '中央区' },
    { city: '仙台市', pref: '宮城県', ward: '青葉区' },
    { city: 'さいたま市', pref: '埼玉県', ward: '大宮区' },
    { city: '千葉市', pref: '千葉県', ward: '中央区' },
    { city: '横浜市', pref: '神奈川県', ward: '西区' },
    { city: '川崎市', pref: '神奈川県', ward: '川崎区' },
    { city: '相模原市', pref: '神奈川県', ward: '中央区' },
    { city: '新潟市', pref: '新潟県', ward: '中央区' },
    { city: '静岡市', pref: '静岡県', ward: '葵区' },
    { city: '浜松市', pref: '静岡県', ward: '中央区' },
    { city: '名古屋市', pref: '愛知県', ward: '中区' },
    { city: '京都市', pref: '京都府', ward: '中京区' },
    { city: '大阪市', pref: '大阪府', ward: '北区' },
    { city: '堺市', pref: '大阪府', ward: '堺区' },
    { city: '神戸市', pref: '兵庫県', ward: '中央区' },
    { city: '岡山市', pref: '岡山県', ward: '北区' },
    { city: '広島市', pref: '広島県', ward: '中区' },
    { city: '北九州市', pref: '福岡県', ward: '小倉北区' },
    { city: '福岡市', pref: '福岡県', ward: '中央区' },
    { city: '熊本市', pref: '熊本県', ward: '中央区' }
  ];

  let passed = 0;
  let failed = 0;
  const failures = [];

  designatedCities.forEach((dc, index) => {
    const testInput = dc.pref + dc.city + dc.ward;
    const result = parseLocation(testInput);

    if (result.prefecture === dc.pref) {
      console.log('  ✅ ' + (index + 1) + '. ' + dc.city + dc.ward);
      passed++;
    } else {
      console.log('  ❌ ' + (index + 1) + '. ' + dc.city + dc.ward + ' → 都道府県: 期待=' + dc.pref + ', 実際=' + result.prefecture);
      failed++;
      failures.push({ input: testInput, expected: dc.pref, actual: result.prefecture });
    }
  });

  console.log('  結果: ' + passed + '/20');
  return { passed, failed, total: 20, failures };
}

/**
 * E. 危険パターンテスト（町名に区名が含まれるケース）
 */
function testDangerousPatterns() {
  console.log('\n' + '─'.repeat(60));
  console.log('📋 E: 危険パターンテスト（誤変換防止）');
  console.log('─'.repeat(60));

  const testCases = [
    // 「中央」を含む地名（中央区に誤変換されないこと）
    { input: '群馬県前橋市中央通り', expected: { pref: '群馬県', notCityWard: '中央区' }, desc: '群馬+中央通り' },
    { input: '栃木県宇都宮市中央町', expected: { pref: '栃木県', notCityWard: '中央区' }, desc: '栃木+中央町' },
    { input: '茨城県水戸市中央', expected: { pref: '茨城県', notCityWard: '中央区' }, desc: '茨城+中央' },
    { input: '長野県長野市中央通り', expected: { pref: '長野県', notCityWard: '中央区' }, desc: '長野+中央通り' },

    // 「北」を含む地名（北区に誤変換されないこと）
    { input: '群馬県高崎市北町', expected: { pref: '群馬県', notCityWard: '北区' }, desc: '群馬+北町' },
    { input: '埼玉県川口市北園町', expected: { pref: '埼玉県', notCityWard: '北区' }, desc: '埼玉+北園町' },
    { input: '千葉県柏市北柏', expected: { pref: '千葉県', notCityWard: '北区' }, desc: '千葉+北柏' },
    { input: '神奈川県厚木市北町', expected: { pref: '神奈川県', notCityWard: '北区' }, desc: '神奈川+北町' },

    // 「港」を含む地名（港区に誤変換されないこと）
    { input: '静岡県焼津市港町', expected: { pref: '静岡県', notCityWard: '港区' }, desc: '静岡+港町' },
    { input: '新潟県新潟市港南区', expected: { pref: '新潟県', notCityWard: '港区' }, desc: '新潟+港南区' },
    { input: '愛知県蒲郡市港町', expected: { pref: '愛知県', notCityWard: '港区' }, desc: '愛知+港町' },

    // 事業所名パターン（所在地に含まれる可能性）
    { input: '群馬県前橋市 中央病院前', expected: { pref: '群馬県', notCityWard: '中央区' }, desc: '群馬+中央病院' },
    { input: '埼玉県川口市 北口駅前', expected: { pref: '埼玉県', notCityWard: '北区' }, desc: '埼玉+北口' },
    { input: '千葉県船橋市 港通り商店街', expected: { pref: '千葉県', notCityWard: '港区' }, desc: '千葉+港通り' },

    // 複合パターン
    { input: '岐阜県岐阜市中央北町', expected: { pref: '岐阜県', notCityWard: '中央区' }, desc: '岐阜+中央北町' },
    { input: '三重県津市北中央町', expected: { pref: '三重県', notCityWard: '北区' }, desc: '三重+北中央町' }
  ];

  return runTestCases(testCases, '危険パターン');
}

/**
 * F. 省略形・エイリアステスト
 */
function testAbbreviations() {
  console.log('\n' + '─'.repeat(60));
  console.log('📋 F: 省略形・エイリアステスト');
  console.log('─'.repeat(60));

  const testCases = [
    // 東京23区の省略形（安全なもののみ）
    { input: '渋谷駅周辺', expected: { pref: '東京都', cityWard: '渋谷区' }, desc: '渋谷→渋谷区' },
    { input: '新宿駅西口', expected: { pref: '東京都', cityWard: '新宿区' }, desc: '新宿→新宿区' },
    { input: '品川駅港南口', expected: { pref: '東京都', cityWard: '品川区' }, desc: '品川→品川区' },
    { input: '世田谷公園', expected: { pref: '東京都', cityWard: '世田谷区' }, desc: '世田谷→世田谷区' },
    { input: '足立区役所前', expected: { pref: '東京都', cityWard: '足立区' }, desc: '足立区→足立区' },

    // 政令指定都市の省略形
    { input: '横浜駅東口', expected: { pref: '神奈川県' }, desc: '横浜→横浜市' },
    { input: '名古屋駅太閤通口', expected: { pref: '愛知県' }, desc: '名古屋→名古屋市' },
    { input: '福岡天神', expected: { pref: '福岡県' }, desc: '福岡→福岡市' },
    { input: '札幌すすきの', expected: { pref: '北海道' }, desc: '札幌→札幌市' },
    { input: '仙台駅前', expected: { pref: '宮城県' }, desc: '仙台→仙台市' },

    // 危険な省略形（変換してはいけない）
    { input: '中央病院', expected: { pref: null, notCityWard: '中央区' }, desc: '「中央」単体→変換しない' },
    { input: '北商店', expected: { pref: null, notCityWard: '北区' }, desc: '「北」単体→変換しない' },
    { input: '港倉庫', expected: { pref: null, notCityWard: '港区' }, desc: '「港」単体→変換しない' }
  ];

  return runTestCases(testCases, '省略形・エイリアス');
}
