/**
 * GeoData.js - 地理データモジュール
 * 主要都市の座標データと地図関連機能
 * 給与分布位置計算機能を含む
 * Phase 1最適化: DataLayerを使用してデータ取得を一元化
 */

const CITY_COORDINATES = {
  "札幌市": [43.0618, 141.3545],
  "函館市": [41.7686, 140.7290],
  "旭川市": [43.7707, 142.3650],
  "仙台市": [38.2682, 140.8694],
  "青森市": [40.8246, 140.7400],
  "盛岡市": [39.7036, 141.1527],
  "秋田市": [39.7200, 140.1026],
  "山形市": [38.2404, 140.3633],
  "福島市": [37.7503, 140.4676],
  "東京都": [35.6762, 139.6503],
  "横浜市": [35.4437, 139.6380],
  "川崎市": [35.5309, 139.7030],
  "さいたま市": [35.8617, 139.6455],
  "千葉市": [35.6073, 140.1063],
  "相模原市": [35.5714, 139.3735],
  "宇都宮市": [36.5551, 139.8826],
  "前橋市": [36.3895, 139.0634],
  "水戸市": [36.3418, 140.4468],
  "千代田区": [35.6940, 139.7536],
  "中央区": [35.6706, 139.7727],
  "港区": [35.6581, 139.7514],
  "新宿区": [35.6938, 139.7036],
  "文京区": [35.7081, 139.7522],
  "台東区": [35.7126, 139.7800],
  "墨田区": [35.7107, 139.8015],
  "江東区": [35.6729, 139.8172],
  "品川区": [35.6092, 139.7302],
  "目黒区": [35.6413, 139.6983],
  "大田区": [35.5614, 139.7160],
  "世田谷区": [35.6461, 139.6532],
  "渋谷区": [35.6640, 139.6982],
  "中野区": [35.7077, 139.6638],
  "杉並区": [35.6994, 139.6364],
  "豊島区": [35.7263, 139.7165],
  "北区": [35.7528, 139.7337],
  "荒川区": [35.7360, 139.7834],
  "板橋区": [35.7512, 139.7090],
  "練馬区": [35.7355, 139.6517],
  "足立区": [35.7748, 139.8047],
  "葛飾区": [35.7436, 139.8477],
  "江戸川区": [35.7067, 139.8685],
  "名古屋市": [35.1815, 136.9066],
  "静岡市": [34.9756, 138.3828],
  "浜松市": [34.7108, 137.7261],
  "新潟市": [37.9024, 139.0232],
  "金沢市": [36.5944, 136.6256],
  "富山市": [36.6953, 137.2114],
  "長野市": [36.6485, 138.1950],
  "岐阜市": [35.4233, 136.7606],
  "福井市": [36.0652, 136.2216],
  "甲府市": [35.6636, 138.5684],
  "大阪市": [34.6937, 135.5023],
  "京都市": [35.0116, 135.7681],
  "神戸市": [34.6901, 135.1956],
  "堺市": [34.5733, 135.4830],
  "奈良市": [34.6851, 135.8329],
  "和歌山市": [34.2260, 135.1675],
  "大津市": [35.0045, 135.8686],
  "津市": [34.7303, 136.5086],
  "大阪市北区": [34.7055, 135.4983],
  "大阪市中央区": [34.6815, 135.5100],
  "大阪市天王寺区": [34.6532, 135.5183],
  "大阪市浪速区": [34.6595, 135.5012],
  "大阪市淀川区": [34.7261, 135.4908],
  "広島市": [34.3853, 132.4553],
  "岡山市": [34.6617, 133.9350],
  "倉敷市": [34.5850, 133.7722],
  "福山市": [34.4859, 133.3625],
  "山口市": [34.1859, 131.4714],
  "鳥取市": [35.5039, 134.2380],
  "松江市": [35.4723, 133.0505],
  "高松市": [34.3401, 134.0434],
  "松山市": [33.8392, 132.7657],
  "高知市": [33.5597, 133.5311],
  "徳島市": [34.0657, 134.5593],
  "福岡市": [33.5902, 130.4017],
  "北九州市": [33.8834, 130.8752],
  "熊本市": [32.7898, 130.7417],
  "鹿児島市": [31.5966, 130.5571],
  "長崎市": [32.7503, 129.8777],
  "大分市": [33.2382, 131.6126],
  "宮崎市": [31.9111, 131.4239],
  "佐賀市": [33.2494, 130.2988],
  "那覇市": [26.2124, 127.6809],
  "沼田市": [36.6447, 139.0442],
  "渋川市": [36.4892, 139.0],
  "高崎市": [36.3219, 139.0028],
  "桐生市": [36.4053, 139.3308],
  "伊勢崎市": [36.3114, 139.1969],
  "太田市": [36.2914, 139.3758],
  "館林市": [36.2447, 139.5422],
  "藤岡市": [36.2556, 139.0736],
  "富岡市": [36.26, 138.8914],
  "安中市": [36.3269, 138.8875],
  "みどり市": [36.3978, 139.2806],
  "榛東村": [36.4528, 139.0283],
  "吉岡町": [36.4433, 139.0175],
  "上野村": [36.0639, 138.8],
  "神流町": [36.0833, 138.9333],
  "下仁田町": [36.2133, 138.7872],
  "南牧村": [36.1311, 138.7667],
  "甘楽町": [36.2467, 138.9172],
  "中之条町": [36.5939, 138.8447],
  "長野原町": [36.5444, 138.6333],
  "嬬恋村": [36.5278, 138.5222],
  "草津町": [36.6208, 138.5958],
  "高山村": [36.5994, 138.9219],
  "東吾妻町": [36.5667, 138.8333],
  "片品村": [36.7869, 139.2233],
  "川場村": [36.6931, 139.0983],
  "昭和村": [36.6017, 139.0633],
  "みなかみ町": [36.78, 138.9967],
  "玉村町": [36.2989, 139.1122],
  "板倉町": [36.2303, 139.6019],
  "明和町": [36.2153, 139.5319],
  "千代田町": [36.2167, 139.4383],
  "大泉町": [36.2494, 139.4022],
  "邑楽町": [36.2486, 139.4681],
  "川口市": [35.8078, 139.7241],
  "川越市": [35.9251, 139.4857],
  "所沢市": [35.7989, 139.4689],
  "越谷市": [35.8911, 139.7908],
  "草加市": [35.8256, 139.8056],
  "春日部市": [35.9756, 139.7525],
  "上尾市": [35.9775, 139.5933],
  "熊谷市": [36.1472, 139.3886],
  "新座市": [35.7936, 139.5653],
  "久喜市": [36.0622, 139.6667],
  "狭山市": [35.8528, 139.4122],
  "入間市": [35.8358, 139.3911],
  "深谷市": [36.1975, 139.2814],
  "三郷市": [35.8311, 139.8736],
  "朝霞市": [35.7983, 139.5936],
  "戸田市": [35.8175, 139.6778],
  "鴻巣市": [36.0656, 139.5208],
  "加須市": [36.1317, 139.6017],
  "富士見市": [35.8575, 139.5489],
  "坂戸市": [35.9572, 139.4028],
  "東松山市": [36.0422, 139.4003],
  "八潮市": [35.8225, 139.8389],
  "行田市": [36.1389, 139.4558],
  "飯能市": [35.8558, 139.3286],
  "本庄市": [36.2439, 139.1903],
  "蕨市": [35.8256, 139.6794],
  "志木市": [35.8383, 139.5803],
  "和光市": [35.7814, 139.6064],
  "桶川市": [35.9933, 139.5572],
  "北本市": [36.0269, 139.5303],
  "蓮田市": [35.9931, 139.6617],
  "白岡市": [36.0172, 139.6769],
  "秩父市": [35.9914, 139.0856],
  "羽生市": [36.1722, 139.5483],
  "幸手市": [36.0778, 139.7258],
  "鶴ヶ島市": [35.9356, 139.3917],
  "日高市": [35.9072, 139.3392],
  "吉川市": [35.8922, 139.8403],
  "ふじみ野市": [35.8794, 139.5194],
  "船橋市": [35.6947, 139.9828],
  "松戸市": [35.7878, 139.9036],
  "市川市": [35.7219, 139.9311],
  "柏市": [35.8675, 139.9758],
  "市原市": [35.4981, 140.1156],
  "八千代市": [35.7225, 140.0997],
  "流山市": [35.8561, 139.9028],
  "浦安市": [35.6536, 139.9019],
  "習志野市": [35.6808, 140.0267],
  "野田市": [35.955, 139.8747],
  "木更津市": [35.3761, 139.9269],
  "我孫子市": [35.8642, 140.0283],
  "成田市": [35.7767, 140.3183],
  "鎌ケ谷市": [35.7769, 140.0011],
  "印西市": [35.8317, 140.1453],
  "佐倉市": [35.7244, 140.2219],
  "藤沢市": [35.3389, 139.49],
  "横須賀市": [35.2814, 139.6722],
  "平塚市": [35.3294, 139.3497],
  "茅ヶ崎市": [35.3339, 139.4039],
  "大和市": [35.4878, 139.4619],
  "厚木市": [35.4428, 139.3647],
  "小田原市": [35.2644, 139.1528],
  "鎌倉市": [35.3192, 139.5467],
  "秦野市": [35.3736, 139.2181],
  "海老名市": [35.4461, 139.3906],
  "座間市": [35.4886, 139.4081],
  "伊勢原市": [35.4019, 139.3136],
  "綾瀬市": [35.4361, 139.4286],
  "つくば市": [36.0833, 140.0767],
  "日立市": [36.5992, 140.6514],
  "ひたちなか市": [36.3967, 140.5347],
  "古河市": [36.1908, 139.7556],
  "土浦市": [36.0833, 140.2036],
  "取手市": [35.9119, 140.0503],
  "筑西市": [36.3072, 139.9836],
  "神栖市": [35.8906, 140.6647],
  "牛久市": [35.9792, 140.15],
  "足利市": [36.3408, 139.4497],
  "栃木市": [36.3819, 139.7308],
  "佐野市": [36.3144, 139.5783],
  "鹿沼市": [36.5669, 139.7456],
  "日光市": [36.72, 139.6983],
  "小山市": [36.3147, 139.8008],
  "真岡市": [36.4394, 140.0131],
  "大田原市": [36.8719, 140.0192],
  "矢板市": [36.8069, 139.9269],
  "那須塩原市": [36.9619, 140.0456]
};
const PREFECTURE_COORDINATES = {
  "北海道": [43.0646, 141.3468],
  "青森県": [40.8246, 140.7400],
  "岩手県": [39.7036, 141.1527],
  "宮城県": [38.2682, 140.8694],
  "秋田県": [39.7200, 140.1026],
  "山形県": [38.2404, 140.3633],
  "福島県": [37.7503, 140.4676],
  "茨城県": [36.3418, 140.4468],
  "栃木県": [36.5551, 139.8826],
  "群馬県": [36.3895, 139.0634],
  "埼玉県": [35.8617, 139.6455],
  "千葉県": [35.6073, 140.1063],
  "東京都": [35.6762, 139.6503],
  "神奈川県": [35.4478, 139.6425],
  "新潟県": [37.9024, 139.0232],
  "富山県": [36.6953, 137.2114],
  "石川県": [36.5944, 136.6256],
  "福井県": [36.0652, 136.2216],
  "山梨県": [35.6636, 138.5684],
  "長野県": [36.6485, 138.1950],
  "岐阜県": [35.4233, 136.7606],
  "静岡県": [34.9756, 138.3828],
  "愛知県": [35.1815, 136.9066],
  "三重県": [34.7303, 136.5086],
  "滋賀県": [35.0045, 135.8686],
  "京都府": [35.0116, 135.7681],
  "大阪府": [34.6937, 135.5023],
  "兵庫県": [34.6901, 135.1956],
  "奈良県": [34.6851, 135.8329],
  "和歌山県": [34.2260, 135.1675],
  "鳥取県": [35.5039, 134.2380],
  "島根県": [35.4723, 133.0505],
  "岡山県": [34.6617, 133.9350],
  "広島県": [34.3853, 132.4553],
  "山口県": [34.1859, 131.4714],
  "徳島県": [34.0657, 134.5593],
  "香川県": [34.3401, 134.0434],
  "愛媛県": [33.8392, 132.7657],
  "高知県": [33.5597, 133.5311],
  "福岡県": [33.5902, 130.4017],
  "佐賀県": [33.2494, 130.2988],
  "長崎県": [32.7503, 129.8777],
  "熊本県": [32.7898, 130.7417],
  "大分県": [33.2382, 131.6126],
  "宮崎県": [31.9111, 131.4239],
  "鹿児島県": [31.5966, 130.5571],
  "沖縄県": [26.2124, 127.6809]
};


