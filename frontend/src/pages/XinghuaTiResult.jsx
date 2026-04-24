import React, { useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import SakuraPetalsOverlay from '../components/SakuraPetalsOverlay';
import { XINGHUA_TI_STORAGE_KEY, XINGHUA_TI_TYPE_COPY } from '../constants/xinghuaTi';

/** 公众号二维码：将后台下载的 PNG 放到 public/wechat-official-qrcode.png 会优先使用，否则用 SVG 占位 */
const WECHAT_QR_SRC_PNG = '/wechat-official-qrcode.png';
const WECHAT_QR_SRC_SVG = '/wechat-official-qrcode.svg';

function waitForImagesInNode(node) {
  if (!node) return Promise.resolve();
  const imgs = node.querySelectorAll('img');
  const tasks = [...imgs].map(
    (img) =>
      new Promise((resolve) => {
        if (img.complete && img.naturalWidth > 0) {
          resolve();
          return;
        }
        const done = () => resolve();
        img.addEventListener('load', done, { once: true });
        img.addEventListener('error', done, { once: true });
      })
  );
  return Promise.all(tasks);
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function safeReadResult() {
  try {
    const raw = window.localStorage.getItem(XINGHUA_TI_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    const type = parsed?.result?.type;
    const answers = parsed?.answers;
    if (typeof type === 'string' && type.length >= 3) {
      return { type, answers: answers && typeof answers === 'object' ? answers : null };
    }
  } catch {
    // ignore
  }
  return { type: null, answers: null };
}

export default function XinghuaTiResult() {
  const navigate = useNavigate();
  const cardRef = useRef(null);

  const { type } = useMemo(() => safeReadResult(), []);
  const copy = type ? XINGHUA_TI_TYPE_COPY[type] : null;

  const title = copy?.title || '南岭杏花ti结果';

  const handleSaveImage = async () => {
    const node = cardRef.current;
    if (!node) return;
    try {
      await waitForImagesInNode(node);
      const mod = await import('html2canvas');
      const html2canvas = mod.default || mod;
      const canvas = await html2canvas(node, {
        useCORS: true,
        allowTaint: false,
        backgroundColor: '#f5eae7',
        scale: 2,
        logging: false
      });
      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error('生成图片失败'))),
          'image/png',
          1
        );
      });
      const fileName = `南岭杏花ti-${type || 'result'}.png`;

      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        try {
          const file = new File([blob], fileName, { type: 'image/png' });
          if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
            await navigator.share({
              files: [file],
              title: '南岭杏花ti结果',
              text: '保存到相册或分享给好友'
            });
            toast.success('已打开系统分享，请选择「存储到照片」或保存到文件');
            return;
          }
        } catch (shareErr) {
          if (shareErr && shareErr.name === 'AbortError') {
            return;
          }
          // 继续走下载/预览兜底
        }
      }

      try {
        downloadBlob(blob, fileName);
        toast.success('已保存；若相册里没有，请到「下载」文件夹查找，或再点一次用系统分享保存到相册');
      } catch {
        const url = URL.createObjectURL(blob);
        const w = window.open(url, '_blank', 'noopener,noreferrer');
        if (w) {
          toast.success('已打开图片新窗口，请长按图片选择「存储到照片」');
          setTimeout(() => URL.revokeObjectURL(url), 120000);
        } else {
          URL.revokeObjectURL(url);
          toast.error('无法保存：请允许弹窗，或使用手机截图');
        }
      }
    } catch (e) {
      console.error('save xinghua result image failed', e);
      toast.error('保存失败，请稍后再试');
    }
  };

  if (!type) {
    return (
      <div className="min-h-screen bg-pagePink flex items-center justify-center p-6">
        <div className="bg-cardIvory rounded-3xl border border-roseTint/60 p-8 max-w-md w-full text-center">
          <p className="text-[#1a1a2e] font-bold text-lg font-ysong">还没有测验结果</p>
          <p className="mt-2 text-sm text-[#4a4a5e] font-shsans">先完成「来测你的南岭杏花ti」，我们会马上生成结果卡片。</p>
          <button
            type="button"
            onClick={() => navigate('/xinghua-ti', { replace: true })}
            className="mt-6 w-full py-3 rounded-full bg-ctaRose hover:bg-ctaRoseHover text-white font-bold transition"
          >
            去测验
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-pagePink font-xihei text-slate-900 overflow-hidden py-8 px-3 sm:px-6">
      <SakuraPetalsOverlay baseCount={36} />
      <div className="pointer-events-none fixed inset-0 z-[1] bg-[rgba(241,228,232,0.12)]" aria-hidden />

      <motion.div initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="relative z-10 max-w-3xl mx-auto">
        <div ref={cardRef} className="bg-cardIvory rounded-[2.25rem] border border-roseTint/60 shadow-sm p-7 sm:p-10">
          <div className="text-center">
            <p className="text-base sm:text-lg text-[#7a7278] font-shsans font-semibold tracking-wide">
              您的南岭杏花ti是
            </p>

            <div className="mt-3 max-w-[94%] mx-auto">
              <h1 className="text-5xl sm:text-6xl md:text-7xl font-black text-[#1a1a2e] font-ysong tracking-[0.05em] leading-[1.18] pb-1 sm:pb-2">
                {title}
              </h1>
            </div>

            <div className="mt-8 sm:mt-10 flex items-center justify-center gap-4" aria-hidden>
              <div className="h-px flex-1 max-w-[120px] bg-roseTint/30" />
              <div className="inline-flex items-center px-6 py-2 rounded-full bg-[#f9eff2] border border-roseTint/45 text-[#9b2148] font-black font-shsans tracking-wide shadow-sm">
                {type}
              </div>
              <div className="h-px flex-1 max-w-[120px] bg-roseTint/30" />
            </div>

            <div className="mt-4 text-xs sm:text-sm text-[#4a4a5e] font-shsans leading-relaxed max-w-2xl mx-auto">
              <p>S/M（爽玩南岭 / 摸鱼大鹅）｜P/Y（必须出片 / 悠哉小生）</p>
              <p>L/A（唠嗑能手 / 安静挂机）｜F/Z（看完约饭 / 看完蒸发）</p>
            </div>
          </div>

          <div className="mt-8 space-y-6">
            <div className="p-6 bg-white/80 rounded-[1.5rem] border border-roseTint/40">
              <p className="text-[#1a1a2e] font-bold font-shsans mb-2">一句话总结</p>
              <p className="text-[#4a4a5e] font-shsans leading-relaxed">{copy?.summary || '—'}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-6 bg-white/80 rounded-[1.5rem] border border-roseTint/40">
                <p className="text-[#1a1a2e] font-bold font-shsans mb-3">你在南岭最需要的不是</p>
                <div className="space-y-2">
                  {(copy?.notNeed || []).map((t) => (
                    <div key={t} className="text-[#4a4a5e] font-shsans">• {t}</div>
                  ))}
                </div>
              </div>
              <div className="p-6 bg-white/80 rounded-[1.5rem] border border-roseTint/40">
                <p className="text-[#1a1a2e] font-bold font-shsans mb-3">你真正需要的是</p>
                <div className="space-y-2">
                  {(copy?.need || []).map((t) => (
                    <div key={t} className="text-[#4a4a5e] font-shsans">• {t}</div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-6 bg-white/80 rounded-[1.5rem] border border-roseTint/40">
              <p className="text-[#1a1a2e] font-bold font-shsans mb-2">危险行为</p>
              <p className="text-[#4a4a5e] font-shsans leading-relaxed">{copy?.danger || '—'}</p>
            </div>

            <div className="mt-8 pt-6 border-t border-roseTint/35 flex flex-col sm:flex-row items-center justify-center gap-5 sm:gap-8">
              <img
                src={WECHAT_QR_SRC_PNG}
                alt="JLUDate 微信公众号二维码"
                width={112}
                height={112}
                className="w-[100px] h-[100px] sm:w-[112px] sm:h-[112px] object-contain rounded-xl border border-roseTint/40 bg-white shadow-sm shrink-0"
                onError={(e) => {
                  const el = e.currentTarget;
                  if (el.dataset.fallback === '1') return;
                  el.dataset.fallback = '1';
                  el.src = WECHAT_QR_SRC_SVG;
                }}
              />
              <div className="text-center sm:text-left space-y-2 max-w-md">
                <p className="text-sm font-bold text-[#1a1a2e] font-shsans">关注公众号 · 获取活动与匹配动态</p>
                <p className="text-xs sm:text-sm text-[#4a4a5e] font-shsans leading-relaxed">
                  浏览器搜索{' '}
                  <span className="font-black text-szured tracking-wide">jludate.com</span>
                  {' '}参与校园公益匹配与杏花节活动
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={handleSaveImage}
            className="py-3 rounded-full border-2 border-roseTint/45 bg-white hover:bg-roseLight/35 text-[#4a4a5e] font-bold transition"
          >
            保存结果图片
          </button>
          <button
            type="button"
            onClick={() => navigate('/xinghua-ti')}
            className="py-3 rounded-full border-2 border-roseTint/45 bg-white hover:bg-roseLight/35 text-[#4a4a5e] font-bold transition"
          >
            修改南岭杏花ti问卷
          </button>
        </div>
      </motion.div>
    </div>
  );
}

