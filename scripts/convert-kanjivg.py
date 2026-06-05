#!/usr/bin/env python3
"""
KanjiVGデータを kanji-data.js に変換するスクリプト。
小学校学習漢字（grade 1-6）を対象とする。
学年情報は文部科学省の配当漢字リストを内蔵している。
"""

import gzip, xml.etree.ElementTree as ET, math, re, json, os, urllib.request

KANJIVG_URL = "https://github.com/KanjiVG/kanjivg/releases/download/r20250816/kanjivg-20250816.xml.gz"

# 文部科学省 小学校学習漢字 配当表（2020年版）
GRADE_KANJI = {
    1: "一右雨円王音下火花貝学気九休玉金空月犬見五口校左三山子四糸字耳七車手十出女小上森人水正生青夕石赤千川先早草足村大男竹中虫町天田土二日入年白八百文木本名目立力林六",
    2: "引羽雲園遠何科夏家歌画回会海絵外角活間丸岩顔汽記帰弓牛魚京強教近兄形計元言原戸古午後語工公広交光考行高黄合国黒今才細作算止市矢姉思紙寺自時室社弱首春書少場色食心新親図数西声星晴切雪船線前組走多太体台地池知茶昼長鳥朝直通弟店点電刀冬当東答頭同道読内南肉馬売買麦半番父風分聞米歩母方北毎妹万明鳴毛門夜野友用曜来里理話",
    3: "悪安暗医委意育員院飲運泳駅央横屋温化荷界開階寒感漢館岸起期客究急級宮球去橋業曲局銀区苦具君係軽血決研県庫湖向幸港号根祭皿仕死使始指歯詩次事持式実写者主守取酒受州拾終習集住重宿所暑助昭消商章勝乗植申身神真深進世整昔全想相送息速族他打対待代第題炭短談着注柱丁帳調追定庭笛鉄転都度投豆島湯登等動童農波配倍箱畑発反坂板皮悲美鼻筆氷表秒品負部服福物平返勉放味命面問役薬由油有遊予羊洋葉陽様落流旅両緑礼列練路和",
    4: "愛案以位囲胃印英栄塩億加果貨課芽改械害街各覚完官管関観願希季機旗器喜技義議救型径景芸欠結建健験固功好差最材昨札刷察参散産残司史試士失借種周祝順初松笑唱焼象照省城清静席積折節説浅戦選然争倉巣束帯隊達単典伝徒努灯堂働特仲兆腸低底停的典伝努度梅博飯費必票標府付不夫副辺変布武富兵別便包法望牧末満未民無約勇要養浴利率陸良料量連録",
    5: "圧移因永営衛易益液演応往桜恩仮価河過賀快解格確額刊幹慣眼基寄規技喜疑義逆久旧居許境均禁句型経潔件険現限個故護効厚耕鉱構興講告混査再災妻採際在財罪雑酸賛支志枝師資飼示似識質舎謝授収従習衆容所処勝常情状織職制勢性政精製税責績接設絶舌銭祖素総造像増則測属率損態貸退断築貯張停提程適敵統銅導徳独任燃能破判版比肥非備俵評貧布婦武復複仏粉編弁保墓報豊防務夢迷綿輸余容率略留領",
    6: "異遺域宇映延沿我灰拡閣革割巻干巻看簡危机揮貴疑吸供胸郷勤筋敬系警劇激穴絹権憲源厳己呼誤后孝皇紅降鋼刻穀骨困砂座済裁策冊蚕至私姿視詞誌磁射捨尺若樹収宗就衆従縦縮熟純処署諸除将傷障城蒸針仁垂推寸盛聖誠舌宣専泉洗染善奏窓創装層操蔵臓存尊宅担探誕段暖値宙忠著庁頂潮賃痛展討党糖届難乳認納脳派俳背肺班晩否批秘腹奮並陛閉片補暮宝訪亡忘棒枚幕密盟模訳郵優幼欲翌乱卵覧裏律臨朗論",
}

# 全漢字→学年のマッピングを作成
CHAR_TO_GRADE = {}
for grade, chars in GRADE_KANJI.items():
    for ch in chars:
        CHAR_TO_GRADE[ch] = grade