/**
 * 市区町村名から座標を取得
 * @param {string} cityName - 市区町村名
 * @param {string} [prefecture] - 都道府県名（オプション、同名地名の区別に使用）
 * @returns {number[]|null} [緯度, 経度] または null
 *
 * 検索優先順位:
 * 1. 都道府県+市区町村の複合キー（例: "大阪市北区"）
 * 2. CITY_COORDINATES完全一致
 * 3. 都道府県が一致する同名地名（北区、中央区等の曖昧性解決）
 * 4. CITY_COORDINATES部分一致
 * 5. PREFECTURE_COORDINATESフォールバック
 */
function getCityCoordinates(cityName, prefecture) {
  if (!cityName) return null;

  // 1. 都道府県+市区町村の複合キーで検索（例: "大阪市北区"）
  if (prefecture) {
    // 都道府県名から「都府県」を除去して市名を取得（大阪府→大阪）
    const prefBase = prefecture.replace(/[都道府県]$/, '');
    const compositeKey = prefBase + '市' + cityName;  // 例: "大阪市北区"
    if (CITY_COORDINATES[compositeKey]) {
      return CITY_COORDINATES[compositeKey];
    }
  }

  // 2. 完全一致
  if (CITY_COORDINATES[cityName]) return CITY_COORDINATES[cityName];

  // 3. 都道府県が一致する同名地名の検索（北区、中央区等）
  // 同名の可能性がある地名リスト
  const ambiguousNames = ['北区', '中央区', '南区', '西区', '東区', '緑区', '青葉区'];
  if (prefecture && ambiguousNames.includes(cityName)) {
    // 都道府県に基づく座標マッピング
    const prefectureCityMap = {
      '東京都': { '北区': [35.7528, 139.7337], '中央区': [35.6706, 139.7727] },
      '大阪府': { '北区': [34.7055, 135.4983], '中央区': [34.6815, 135.5100] },
      '神奈川県': { '中央区': [35.5764, 139.3731], '南区': [35.4264, 139.5847], '緑区': [35.5181, 139.5353] },
      '愛知県': { '北区': [35.1969, 136.9131], '中央区': [35.1706, 136.8808], '南区': [35.0994, 136.9306], '緑区': [35.0589, 136.9622] },
      '埼玉県': { '北区': [35.9342, 139.6228], '中央区': [35.8847, 139.6147], '南区': [35.8442, 139.6328], '緑区': [35.8664, 139.6717] },
      '北海道': { '北区': [43.0908, 141.3408], '中央区': [43.0550, 141.3486], '南区': [42.9897, 141.3536], '西区': [43.0744, 141.2972], '東区': [43.0761, 141.3839] },
      '福岡県': { '中央区': [33.5897, 130.3992], '南区': [33.5617, 130.4286], '西区': [33.5783, 130.3364], '東区': [33.6211, 130.4256] },
      '広島県': { '中央区': [34.3853, 132.4553], '南区': [34.3706, 132.4656], '西区': [34.3983, 132.4322], '東区': [34.3961, 132.4847] },
      '京都府': { '北区': [35.0439, 135.7578], '中央区': [35.0003, 135.7681], '南区': [34.9622, 135.7569], '西京区': [34.9953, 135.7086] },
      '兵庫県': { '北区': [34.7247, 135.1483], '中央区': [34.6901, 135.1878], '西区': [34.6797, 134.9697] },
      '静岡県': { '葵区': [34.9756, 138.3828], '駿河区': [34.9478, 138.4136], '清水区': [35.0158, 138.4900] },
      '新潟県': { '北区': [37.9192, 139.2181], '中央区': [37.9024, 139.0232], '南区': [37.8428, 139.0111], '西区': [37.8694, 138.9447], '東区': [37.9147, 139.0867] },
      '熊本県': { '北区': [32.8419, 130.7050], '中央区': [32.7898, 130.7417], '南区': [32.7478, 130.7447], '西区': [32.7833, 130.6636], '東区': [32.7925, 130.7736] },
      '岡山県': { '北区': [34.6706, 133.9194], '中央区': [34.6617, 133.9350], '南区': [34.6106, 133.9256], '東区': [34.6853, 133.9758] }
    };

    if (prefectureCityMap[prefecture] && prefectureCityMap[prefecture][cityName]) {
      return prefectureCityMap[prefecture][cityName];
    }
  }

  // 4. 部分一致（市区町村）
  for (const [city, coords] of Object.entries(CITY_COORDINATES)) {
    if (cityName.includes(city) || city.includes(cityName)) return coords;
  }

  // 5. 部分一致（都道府県フォールバック）
  // まず指定された都道府県を優先
  if (prefecture && PREFECTURE_COORDINATES[prefecture]) {
    return PREFECTURE_COORDINATES[prefecture];
  }

  for (const [pref, coords] of Object.entries(PREFECTURE_COORDINATES)) {
    if (cityName.includes(pref) || pref.includes(cityName)) return coords;
  }

  return null;
}

