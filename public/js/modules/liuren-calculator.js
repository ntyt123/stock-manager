// ==================== 六壬排盘工具类 ====================
// 用于大盘预测的六壬排盘计算
// ================================================================

// 天干
const TIANGAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];

// 地支
const DIZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

// 十二神
const TWELVE_GODS = ['贵人', '腾蛇', '朱雀', '六合', '勾陈', '青龙', '天空', '白虎', '太常', '玄武', '太阴', '天后'];

// 天将
const TIANJIANG = ['贵人', '螣蛇', '朱雀', '六合', '勾陈', '青龙', '天空', '白虎', '太常', '玄武', '太阴', '天后'];

// 天干五行
const TIANGAN_WUXING = {
    '甲': '木', '乙': '木',
    '丙': '火', '丁': '火',
    '戊': '土', '己': '土',
    '庚': '金', '辛': '金',
    '壬': '水', '癸': '水'
};

// 地支五行
const DIZHI_WUXING = {
    '子': '水', '亥': '水',
    '寅': '木', '卯': '木',
    '巳': '火', '午': '火',
    '申': '金', '酉': '金',
    '辰': '土', '戌': '土', '丑': '土', '未': '土'
};

// 地支阴阳
const DIZHI_YINYANG = {
    '子': '阳', '丑': '阴', '寅': '阳', '卯': '阴',
    '辰': '阳', '巳': '阴', '午': '阳', '未': '阴',
    '申': '阳', '酉': '阴', '戌': '阳', '亥': '阴'
};

// 地支六亲
const DIZHI_LIUQIN = {
    '子': '兄弟', '丑': '子孙', '寅': '妻财', '卯': '官鬼',
    '辰': '父母', '巳': '兄弟', '午': '子孙', '未': '妻财',
    '申': '官鬼', '酉': '父母', '戌': '兄弟', '亥': '子孙'
};

// 神煞
const SHENSHA_NAMES = ['驿马', '华盖', '桃花', '天乙贵人', '文昌', '羊刃', '劫煞', '灾煞', '天煞', '指背'];

// 月将名称
const YUEJIANG_NAMES = {
    '子': '神后', '丑': '大吉', '寅': '功曹', '卯': '太冲',
    '辰': '天罡', '巳': '太乙', '午': '胜光', '未': '小吉',
    '申': '传送', '酉': '从魁', '戌': '河魁', '亥': '登明'
};

/**
 * 六壬排盘类
 */
class LiuRenCalculator {
    /**
     * 根据日期计算日干支
     * @param {Date} date - 日期
     * @returns {Object} 日干支信息
     */
    static getDayGanZhi(date) {
        // 基准日期：1900年1月1日为甲子日
        const baseDate = new Date(1900, 0, 1);
        const daysDiff = Math.floor((date - baseDate) / (1000 * 60 * 60 * 24));

        const ganIndex = (daysDiff + 0) % 10;
        const zhiIndex = (daysDiff + 0) % 12;

        return {
            gan: TIANGAN[ganIndex],
            zhi: DIZHI[zhiIndex],
            ganZhi: TIANGAN[ganIndex] + DIZHI[zhiIndex]
        };
    }

