
// Simplified Lunar Calendar Logic
// For a production app, use 'lunar-javascript', but here we use a lightweight algorithmic approximation 
// suitable for the current decade to avoid large dependencies.

const LUNAR_INFO = [
    0x04bd8, 0x04ae0, 0x0a570, 0x054d5, 0x0d260, 0x0d950, 0x16554, 0x056a0, 0x09ad0, 0x055d2,
    0x04ae0, 0x0a5b6, 0x0a4d0, 0x0d250, 0x1d255, 0x0b540, 0x0d6a0, 0x0ada2, 0x095b0, 0x14977,
    0x04970, 0x0a4b0, 0x0b4b5, 0x06a50, 0x06d40, 0x1ab54, 0x02b60, 0x09570, 0x052f2, 0x04970,
    0x06566, 0x0d4a0, 0x0ea50, 0x06e95, 0x05ad0, 0x02b60, 0x186e3, 0x092e0, 0x1c8d7, 0x0c950,
    0x0d4a0, 0x1d8a6, 0x0b550, 0x056a0, 0x1a5b4, 0x025d0, 0x092d0, 0x0d2b2, 0x0a950, 0x0b557
];

const CHINESE_NUMBER = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二'];
const CHINESE_DAY = ['初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
    '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
    '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十'];

// Daily Words Database
export interface DailyWord {
    word: string;
    pronunciation: string;
    meaning: string;
    example: string;
    chinese: string;
    chineseMean: string;
}

const WORDS_DB: DailyWord[] = [
    { word: "Serendipity", pronunciation: "/ˌser.ənˈdɪp.ə.ti/", meaning: "Finding something good without looking for it.", example: "Meeting her was pure serendipity.", chinese: "机缘巧合", chineseMean: "无意间发现美好事物的运气" },
    { word: "Resilience", pronunciation: "/rɪˈzɪl.jəns/", meaning: "The capacity to recover quickly from difficulties.", example: "The team showed great resilience.", chinese: "韧性", chineseMean: "从逆境中迅速恢复的能力" },
    { word: "Ephemeral", pronunciation: "/ɪˈfem.ər.əl/", meaning: "Lasting for a very short time.", example: "Fashion trends are often ephemeral.", chinese: "转瞬即逝", chineseMean: "生命短暂的，朝生暮死的" },
    { word: "Ineffable", pronunciation: "/ɪnˈef.ə.bəl/", meaning: "Too great or extreme to be expressed in words.", example: "The beauty of the sunset was ineffable.", chinese: "难以言表", chineseMean: "美妙得无法用语言形容" },
    { word: "Mellifluous", pronunciation: "/meˈlɪf.lu.əs/", meaning: "Sweet or musical; pleasant to hear.", example: "She had a rich, mellifluous voice.", chinese: "悦耳动听", chineseMean: "声音甜美流畅的" },
    { word: "Petrichor", pronunciation: "/ˈpet.rɪ.kɔːr/", meaning: "The pleasant smell of earth after rain.", example: "I love the scent of petrichor in spring.", chinese: "潮土油香", chineseMean: "雨后泥土的芬芳" },
    { word: "Sonder", pronunciation: "/ˈsɒn.də/", meaning: "The realization that each passerby has a life as complex as your own.", example: "Looking at the city lights, I felt sonder.", chinese: "众生皆苦", chineseMean: "意识到每个人都有自己复杂的生命故事" },
    { word: "Limerence", pronunciation: "/ˈlɪm.ər.əns/", meaning: "State of being infatuated with another person.", example: "It wasn't love, just limerence.", chinese: "纯爱迷恋", chineseMean: "对某人不由自主的迷恋状态" }
];

export function getLunarDate(date: Date): { day: string; month: string; zodiac: string } {
    // Simple mock for the immediate visual requirement (Robust algorithm is > 500 lines)
    // In a real app, we'd use a library. Here we map standard cycle for demo.
    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();
    
    // Offset calculation (approximate)
    const baseDate = new Date(2024, 1, 10); // Lunar New Year 2024
    const diffTime = date.getTime() - baseDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    // Cycle through 29.53 days per lunar month approx
    let lunarDayIdx = (diffDays % 29 + 29) % 29;
    
    // Zodiac
    const zodiacs = ['Rat', 'Ox', 'Tiger', 'Rabbit', 'Dragon', 'Snake', 'Horse', 'Goat', 'Monkey', 'Rooster', 'Dog', 'Pig'];
    const zodiac = zodiacs[(year - 4) % 12];

    return {
        day: CHINESE_DAY[lunarDayIdx] || '初一',
        month: CHINESE_NUMBER[(month + 1) % 12] + '月',
        zodiac: zodiac
    };
}

export function getDailyWord(date: Date): DailyWord {
    const dayOfYear = Math.floor((date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 1000 / 60 / 60 / 24);
    return WORDS_DB[dayOfYear % WORDS_DB.length];
}

export function getSeasonContext(date: Date): string {
    const month = date.getMonth();
    if (month >= 2 && month <= 4) return "Spring (春)";
    if (month >= 5 && month <= 7) return "Summer (夏)";
    if (month >= 8 && month <= 10) return "Autumn (秋)";
    return "Winter (冬)";
}