function getTargetLocations() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("検索対象");
  if (!sheet) { sheet = createTargetLocationSheet(ss); return []; }
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];
  const data = sheet.getRange(2, 1, lastRow - 1, 6).getValues();
  const targets = [];
  data.forEach(row => {
    const cityName = row[0];
    const note = row[1] || "";
    const salaryMin = row[2] ? Number(row[2]) : null;
    const salaryMax = row[3] ? Number(row[3]) : null;
    const priority = row[4] || "";
    const searchKeyword = row[5] || "";
    if (!cityName) return;
    const coords = getCityCoordinates(cityName);
    if (coords) {
      targets.push({
        name: cityName, note: note,
        salaryMin: salaryMin, salaryMax: salaryMax,
        priority: priority, searchKeyword: searchKeyword, lat: coords[0], lng: coords[1]
      });
    }
  });
  return targets;
}

function createTargetLocationSheet(ss) {
  const sheet = ss.insertSheet("検索対象");
  const headers = [["市区町村名", "メモ", "希望給与下限(万円)", "希望給与上限(万円)", "優先度", "検索ワード"]];
  sheet.getRange(1, 1, 1, 6).setValues(headers);
  sheet.getRange(1, 1, 1, 6)
    .setBackground("#4285f4").setFontColor("#ffffff").setFontWeight("bold");
  sheet.getRange(2, 1, 3, 6).setValues([
    ["渋谷区", "主要ターゲット", 25, 35, "A", "渋谷 IT"],
    ["新宿区", "", 20, "", "B", ""],
    ["港区", "", "", "", "B", ""]
  ]);
  sheet.setColumnWidth(1, 120);
  sheet.setColumnWidth(2, 150);
  sheet.setColumnWidth(3, 120);
  sheet.setColumnWidth(4, 120);
  sheet.setColumnWidth(5, 60);
  sheet.setColumnWidth(6, 150);
  sheet.getRange(1, 8).setValue("【入力ガイド】");
  sheet.getRange(2, 8).setValue("・給与は月給万円単位で入力");
  sheet.getRange(3, 8).setValue("・空欄の場合は分布位置を計算しない");
  sheet.getRange(4, 8).setValue("・優先度: A(高), B(中), C(低)");
  sheet.getRange(5, 8).setValue("・検索ワード: Indeedで使用したキーワード");
  sheet.getRange(1, 8, 5, 1).setFontColor("#666666").setFontSize(9);
  return sheet;
}