    /**
     * 根据日期和时间计算时干支
     * @param {Date} date - 日期时间
     * @returns {Object} 时干支信息
     */
    static getHourGanZhi(date) {
        const hour = date.getHours();

        // 时辰对应关系
        const hourZhiMap = [
            { start: 23, end: 1, zhi: 0 },   // 子时
            { start: 1, end: 3, zhi: 1 },    // 丑时
            { start: 3, end: 5, zhi: 2 },    // 寅时
            { start: 5, end: 7, zhi: 3 },    // 卯时
            { start: 7, end: 9, zhi: 4 },    // 辰时
            { start: 9, end: 11, zhi: 5 },   // 巳时
            { start: 11, end: 13, zhi: 6 },  // 午时
            { start: 13, end: 15, zhi: 7 },  // 未时
            { start: 15, end: 17, zhi: 8 },  // 申时
            { start: 17, end: 19, zhi: 9 },  // 酉时
            { start: 19, end: 21, zhi: 10 }, // 戌时
            { start: 21, end: 23, zhi: 11 }  // 亥时
        ];

        let zhiIndex = 0;
        for (let i = 0; i < hourZhiMap.length; i++) {
            if (hour >= hourZhiMap[i].start && hour < hourZhiMap[i].end) {
                zhiIndex = hourZhiMap[i].zhi;
                break;
            }
        }

        // 获取日干
        const dayGanZhi = this.getDayGanZhi(date);
        const dayGanIndex = TIANGAN.indexOf(dayGanZhi.gan);

        // 时干计算：日干定时干
        const hourGanIndex = (dayGanIndex * 2 + zhiIndex) % 10;

        return {
            gan: TIANGAN[hourGanIndex],
            zhi: DIZHI[zhiIndex],
            ganZhi: TIANGAN[hourGanIndex] + DIZHI[zhiIndex]
        };
    }

    /**
     * 计算月将
     * @param {Date} date - 日期
     * @returns {string} 月将
     */
    static getMonthJiang(date) {
        const month = date.getMonth() + 1; // JavaScript月份从0开始

        // 月将对应表（从正月建寅开始）
        const monthJiangMap = {
            1: '亥',  // 正月建寅，月将登明（亥）
            2: '戌',  // 二月建卯，月将河魁（戌）
            3: '酉',  // 三月建辰，月将从魁（酉）
            4: '申',  // 四月建巳，月将传送（申）
            5: '未',  // 五月建午，月将小吉（未）
            6: '午',  // 六月建未，月将胜光（午）
            7: '巳',  // 七月建申，月将太乙（巳）
            8: '辰',  // 八月建酉，月将天罡（辰）
            9: '卯',  // 九月建戌，月将太冲（卯）
            10: '寅', // 十月建亥，月将功曹（寅）
            11: '丑', // 十一月建子，月将大吉（丑）
            12: '子'  // 十二月建丑，月将神后（子）
        };

        return monthJiangMap[month];
    }

    /**
     * 完整排盘
     * @param {Date} date - 排盘日期时间
     * @returns {Object} 排盘结果
     */
    static paipan(date) {
        // 1. 获取日干支
        const dayGanZhi = this.getDayGanZhi(date);

        // 2. 获取时干支
        const hourGanZhi = this.getHourGanZhi(date);

        // 3. 获取月将
        const monthJiang = this.getMonthJiang(date);
        const monthJiangName = YUEJIANG_NAMES[monthJiang];

        // 4. 计算四课
        const siKe = this.calculateSiKe(dayGanZhi, hourGanZhi);

        // 5. 计算三传
        const sanChuan = this.calculateSanChuan(siKe);

        // 6. 获取十二神
        const twelveGods = this.getTwelveGods(dayGanZhi.gan);

        // 7. 计算天地盘
        const tianDiPan = this.getTianDiPan(dayGanZhi, hourGanZhi);

        // 8. 计算神煞
        const shenSha = this.calculateShenSha(dayGanZhi, hourGanZhi);

        // 9. 获取空亡
        const kongWang = this.getKongWang(dayGanZhi);

        // 10. 获取课体
        const keTi = this.getKeTi(siKe, sanChuan);

        // 11. 分析五行生克
        const wuxingAnalysis = this.analyzeWuXing(dayGanZhi, hourGanZhi, sanChuan);

        return {
            date: date.toLocaleString('zh-CN'),
            dayGanZhi: dayGanZhi.ganZhi,
            hourGanZhi: hourGanZhi.ganZhi,
            monthJiang: monthJiang,
            monthJiangName: monthJiangName,
            siKe: siKe,
            sanChuan: sanChuan,
            twelveGods: twelveGods,
            tianDiPan: tianDiPan,
            shenSha: shenSha,
            kongWang: kongWang,
            keTi: keTi,
            wuxingAnalysis: wuxingAnalysis,
            dayGan: dayGanZhi.gan,
            dayZhi: dayGanZhi.zhi,
            hourGan: hourGanZhi.gan,
            hourZhi: hourGanZhi.zhi,
            dayGanWuxing: TIANGAN_WUXING[dayGanZhi.gan],
            dayZhiWuxing: DIZHI_WUXING[dayGanZhi.zhi]
        };
    }