def download_kanjivg(dest_path):
    print(f"KanjiVGをダウンロード中...")
    urllib.request.urlretrieve(KANJIVG_URL, dest_path)
    print("ダウンロード完了")


def parse_path_endpoints(d):
    nums = re.findall(r'[-+]?\d*\.?\d+', d)
    if len(nums) < 4:
        return None, None
    f = [float(n) for n in nums]
    return (f[0], f[1]), (f[-2], f[-1])


DIRS = ['right','right-down','down','left-down','left','left-up','up','right-up']

def direction_from_points(start, end):
    if start is None or end is None:
        return "down"
    dx, dy = end[0]-start[0], end[1]-start[1]
    dist = math.sqrt(dx*dx + dy*dy)
    if dist < 8:
        return "dot"
    angle = math.degrees(math.atan2(dy, dx))
    return DIRS[round(((angle+360)%360)/45) % 8]


def get_bpm_base(n):
    if n <= 4: return 60
    if n <= 8: return 72
    if n <= 12: return 84
    return 96


def extract_strokes(kanji_el):
    strokes = []
    for el in kanji_el.iter():
        tag = el.tag.split('}')[-1] if '}' in el.tag else el.tag
        if tag == 'path':
            d = el.get('d', '')
            eid = el.get('id', '')
            # stroke要素はid に "-s数字" を含む
            if d and re.search(r'-s\d+$', eid):
                s, e = parse_path_endpoints(d)
                strokes.append({'direction': direction_from_points(s, e), 'path': d})
    return strokes


def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    gz_path = os.path.join(script_dir, "kanjivg.xml.gz")
    out_path = os.path.join(script_dir, "..", "js", "kanji-data.js")

    if not os.path.exists(gz_path):
        download_kanjivg(gz_path)

    print("KanjiVGを解析中...")
    with gzip.open(gz_path, 'rb') as f:
        content = f.read()

    root = ET.fromstring(content)

    # unicode -> kanji要素のマップを作成
    unicode_map = {}
    for kanji_el in root.findall('kanji'):
        kid = kanji_el.get('id','')
        m = re.search(r'([0-9a-f]{4,5})$', kid)
        if m:
            unicode_map[m.group(1)] = kanji_el

    kanji_list = []
    missing = []

    for grade in range(1, 7):
        for ch in GRADE_KANJI[grade]:
            cp = format(ord(ch), '05x')
            if cp not in unicode_map:
                missing.append(ch)
                continue
            kanji_el = unicode_map[cp]
            strokes = extract_strokes(kanji_el)
            if not strokes:
                missing.append(ch)
                continue
            kanji_list.append({
                'kanji': ch,
                'unicode': cp,
                'grade': grade,
                'strokeCount': len(strokes),
                'bpmBase': get_bpm_base(len(strokes)),
                'strokes': strokes
            })

    print(f"{len(kanji_list)} 字を変換しました")
    if missing:
        print(f"データなし（スキップ）: {''.join(missing)}")
    for g in range(1,7):
        c = sum(1 for k in kanji_list if k['grade']==g)
        print(f"  {g}年生: {c}字")

    js  = "// kanji-data.js - KanjiVGから自動生成（scripts/convert-kanjivg.pyで再生成可能）\n"
    js += "// KanjiVG: CC-BY-SA 3.0 (Ulrich Apel) https://kanjivg.tagaini.net\n\n"
    js += "var KANJI_DATA=" + json.dumps(kanji_list, ensure_ascii=False, separators=(',',':')) + ";\n\n"
    js += "function getKanjiByGrade(g){return KANJI_DATA.filter(function(k){return k.grade===g;});}\n"
    js += "function getRandomKanji(g,n){n=n||10;var p=getKanjiByGrade(g).slice().sort(function(){return Math.random()-0.5;});return p.slice(0,Math.min(n,p.length));}\n"

    with open(out_path,'w',encoding='utf-8') as f:
        f.write(js)
    print(f"\n出力完了: {os.path.abspath(out_path)}")


if __name__ == '__main__':
    main()
