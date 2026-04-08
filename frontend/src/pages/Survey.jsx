import React from 'react';
import { useSearchParams } from 'react-router-dom';
import LoveMatchQuestionnaire from './LoveMatchQuestionnaire';
import FriendMatchQuestionnaire from './FriendMatchQuestionnaire';
import SakuraPetalsOverlay from '../components/SakuraPetalsOverlay';

function Survey() {
  const [searchParams] = useSearchParams();
  const type = (searchParams.get('type') || 'love').toLowerCase();

  if (type === 'friend') {
    return <FriendMatchQuestionnaire />;
  }

  if (type === 'buddy') {
    return (
      <div className="relative min-h-screen bg-pagePink flex items-center justify-center p-6 font-xihei overflow-hidden">
        <SakuraPetalsOverlay baseCount={22} />
        <div className="absolute inset-0 z-[1] bg-[rgba(241,228,232,0.1)] pointer-events-none" aria-hidden />
        <div className="relative z-10 bg-cardIvory rounded-3xl border border-roseTint/60 shadow-sm p-10 max-w-md text-center">
          <h2 className="text-xl font-bold text-[#1a1a2e] mb-3 font-ysong">搭子匹配</h2>
          <p className="font-shsans font-light text-[#4a4a5e] leading-relaxed">敬请期待</p>
        </div>
      </div>
    );
  }

  return <LoveMatchQuestionnaire />;
}

export default Survey;