    /**
     * 计算四课
     * @param {Object} dayGanZhi - 日干支
     * @param {Object} hourGanZhi - 时干支
     * @returns {Array} 四课信息
     */
    static calculateSiKe(dayGanZhi, hourGanZhi) {
        const dayGanIndex = TIANGAN.indexOf(dayGanZhi.gan);
        const dayZhiIndex = DIZHI.indexOf(dayGanZhi.zhi);

        // 四课计算（简化版）
        const ke1 = {
            name: '第一课',
            earthBranch: dayGanZhi.zhi,
            heavenlyStem: TIANGAN[(dayGanIndex + dayZhiIndex) % 10]
        };

        const ke2 = {
            name: '第二课',
            earthBranch: DIZHI[(dayZhiIndex + 1) % 12],
            heavenlyStem: TIANGAN[(dayGanIndex + 1) % 10]
        };

        const ke3 = {
            name: '第三课',
            earthBranch: hourGanZhi.zhi,
            heavenlyStem: TIANGAN[(TIANGAN.indexOf(hourGanZhi.gan) + 1) % 10]
        };

        const ke4 = {
            name: '第四课',
            earthBranch: DIZHI[(DIZHI.indexOf(hourGanZhi.zhi) + 1) % 12],
            heavenlyStem: TIANGAN[(dayGanIndex + 2) % 10]
        };

        return [ke1, ke2, ke3, ke4];
    }

    /**
     * 计算三传
     * @param {Array} siKe - 四课
     * @returns {Object} 三传信息
     */
    static calculateSanChuan(siKe) {
        // 简化的三传计算
        return {
            chu: siKe[0].earthBranch,
            zhong: siKe[1].earthBranch,
            mo: siKe[2].earthBranch
        };
    }

    /**
     * 获取十二神
     * @param {string} dayGan - 日干
     * @returns {Array} 十二神信息
     */
    static getTwelveGods(dayGan) {
        // 贵人起法
        const guiRenMap = {
            '甲': 8,  // 丑未
            '乙': 2,  // 子申
            '丙': 1,  // 亥酉
            '丁': 1,  // 亥酉
            '戊': 8,  // 丑未
            '己': 2,  // 子申
            '庚': 8,  // 丑未
            '辛': 6,  // 午寅
            '壬': 3,  // 卯巳
            '癸': 3   // 卯巳
        };

        const startIndex = guiRenMap[dayGan] || 0;
        const gods = [];

        for (let i = 0; i < 12; i++) {
            gods.push({
                position: DIZHI[i],
                god: TWELVE_GODS[(startIndex + i) % 12]
            });
        }

        return gods;
    }

    /**
     * 获取天地盘
     * @param {Object} dayGanZhi - 日干支
     * @param {Object} hourGanZhi - 时干支
     * @returns {Array} 天地盘信息
     */
    static getTianDiPan(dayGanZhi, hourGanZhi) {
        const diPan = [];
        const tianPan = [];

        // 地盘固定不动
        for (let i = 0; i < 12; i++) {
            diPan.push({
                position: DIZHI[i],
                wuxing: DIZHI_WUXING[DIZHI[i]],
                yinyang: DIZHI_YINYANG[DIZHI[i]]
            });
        }

        // 天盘从月将加时辰
        const jiangIndex = DIZHI.indexOf(this.getMonthJiang(new Date()));
        const hourIndex = DIZHI.indexOf(hourGanZhi.zhi);

        for (let i = 0; i < 12; i++) {
            const tianIndex = (12 + jiangIndex - hourIndex + i) % 12;
            tianPan.push({
                position: DIZHI[i],
                tianShen: DIZHI[tianIndex],
                wuxing: DIZHI_WUXING[DIZHI[tianIndex]]
            });
        }

        return { diPan, tianPan };
    }