/** 給与の分布位置を計算（DataLayer使用） */
function calculateSalaryPosition(salaryMin, salaryMax, cityName) {
  return DataLayer.calculatePosition(salaryMin, salaryMax, cityName);
}

/** マップ用データを取得（DataLayer使用で最適化） */
function getMapData() {
  try {
    console.log("getMapData: DataLayerを使用してデータ取得開始（forceRefresh=true）");
    // 常に最新データを使用
    const aggregation = DataLayer.getAggregation(true);
    const targets = getTargetLocations();
    targets.forEach(target => {
      if (target.salaryMin || target.salaryMax) {
        target.positionAll = DataLayer.calculatePosition(target.salaryMin, target.salaryMax, null);
        target.positionLocal = DataLayer.calculatePosition(target.salaryMin, target.salaryMax, target.name);
      }
    });
    // 全てのデータ取得でforceRefresh=trueを使用
    const cityData = DataLayer.getCityAggregation(true);
    const bounds = calculateMapBounds(targets, cityData);
    const salaryStats = DataLayer.getSalaryStats(true);
    const targetCityNames = targets.map(t => t.name);
    const inflowAnalysis = targetCityNames.length > 0
      ? DataLayer.calculateInflow(targetCityNames, true)
      : { error: "検索対象が設定されていません" };
    console.log("getMapData: データ取得完了");
    return {
      success: true,
      data: {
        targets: targets, cities: cityData, bounds: bounds,
        summary: aggregation.summary, salaryStats: salaryStats, inflowAnalysis: inflowAnalysis
      }
    };
  } catch (error) {
    console.error("getMapData error:", error);
    return { success: false, error: error.toString() };
  }
}

