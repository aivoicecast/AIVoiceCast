import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { GoogleGenAI } from '@google/genai';
import { Channel, Chapter, GeneratedLecture } from '../types';
import { generateSecureId } from './idUtils';

export const SERIF_FONT_STACK = 'Georgia, "Times New Roman", STSong, "SimSun", serif';
export const CHINESE_FONT_STACK = '"Microsoft YaHei", "微软雅黑", STXihei, "华文细黑", serif';

const UI_TEXT = {
    en: {
        frontHeader: "Neural Prism Technical Publication",
        compiledBy: "Compiled by Neural Host",
        sectorPrefix: "Sector Segment",
        manuscriptLabel: "NEURAL PRISM MANUSCRIPT",
        boundBy: "BOUND BY NEURAL PRISM",
        pageLabel: "PAGE",
        artifactTitle: "Neural Artifact",
        artifactDesc: "This document is a sovereign technical refraction synthesized via Neural Prism. Integrity verified against the global community ledger.",
        registryTitle: "Official Registry",
        publishingLabel: "NEURAL PRISM PUBLISHING",
        tagline: "BEYOND LLM // ACTIVITY CENTRIC INTERFACE",
        verifiedBinding: "VERIFIED BINDING",
        summaryPending: "Summary pending.",
        summaryUnavailable: "Summary unavailable."
    },
    zh: {
        frontHeader: "神经棱镜技术出版物",
        compiledBy: "由神经主机编译",
        sectorPrefix: "章节分段",
        manuscriptLabel: "神经棱镜技术原稿",
        boundBy: "由神经棱镜绑定",
        pageLabel: "页码",
        artifactTitle: "神经造物",
        artifactDesc: "本文档是通过神经棱镜合成的主权技术折射。完整性已通过全球社区账本验证。",
        registryTitle: "官方登记处",
        publishingLabel: "神经棱镜出版",
        tagline: "超越大语言模型 // 以活动为中心的界面",
        verifiedBinding: "已验证绑定",
        summaryPending: "摘要生成中。",
        summaryUnavailable: "无法获取摘要。"
    }
};

/**
 * Robust math pre-processor for PDF HTML injection.
 */
const renderMathInHtml = (text: string) => {
    if (!text) return '';
    // Block Math
    let html = text.replace(/\$\$([\s\S]+?)\$\$/g, (match, tex) => {
        try {
            return `<div style="margin: 20px 0; text-align: center;">${(window as any).katex.renderToString(tex, { displayMode: true, throwOnError: false })}</div>`;
        } catch (e) { return match; }
    });
    // Inline Math
    html = html.replace(/\$([^\$\n]+?)\$/g, (match, tex) => {
        try {
            return (window as any).katex.renderToString(tex, { displayMode: false, throwOnError: false });
        } catch (e) { return match; }
    });
    return html;
};

/**
 * Generates an executive summary for a chapter using Gemini 3 Flash.
 */
async function generateChapterSummary(ch: Chapter, language: 'en' | 'zh'): Promise<string> {
    const t = UI_TEXT[language];
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const langText = language === 'zh' ? '使用简体中文输出。' : 'Output in English.';
        const prompt = `Write a technical 2-sentence executive summary for a book chapter titled "${ch.title}". ${langText} Focus on the core architectural takeaways. Maximum 50 words.`;
        const res = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: { thinkingConfig: { thinkingBudget: 0 } }
        });
        return res.text || t.summaryPending;
    } catch (e) {
        return t.summaryUnavailable;
    }
}

/**
 * Wraps content in a high-fidelity manuscript frame.
 */
const wrapContent = (html: string, chapterTitle: string, hash: string, pageNum: number, language: 'en' | 'zh') => {
    const t = UI_TEXT[language];
    const fontStack = language === 'zh' ? CHINESE_FONT_STACK : SERIF_FONT_STACK;
    return `
    <div style="width: 750px; height: 1050px; background: #ffffff; color: #0f172a; padding: 80px 100px; font-family: ${fontStack}; display: flex; flex-direction: column; position: relative;">
        <div style="display: flex; justify-content: space-between; border-bottom: 2px solid #f1f5f9; padding-bottom: 12px; margin-bottom: 40px;">
            <span style="font-size: 10px; font-weight: 900; color: #64748b; text-transform: uppercase; letter-spacing: 0.2em;">${chapterTitle}</span>
            <span style="font-size: 10px; font-weight: 900; color: #cbd5e1;">${t.manuscriptLabel}</span>
        </div>
        <div style="flex: 1; overflow: hidden; display: flex; flex-direction: column; justify-content: flex-start;">
            ${html}
        </div>
        <div style="margin-top: auto; padding-top: 20px; border-top: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center;">
            <p style="font-size: 8px; color: #cbd5e1; font-weight: 900; letter-spacing: 0.2em; margin: 0;">${t.boundBy} // TRACE: ${hash}</p>
            <p style="font-size: 10px; color: #64748b; font-weight: 900; margin: 0;">${t.pageLabel} ${pageNum}</p>
        </div>
    </div>
`;
};