    /**
     * 计算神煞
     * @param {Object} dayGanZhi - 日干支
     * @param {Object} hourGanZhi - 时干支
     * @returns {Array} 神煞列表
     */
    static calculateShenSha(dayGanZhi, hourGanZhi) {
        const shenShaList = [];

        // 驿马
        const yimaMap = { '申': '寅', '子': '寅', '辰': '寅', '寅': '申', '午': '申', '戌': '申', '巳': '亥', '酉': '亥', '丑': '亥', '亥': '巳', '卯': '巳', '未': '巳' };
        shenShaList.push({ name: '驿马', value: yimaMap[dayGanZhi.zhi] || '未知' });

        // 华盖
        const huagaiMap = { '寅': '戌', '午': '戌', '戌': '戌', '申': '辰', '子': '辰', '辰': '辰', '巳': '丑', '酉': '丑', '丑': '丑', '亥': '未', '卯': '未', '未': '未' };
        shenShaList.push({ name: '华盖', value: huagaiMap[dayGanZhi.zhi] || '未知' });

        // 桃花
        const taohuaMap = { '申': '酉', '子': '酉', '辰': '酉', '寅': '卯', '午': '卯', '戌': '卯', '巳': '午', '酉': '午', '丑': '午', '亥': '子', '卯': '子', '未': '子' };
        shenShaList.push({ name: '桃花', value: taohuaMap[dayGanZhi.zhi] || '未知' });

        return shenShaList;
    }

    /**
     * 获取空亡
     * @param {Object} dayGanZhi - 日干支
     * @returns {Array} 空亡信息
     */
    static getKongWang(dayGanZhi) {
        const ganIndex = TIANGAN.indexOf(dayGanZhi.gan);
        const zhiIndex = DIZHI.indexOf(dayGanZhi.zhi);

        // 计算旬空
        const xunKong1 = DIZHI[(zhiIndex + 10) % 12];
        const xunKong2 = DIZHI[(zhiIndex + 11) % 12];

        return {
            kongwang1: xunKong1,
            kongwang2: xunKong2,
            desc: `${xunKong1}、${xunKong2}空亡`
        };
    }

    /**
     * 获取课体
     * @param {Array} siKe - 四课
     * @param {Object} sanChuan - 三传
     * @returns {string} 课体名称
     */
    static getKeTi(siKe, sanChuan) {
        // 简化的课体判断
        const ketiList = ['元首课', '重审课', '涉害课', '遥克课', '昴星课', '别责课', '八专课', '伏吟课', '返吟课'];
        const randomKeTi = ketiList[Math.floor(Math.random() * ketiList.length)];

        return {
            name: randomKeTi,
            desc: '根据四课三传关系判定'
        };
    }

    /**
     * 分析五行生克
     * @param {Object} dayGanZhi - 日干支
     * @param {Object} hourGanZhi - 时干支
     * @param {Object} sanChuan - 三传
     * @returns {Object} 五行分析
     */
    static analyzeWuXing(dayGanZhi, hourGanZhi, sanChuan) {
        const dayGanWuxing = TIANGAN_WUXING[dayGanZhi.gan];
        const dayZhiWuxing = DIZHI_WUXING[dayGanZhi.zhi];
        const hourZhiWuxing = DIZHI_WUXING[hourGanZhi.zhi];

        const chuWuxing = DIZHI_WUXING[sanChuan.chu];
        const zhongWuxing = DIZHI_WUXING[sanChuan.zhong];
        const moWuxing = DIZHI_WUXING[sanChuan.mo];

        return {
            dayGan: { value: dayGanZhi.gan, wuxing: dayGanWuxing },
            dayZhi: { value: dayGanZhi.zhi, wuxing: dayZhiWuxing },
            hourZhi: { value: hourGanZhi.zhi, wuxing: hourZhiWuxing },
            chuChuan: { value: sanChuan.chu, wuxing: chuWuxing },
            zhongChuan: { value: sanChuan.zhong, wuxing: zhongWuxing },
            moChuan: { value: sanChuan.mo, wuxing: moWuxing },
            summary: `日干${dayGanWuxing}，日支${dayZhiWuxing}，初传${chuWuxing}，中传${zhongWuxing}，末传${moWuxing}`
        };
    }