/**
 * 統一マップデータ取得（HTML用の安定したエントリポイント）
 * @returns {Object} マップデータ
 */
function fetchMapData() {
  console.log('=== fetchMapData 開始 ===');

  try {
    const result = getMapData();

    // 戻り値を安全にシリアライズ可能な形式に変換
    try {
      const safeResult = JSON.parse(JSON.stringify(result));
      console.log('fetchMapData: シリアライズ成功');
      return safeResult;
    } catch (serializeError) {
      console.error('fetchMapData: シリアライズエラー:', serializeError);
      return { success: false, error: 'データのシリアライズに失敗しました' };
    }
  } catch (error) {
    console.error('fetchMapData エラー:', error);
    return { success: false, error: error.toString() };
  }
}

/** 給与統計を取得（DataLayer使用） */
function getSalaryStatistics() {
  return DataLayer.getSalaryStats(true);
}

/** 都市別マップ集計（DataLayer使用）後方互換性のため */
function aggregateByCityForMap(aggregation) {
  return DataLayer.getCityAggregation(true);
}

function calculateMapBounds(targets, cities) {
  const allPoints = [...targets.map(t => [t.lat, t.lng]), ...cities.map(c => [c.lat, c.lng])];
  if (allPoints.length === 0) return { center: [36.5, 138.0], zoom: 5 };
  const lats = allPoints.map(p => p[0]);
  const lngs = allPoints.map(p => p[1]);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const centerLat = (minLat + maxLat) / 2, centerLng = (minLng + maxLng) / 2;
  const maxDiff = Math.max(maxLat - minLat, maxLng - minLng);
  let zoom = 5;
  if (maxDiff < 0.5) zoom = 12; else if (maxDiff < 1) zoom = 10;
  else if (maxDiff < 2) zoom = 9; else if (maxDiff < 4) zoom = 8;
  else if (maxDiff < 8) zoom = 7; else if (maxDiff < 15) zoom = 6;
  return { center: [centerLat, centerLng], zoom: zoom,
           bounds: [[minLat - 0.1, minLng - 0.1], [maxLat + 0.1, maxLng + 0.1]] };
}