/**
 * Orchestrates the full multi-page PDF book synthesis.
 */
export async function synthesizePodcastBook(
    channel: Channel,
    chapters: Chapter[],
    language: 'en' | 'zh',
    hydrateFn: (sub: any) => Promise<GeneratedLecture | null>,
    progressFn: (msg: string) => void,
    logFn: (msg: string, type?: any) => void
) {
    const t = UI_TEXT[language];
    const fontStack = language === 'zh' ? CHINESE_FONT_STACK : SERIF_FONT_STACK;
    let pageCounter = 1;
    
    try {
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: 'a4' });
        const pageWidth = pdf.internal.pageSize.getWidth();
        const sessionHash = generateSecureId().substring(0, 12).toUpperCase();
        
        const captureContainer = document.createElement('div');
        captureContainer.style.width = '750px'; 
        captureContainer.style.position = 'fixed';
        captureContainer.style.left = '-10000px';
        captureContainer.style.backgroundColor = '#ffffff';
        document.body.appendChild(captureContainer);

        const renderToPdf = async (html: string, addPageBefore = true) => {
            if (addPageBefore) { pdf.addPage(); pageCounter++; }
            captureContainer.innerHTML = html;
            const canvas = await html2canvas(captureContainer, { scale: 2.2, useCORS: true, backgroundColor: '#ffffff', logging: false });
            const imgData = canvas.toDataURL('image/jpeg', 0.85);
            pdf.addImage(imgData, 'JPEG', 0, 0, pageWidth, (canvas.height * pageWidth) / canvas.width);
        };

        progressFn(language === 'zh' ? "正在打印封面..." : "Printing Front Cover...");
        await renderToPdf(`
          <div style="width: 750px; height: 1050px; background: #020617; color: white; padding: 120px 100px; font-family: ${fontStack}; display: flex; flex-direction: column; justify-content: space-between; position: relative; border: 25px solid #0f172a;">
              <div>
                  <p style="text-transform: uppercase; letter-spacing: 0.6em; font-size: 14px; font-weight: 900; color: #818cf8; margin-bottom: 25px;">${t.frontHeader}</p>
                  <h1 style="font-size: 64px; font-weight: 900; margin: 0; line-height: 1.1; text-transform: uppercase; letter-spacing: -0.02em;">${channel.title}</h1>
                  <div style="width: 120px; height: 10px; background: #6366f1; margin-top: 45px; border-radius: 5px;"></div>
              </div>
              <div style="display: flex; align-items: flex-end; justify-content: space-between;">
                  <div>
                      <p style="text-transform: uppercase; letter-spacing: 0.2em; font-size: 12px; color: #64748b; font-weight: 900; margin-bottom: 5px;">${t.compiledBy}</p>
                      <p style="font-size: 32px; font-weight: 900; margin: 0; color: #fff;">@${channel.author}</p>
                  </div>
                  <div style="text-align: right;">
                      <p style="font-size: 10px; color: #475569; font-mono: true;">TRACE ID: ${sessionHash}</p>
                  </div>
              </div>
          </div>
        `, false);

        for (let cIdx = 0; cIdx < chapters.length; cIdx++) {
            const ch = chapters[cIdx];
            progressFn(language === 'zh' ? `正在绑定节点 ${cIdx + 1}...` : `Binding Node ${cIdx + 1}...`);
            logFn(`Processing Book Section ${cIdx + 1}: ${ch.title}`, 'info');
            
            const summary = await generateChapterSummary(ch, language);
            
            await renderToPdf(`
              <div style="width: 750px; height: 1050px; background: #1e293b; color: white; padding: 80px 100px; font-family: ${fontStack}; display: flex; flex-direction: column; justify-content: center; position: relative;">
                  <p style="font-size: 14px; font-weight: 900; color: #818cf8; text-transform: uppercase; letter-spacing: 0.6em; margin-bottom: 25px;">${t.sectorPrefix} 0${cIdx + 1}</p>
                  <h1 style="font-size: 56px; font-weight: 900; text-transform: uppercase; margin: 0; line-height: 1.1; max-width: 550px;">${ch.title}</h1>
                  <div style="width: 80px; height: 5px; background: #6366f1; margin-top: 45px; margin-bottom: 60px;"></div>
                  <div style="max-width: 550px; font-size: 20px; color: #cbd5e1; line-height: 1.8; background: rgba(255,255,255,0.05); padding: 45px; border-radius: 32px; border: 1px solid rgba(255,255,255,0.1); font-style: italic;">
                      "${summary}"
                  </div>
              </div>
            `);

            const maxLinesPerPage = 36;
            let currentLines = 0;
            let currentPageHtml = "";

            for (const sub of ch.subTopics) {
                const lecture = await hydrateFn(sub);
                if (lecture) {
                    const subHeader = `<h2 style="font-size: 18px; font-weight: 900; color: #6366f1; margin-top: 40px; margin-bottom: 20px; text-transform: uppercase; border-bottom: 2px solid #f1f5f9; padding-bottom: 8px;">${sub.title}</h2>`;
                    currentPageHtml += subHeader;
                    currentLines += 4;

                    for (const s of lecture.sections) {
                        const isTeacher = s.speaker === 'Teacher';
                        const speakerName = isTeacher ? (lecture.professorName || (language === 'zh' ? '主持人' : 'Host')) : (lecture.studentName || (language === 'zh' ? '学生' : 'Student'));
                        const textLines = Math.ceil(s.text.length / (language === 'zh' ? 45 : 90)) + 1;

                        if (currentLines + textLines > maxLinesPerPage) {
                            await renderToPdf(wrapContent(currentPageHtml, ch.title, sessionHash, pageCounter, language));
                            currentPageHtml = "";
                            currentLines = 0;
                        }

                        const cleanText = renderMathInHtml(s.text);

                        currentPageHtml += `
                          <div style="margin-bottom: 18px; font-family: ${fontStack}; font-size: 13px; line-height: 1.6; color: #334155;">
                              <span style="font-weight: 900; color: ${isTeacher ? '#4338ca' : '#475569'}; text-transform: uppercase; margin-right: 8px; font-size: 11px;">${speakerName}:</span>
                              <span>${cleanText}</span>
                          </div>
                        `;
                        currentLines += textLines + 1;
                    }
                }
            }
            if (currentPageHtml) { await renderToPdf(wrapContent(currentPageHtml, ch.title, sessionHash, pageCounter, language)); }
        }

        progressFn(language === 'zh' ? "正在绑定封底..." : "Binding Back Cover...");
        const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(window.location.origin + '?channelId=' + channel.id)}`;
        const barcodeUrl = `https://barcodeapi.org/api/128/NP-${sessionHash}`;

        await renderToPdf(`
          <div style="width: 750px; height: 1050px; background-color: #020617; color: #ffffff; font-family: ${fontStack}; display: flex; flex-direction: column; justify-content: space-between; overflow: hidden; position: relative; border: 25px solid #0f172a;">
              <div style="position: absolute; top: -100px; right: -100px; width: 400px; height: 400px; background: radial-gradient(circle, rgba(99, 102, 241, 0.2) 0%, transparent 70%);"></div>
              
              <div style="padding: 120px 100px;">
                  <div style="width: 60px; height: 6px; background: #6366f1; margin-bottom: 30px; border-radius: 3px;"></div>
                  <h2 style="font-size: 42px; font-weight: 900; letter-spacing: -0.03em; text-transform: uppercase; italic: true;">${t.artifactTitle}</h2>
                  <p style="font-size: 20px; color: #94a3b8; max-width: 550px; line-height: 1.8; margin-top: 30px;">
                      ${t.artifactDesc}
                  </p>
              </div>

              <div style="padding: 80px 100px; background-color: #ffffff; color: #020617; display: flex; justify-content: space-between; align-items: flex-end;">
                  <div style="text-align: left;">
                      <p style="font-size: 14px; font-weight: 900; color: #6366f1; text-transform: uppercase; letter-spacing: 0.3em; margin-bottom: 15px;">${t.registryTitle}</p>
                      <p style="font-size: 22px; font-weight: 900; margin: 0;">${t.publishingLabel}</p>
                      <p style="font-size: 14px; font-weight: 700; color: #64748b; margin-top: 5px; font-mono: true;">REF_ID: ${sessionHash}</p>
                      <p style="font-size: 12px; font-weight: 600; color: #94a3b8; margin-top: 20px;">${t.tagline}</p>
                  </div>
                  <div style="text-align: right; display: flex; flex-direction: column; align-items: flex-end;">
                      <img src="${qrCodeUrl}" style="width: 100px; height: 100px; margin-bottom: 20px; border: 4px solid #f1f5f9; padding: 5px;" />
                      <img src="${barcodeUrl}" style="height: 50px; margin-bottom: 10px; width: 150px;" />
                      <p style="font-size: 10px; font-weight: bold; color: #000; letter-spacing: 0.2em; margin: 0;">${t.verifiedBinding}</p>
                  </div>
              </div>
          </div>
        `);

        document.body.removeChild(captureContainer);
        pdf.save(`${channel.title.replace(/\s+/g, '_')}_Neural_Artifact.pdf`);
        logFn(language === 'zh' ? "书籍已发送至本地驱动器。" : "Book Dispatched to Local Drive.", "success");
    } catch (e: any) { 
        logFn(`Book failure: ${e.message}`, 'error'); 
        throw e;
    }
}