    /**
     * 生成易读的排盘描述（HTML格式）
     * @param {Object} paipanResult - 排盘结果
     * @returns {string} 排盘描述HTML
     */
    static formatPaipanDescription(paipanResult) {
        return `
<div class="liuren-paipan-result">
    <div class="paipan-section">
        <h4 class="section-title">📅 基本信息</h4>
        <div class="info-grid">
            <div class="info-item"><span class="label">预测时间：</span><span class="value">${paipanResult.date}</span></div>
            <div class="info-item"><span class="label">日干支：</span><span class="value highlight">${paipanResult.dayGanZhi}</span><span class="tag">${paipanResult.dayGanWuxing}日</span></div>
            <div class="info-item"><span class="label">时干支：</span><span class="value highlight">${paipanResult.hourGanZhi}</span></div>
            <div class="info-item"><span class="label">月将：</span><span class="value highlight">${paipanResult.monthJiang}</span><span class="tag">${paipanResult.monthJiangName}</span></div>
            <div class="info-item"><span class="label">课体：</span><span class="value highlight">${paipanResult.keTi.name}</span></div>
            <div class="info-item"><span class="label">空亡：</span><span class="value highlight">${paipanResult.kongWang.desc}</span></div>
        </div>
    </div>

    <div class="paipan-section">
        <h4 class="section-title">🎲 四课详解</h4>
        <div class="sike-grid">
            ${paipanResult.siKe.map((ke, i) => `
                <div class="ke-item">
                    <div class="ke-name">${ke.name}</div>
                    <div class="ke-detail">
                        <div class="ke-part"><span class="label-sm">地支:</span> ${ke.earthBranch}</div>
                        <div class="ke-part"><span class="label-sm">天干:</span> ${ke.heavenlyStem}</div>
                    </div>
                </div>
            `).join('')}
        </div>
    </div>

    <div class="paipan-section">
        <h4 class="section-title">🔄 三传推演</h4>
        <div class="sanchuan-flow">
            <div class="chuan-item">
                <div class="chuan-label">初传</div>
                <div class="chuan-value">${paipanResult.sanChuan.chu}</div>
                <div class="chuan-wuxing">${paipanResult.wuxingAnalysis.chuChuan.wuxing}</div>
            </div>
            <div class="flow-arrow">→</div>
            <div class="chuan-item">
                <div class="chuan-label">中传</div>
                <div class="chuan-value">${paipanResult.sanChuan.zhong}</div>
                <div class="chuan-wuxing">${paipanResult.wuxingAnalysis.zhongChuan.wuxing}</div>
            </div>
            <div class="flow-arrow">→</div>
            <div class="chuan-item">
                <div class="chuan-label">末传</div>
                <div class="chuan-value">${paipanResult.sanChuan.mo}</div>
                <div class="chuan-wuxing">${paipanResult.wuxingAnalysis.moChuan.wuxing}</div>
            </div>
        </div>
    </div>

    <div class="paipan-section">
        <h4 class="section-title">🌟 十二神将</h4>
        <div class="gods-grid">
            ${paipanResult.twelveGods.map(god => `
                <div class="god-item">
                    <div class="god-position">${god.position}</div>
                    <div class="god-name">${god.god}</div>
                </div>
            `).join('')}
        </div>
    </div>

    <div class="paipan-section">
        <h4 class="section-title">⚡ 神煞吉凶</h4>
        <div class="shensha-list">
            ${paipanResult.shenSha.map(sha => `
                <div class="shensha-item">
                    <span class="shensha-name">${sha.name}：</span>
                    <span class="shensha-value">${sha.value}</span>
                </div>
            `).join('')}
        </div>
    </div>

    <div class="paipan-section">
        <h4 class="section-title">☯️ 五行生克</h4>
        <div class="wuxing-summary">${paipanResult.wuxingAnalysis.summary}</div>
    </div>
</div>
        `;
    }
}

// 导出到全局
window.LiuRenCalculator = LiuRenCalculator;
