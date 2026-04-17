import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Clock4 } from 'lucide-react';
import SakuraPetalsOverlay from '../components/SakuraPetalsOverlay';

function Match() {
  const navigate = useNavigate();

  return (
    <div className="relative min-h-screen bg-pagePink flex items-center justify-center p-6 font-xihei overflow-hidden">
      <SakuraPetalsOverlay baseCount={28} />
      <div className="absolute inset-0 z-[1] bg-[rgba(241,228,232,0.12)] pointer-events-none" aria-hidden />

      <motion.div
        initial={{ y: 16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.55 }}
        className="relative z-10 w-full max-w-2xl"
      >
        <div className="bg-cardIvory rounded-[2.2rem] border border-roseTint/70 shadow-lg shadow-[rgba(26,26,46,0.10)] hover:shadow-xl transition-shadow p-8 sm:p-12 text-center overflow-hidden relative">
          <div className="absolute -top-24 -right-24 w-64 h-64 rounded-full bg-roseLight/60 blur-[40px]" aria-hidden />
          <div className="absolute -bottom-24 -left-24 w-64 h-64 rounded-full bg-roseTint/25 blur-[44px]" aria-hidden />

          <div className="mx-auto w-16 h-16 rounded-2xl bg-white/85 border border-roseTint/40 shadow-sm flex items-center justify-center mb-6">
            <Clock4 className="w-8 h-8 text-szured" />
          </div>

          <h2 className="text-2xl sm:text-3xl font-bold text-[#1a1a2e] mb-4 font-ysong tracking-wide">
            匹配结果
          </h2>

          <p className="text-base sm:text-lg font-shsans font-light text-[#4a4a5e] leading-relaxed">
            本周匹配将于周五晚八点开始，敬请期待
          </p>

          <div className="mt-10 flex justify-center">
            <button
              type="button"
              onClick={() => navigate('/survey')}
              className="group inline-flex items-center justify-center gap-2 w-full sm:w-auto min-w-[220px] px-8 py-3.5 rounded-full border border-roseTint/45 bg-white/80 hover:bg-roseLight/35 text-[#1a1a2e] font-bold font-shsans transition shadow-sm hover:shadow-md"
            >
              去参与其他匹配
              <ArrowRight className="w-4 h-4 text-szured group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default Match;
