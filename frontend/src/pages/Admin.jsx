import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Globe, AlertTriangle, BarChart3 } from 'lucide-react';
import AdminMatchQuestionnaire from './AdminMatchQuestionnaire';
import AdminSiteSettings from './AdminSiteSettings';
import AdminEmailExceptions from './AdminEmailExceptions';
import AdminMatchData from './AdminMatchData';

function Admin() {
  const [activeTab, setActiveTab] = useState('site');

  return (
    <div className="min-h-screen bg-slate-50/50 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto flex flex-col items-center mb-6">
        {/* Tab Switcher */}
        <div className="inline-flex p-1.5 bg-white/80 backdrop-blur-md rounded-2xl shadow-sm border border-slate-200/60 relative">
          <button
            onClick={() => setActiveTab('site')}
            className={`relative px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all duration-300 z-10 ${
              activeTab === 'site' ? 'text-emerald-700' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50/50'
            }`}
          >
            {activeTab === 'site' && (
              <motion.div
                layoutId="admin-tab-bg"
                className="absolute inset-0 bg-emerald-50/80 rounded-xl"
                initial={false}
                transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
              />
            )}
            <Globe className="w-5 h-5 relative z-10" />
            <span className="relative z-10">站点配置</span>
          </button>

          <button
            onClick={() => setActiveTab('match_data')}
            className={`relative px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all duration-300 z-10 ${
              activeTab === 'match_data' ? 'text-violet-700' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50/50'
            }`}
          >
            {activeTab === 'match_data' && (
              <motion.div
                layoutId="admin-tab-bg"
                className="absolute inset-0 bg-violet-50/90 rounded-xl"
                initial={false}
                transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
              />
            )}
            <BarChart3 className="w-5 h-5 relative z-10" />
            <span className="relative z-10">匹配数据模块</span>
          </button>

          <button
            onClick={() => setActiveTab('match_questionnaire')}
            className={`relative px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all duration-300 z-10 ${
              activeTab === 'match_questionnaire' ? 'text-rose-700' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50/50'
            }`}
          >
            {activeTab === 'match_questionnaire' && (
              <motion.div
                layoutId="admin-tab-bg"
                className="absolute inset-0 bg-rose-50/90 rounded-xl"
                initial={false}
                transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
              />
            )}
            <span className="relative z-10">匹配问卷配置中心</span>
          </button>

          <button
            onClick={() => setActiveTab('email_exception')}
            className={`relative px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all duration-300 z-10 ${
              activeTab === 'email_exception' ? 'text-rose-700' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50/50'
            }`}
          >
            {activeTab === 'email_exception' && (
              <motion.div
                layoutId="admin-tab-bg"
                className="absolute inset-0 bg-rose-50/90 rounded-xl"
                initial={false}
                transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
              />
            )}
            <AlertTriangle className="w-5 h-5 relative z-10" />
            <span className="relative z-10">异常邮箱审核</span>
          </button>
        </div>
      </div>

      <div className="w-full">
        <AnimatePresence mode="wait">
          {activeTab === 'site' && (
            <motion.div
              key="site"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <AdminSiteSettings />
            </motion.div>
          )}
          {activeTab === 'match_questionnaire' && (
            <motion.div
              key="match_questionnaire"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <AdminMatchQuestionnaire />
            </motion.div>
          )}
          {activeTab === 'match_data' && (
            <motion.div
              key="match_data"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <AdminMatchData />
            </motion.div>
          )}

          {activeTab === 'email_exception' && (
            <motion.div
              key="email_exception"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <AdminEmailExceptions />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default Admin;
