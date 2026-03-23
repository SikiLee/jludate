import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutTemplate, Settings2, Globe } from 'lucide-react';
import AdminRoseTypes from './AdminRoseTypes';
import AdminSurveyQuestions from './AdminSurveyQuestions';
import AdminSiteSettings from './AdminSiteSettings';

function Admin() {
  const [activeTab, setActiveTab] = useState('rose');

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
            onClick={() => setActiveTab('rose')}
            className={`relative px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all duration-300 z-10 ${
              activeTab === 'rose' ? 'text-indigo-700' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50/50'
            }`}
          >
            {activeTab === 'rose' && (
              <motion.div
                layoutId="admin-tab-bg"
                className="absolute inset-0 bg-indigo-50/80 rounded-xl"
                initial={false}
                transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
              />
            )}
            <LayoutTemplate className="w-5 h-5 relative z-10" />
            <span className="relative z-10">ROSE 解读管理</span>
          </button>
          
          <button
            onClick={() => setActiveTab('survey')}
            className={`relative px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all duration-300 z-10 ${
              activeTab === 'survey' ? 'text-violet-700' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50/50'
            }`}
          >
            {activeTab === 'survey' && (
              <motion.div
                layoutId="admin-tab-bg"
                className="absolute inset-0 bg-violet-50/80 rounded-xl"
                initial={false}
                transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
              />
            )}
            <Settings2 className="w-5 h-5 relative z-10" />
            <span className="relative z-10">问卷题目配置</span>
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
          {activeTab === 'rose' && (
            <motion.div
              key="rose"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <AdminRoseTypes />
            </motion.div>
          )}
          {activeTab === 'survey' && (
            <motion.div
              key="survey"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <AdminSurveyQuestions />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default Admin;
