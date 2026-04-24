import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import SakuraPetalsOverlay from '../components/SakuraPetalsOverlay';

const ENTRY_BUTTON_CLASS =
  'px-8 py-4 bg-ctaRose text-white font-bold rounded-full hover:bg-ctaRoseHover transition-all shadow-[0_8px_24px_rgba(224,154,173,0.32)] transform hover:-translate-y-0.5 text-lg w-auto min-w-[220px] font-shsans';

function SurveyEntry() {
  const navigate = useNavigate();

  return (
    <div className="relative min-h-screen bg-pagePink font-xihei text-slate-900 overflow-hidden">
      <SakuraPetalsOverlay baseCount={36} />
      <div
        className="pointer-events-none absolute inset-0 z-[1]"
        aria-hidden
        style={{
          background: 'linear-gradient(180deg, rgba(241,228,232,0.14) 0%, transparent 45%, rgba(245,234,231,0.2) 100%)'
        }}
      />

      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        <motion.div
          initial={{ y: 24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.55 }}
          className="w-full max-w-md"
        >
          <div className="bg-cardIvory rounded-3xl border border-roseTint/60 shadow-sm hover:shadow-lg transition-shadow p-8 sm:p-10">
            <h2 className="text-2xl md:text-3xl font-bold text-[#1a1a2e] text-center mb-2 font-ysong tracking-wide">
              欢迎回来
            </h2>
            <p className="text-center text-xs sm:text-sm text-[#7a7278] font-shsans mb-6 leading-relaxed">
              匹配各自独立，可全都参加
            </p>
            <div className="flex flex-col items-center gap-4">
              <button
                type="button"
                className={ENTRY_BUTTON_CLASS}
                onClick={() => navigate('/survey/questionnaire?type=love')}
              >
                进入恋爱匹配
              </button>
              <button
                type="button"
                className={ENTRY_BUTTON_CLASS}
                onClick={() => navigate('/survey/questionnaire?type=friend')}
              >
                进入交友匹配
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export default SurveyEntry;