function getAllCoordinates() {
  return { cities: CITY_COORDINATES, prefectures: PREFECTURE_COORDINATES };
}

function getSalaryPosition(salaryMin, salaryMax, cityName) {
  try {
    const position = DataLayer.calculatePosition(salaryMin, salaryMax, cityName);
    return { success: true, data: position };
  } catch (error) {
    console.error("getSalaryPosition error:", error);
    return { success: false, error: error.toString() };
  }
}

/** 流入率分析（DataLayer使用） */
function calculateInflowRate() {
  const targets = getTargetLocations();
  if (targets.length === 0) return { error: "検索対象が設定されていません" };
  const targetCityNames = targets.map(t => t.name);
  return DataLayer.calculateInflow(targetCityNames, true);
}

/** 流入率分析結果を取得（APIハンドラ用） */
function getInflowAnalysis() {
  try {
    const result = calculateInflowRate();
    return { success: true, data: result };
  } catch (error) {
    console.error("getInflowAnalysis error:", error);
    return { success: false, error: error.toString() };
  }
}

/**
 * getCityCoordinatesのテスト関数（GASエディタから直接実行可能）
 */
function testGetCityCoordinates() {
  console.log('=== getCityCoordinates テスト ===');

  const testCases = [
    { city: '渋谷区', pref: null, expected: '東京都渋谷区' },
    { city: '北区', pref: '東京都', expected: '東京都北区' },
    { city: '北区', pref: '大阪府', expected: '大阪府北区' },
    { city: '中央区', pref: '東京都', expected: '東京都中央区' },
    { city: '中央区', pref: null, expected: '最初にマッチしたもの' },
    { city: '', pref: null, expected: 'null' },
    { city: null, pref: null, expected: 'null' },
    { city: '存在しない市', pref: '東京都', expected: '東京都座標' },
  ];

  testCases.forEach((tc, i) => {
    try {
      const result = getCityCoordinates(tc.city, tc.pref);
      console.log((i + 1) + '. city=' + tc.city + ', pref=' + tc.pref);
      console.log('   結果: ' + JSON.stringify(result));
      console.log('   期待: ' + tc.expected);
    } catch (e) {
      console.error((i + 1) + '. エラー: ' + e.message);
    }
  });

  console.log('=== テスト完了 ===');
}
