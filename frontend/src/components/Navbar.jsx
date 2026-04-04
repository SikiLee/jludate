import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LogOut, ChevronDown } from 'lucide-react';
import { motion } from 'framer-motion';
import { clearAuthStorage, getAccessToken, getIsAdmin } from '../lib/storage';
import { useSiteConfig } from '../context/SiteConfigContext';

function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { siteConfig } = useSiteConfig();
  const [scrolled, setScrolled] = useState(false);
  const [roseMenuOpen, setRoseMenuOpen] = useState(false);
  const roseMenuRef = useRef(null);
  const [, setAuthVersion] = useState(0);
  const token = getAccessToken();
  const isAdmin = getIsAdmin();
  const brandName = siteConfig?.brand_name || '配吉友';

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const syncAuthState = () => {
      setAuthVersion((value) => value + 1);
    };

    window.addEventListener('campus-auth-changed', syncAuthState);
    window.addEventListener('storage', syncAuthState);
    window.addEventListener('focus', syncAuthState);
    window.addEventListener('pageshow', syncAuthState);
    return () => {
      window.removeEventListener('campus-auth-changed', syncAuthState);
      window.removeEventListener('storage', syncAuthState);
      window.removeEventListener('focus', syncAuthState);
      window.removeEventListener('pageshow', syncAuthState);
    };
  }, []);

  useEffect(() => {
    setAuthVersion((value) => value + 1);
  }, [location.pathname]);

  useEffect(() => {
    setRoseMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (!roseMenuRef.current) {
        return;
      }
      if (!roseMenuRef.current.contains(event.target)) {
        setRoseMenuOpen(false);
      }
    };

    window.addEventListener('mousedown', handleOutsideClick);
    window.addEventListener('touchstart', handleOutsideClick);
    return () => {
      window.removeEventListener('mousedown', handleOutsideClick);
      window.removeEventListener('touchstart', handleOutsideClick);
    };
  }, []);

  const handleLogout = () => {
    clearAuthStorage();
    navigate('/');
  };

  if (location.pathname === '/auth') {
    return null;
  }

  // The image design is transparent on the home page hero section until scrolled.
  const isHome = location.pathname === '/';
  const isTransparent = isHome && !scrolled;

  // 首屏透明导航：与主文案副标题统一为中灰 #4a4a5e，避免纯黑抢主标题对比
  const textColor = isTransparent ? 'text-[#4a4a5e] hover:text-[#3d3d50]' : 'text-slate-600 hover:text-slate-900';
  const logoColor = isTransparent ? 'text-[#4a4a5e]' : 'text-slate-900';
  const activeNavClass = isTransparent ? 'text-[#42425a] font-semibold' : 'text-slate-900 font-bold';
  const navBg = isTransparent 
    ? 'py-5 sm:py-6 bg-transparent' 
    : 'py-3 sm:py-4 bg-white/90 backdrop-blur-xl border-b border-slate-200/50 shadow-sm transition-all duration-300';
    
  const buttonClass = isTransparent
    ? 'bg-white/92 text-[#4a4a5e] hover:bg-white font-semibold shadow-[0_2px_14px_rgba(26,26,46,0.08)]'
    : 'bg-ctaRose text-white hover:bg-ctaRoseHover shadow-md shadow-[rgba(224,154,173,0.24)]';

  // Build the dynamic nav links (like Match, Survey, Admin) 
  // We'll keep them understated if the user is just browsing the transparent hero.
  const commonLinks = [];
  const authLinks = [];
  if (token) {
    authLinks.push({ path: '/match', label: '心动匹配' });
    if (isAdmin) {
      authLinks.push({ path: '/admin', label: '后台' });
    }
  }
  const isRoseMenuActive = location.pathname.startsWith('/survey') || location.pathname.startsWith('/rose');
  const roseMenuButtonClass = `text-sm sm:text-[15px] transition-colors tracking-wide inline-flex items-center gap-1 ${
    isRoseMenuActive ? activeNavClass : textColor
  }`;

  return (
    <motion.nav
      initial={{ y: -50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${navBg}`}
    >
      <div className="max-w-6xl mx-auto px-5 sm:px-8">
        <div className="flex items-center justify-between">
          {/* 品牌图标：public/brand-icon.png（换图后把 ?v= 数字 +1 可破缓存） */}
          <Link to="/" className="flex items-center gap-2.5 group">
            <div
              className={`p-1.5 rounded-lg shadow-sm flex items-center justify-center ${
                isTransparent ? 'bg-white/90' : 'bg-slate-50'
              }`}
            >
              <img
                src="/brand-icon.png?v=10"
                alt=""
                width={24}
                height={24}
                draggable={false}
                className="w-6 h-6 object-contain select-none"
              />
            </div>
            <span className={`text-[1.35rem] sm:text-2xl font-serif font-medium tracking-[0.03em] ${logoColor}`}>
              {brandName}
            </span>
          </Link>

          {/* Navigation Area matches the image layout: Link + Pill Button */}
          <div className="flex items-center gap-6 sm:gap-8">
            <Link to="/" className={`text-sm sm:text-[15px] font-medium tracking-wide transition-colors ${textColor}`}>
              首页
            </Link>

            {commonLinks.map((link) => {
              const isActive = location.pathname.startsWith(link.path);
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`text-sm sm:text-[15px] transition-colors tracking-wide ${
                    isActive ? activeNavClass : textColor
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}

            {/* <div className="relative" ref={roseMenuRef}>
              <button
                type="button"
                onClick={() => setRoseMenuOpen((prev) => !prev)}
                className={roseMenuButtonClass}
              >
                恋爱人格测试
                <ChevronDown className={`w-4 h-4 transition-transform ${roseMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {roseMenuOpen ? (
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-3 w-52 rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-200/60 p-2 z-50">
                  <Link
                    to="/survey?mode=test"
                    onClick={() => setRoseMenuOpen(false)}
                    className="block px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    ①开始恋爱人格测试
                  </Link>
                  <Link
                    to="/rose"
                    onClick={() => setRoseMenuOpen(false)}
                    className="block px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    ②查看恋爱人格结果
                  </Link>
                </div>
              ) : null}
            </div> */}

            {authLinks.map((link) => {
              const isActive = location.pathname.startsWith(link.path);
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`text-sm sm:text-[15px] transition-colors tracking-wide ${
                    isActive ? activeNavClass : textColor
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}

            {token ? (
              <button
                onClick={handleLogout}
                className={`flex items-center gap-1.5 px-5 py-2 sm:py-2.5 rounded-full text-sm sm:text-[15px] transition-transform transform hover:-translate-y-0.5 ${isTransparent ? '' : 'font-bold'} ${buttonClass}`}
              >
                退出 <LogOut className="w-3.5 h-3.5 ml-1 inline-block" />
              </button>
            ) : (
              <Link
                to="/auth"
                className={`flex items-center gap-1.5 px-6 py-2 sm:px-7 sm:py-2.5 rounded-full text-sm sm:text-[15px] transition-transform transform hover:-translate-y-0.5 tracking-wide ${isTransparent ? '' : 'font-bold'} ${buttonClass}`}
              >
                登录/注册
              </Link>
            )}
          </div>
        </div>
      </div>
    </motion.nav>
  );
}

export default Navbar;
