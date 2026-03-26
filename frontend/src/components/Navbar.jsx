import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Mail, LogOut, ChevronDown } from 'lucide-react';
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
  const brandName = siteConfig?.brand_name || 'unidate';

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

  // Derive text/button styles based on background context
  const textColor = isTransparent ? 'text-white/90 hover:text-white' : 'text-slate-600 hover:text-slate-900';
  const logoColor = isTransparent ? 'text-white' : 'text-slate-900';
  const navBg = isTransparent 
    ? 'py-5 sm:py-6 bg-transparent' 
    : 'py-3 sm:py-4 bg-white/90 backdrop-blur-xl border-b border-slate-200/50 shadow-sm transition-all duration-300';
    
  const buttonClass = isTransparent
    ? 'bg-white text-slate-900 hover:bg-slate-100 shadow-[0_2px_15px_rgba(255,255,255,0.15)]'
    : 'bg-slate-900 text-white hover:bg-black shadow-md shadow-slate-900/20';

  // Build the dynamic nav links (like Match, Survey, Admin) 
  // We'll keep them understated if the user is just browsing the transparent hero.
  const commonLinks = [{ path: '/feedback', label: '反馈' }];
  const authLinks = [];
  if (token) {
    authLinks.push({ path: '/match', label: '心动匹配' });
    if (isAdmin) {
      authLinks.push({ path: '/admin', label: '后台' });
    }
  }
  const isRoseMenuActive = location.pathname.startsWith('/survey') || location.pathname.startsWith('/rose');
  const roseMenuButtonClass = `text-sm sm:text-[15px] transition-colors tracking-wide inline-flex items-center gap-1 ${
    isRoseMenuActive ? (isTransparent ? 'text-white font-bold' : 'text-slate-900 font-bold') : textColor
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
          {/* Logo Area matches the image: Envelope + Serif Font */}
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className={`p-1.5 rounded shadow-sm ${isTransparent ? 'bg-white/10 text-white' : 'bg-slate-50 text-slate-800'}`}>
              <Mail className="w-5 h-5 opacity-90" strokeWidth={1.5} />
            </div>
            <span className={`text-[1.35rem] sm:text-2xl font-serif font-medium tracking-[0.03em] ${logoColor}`}>
              {brandName}
            </span>
          </Link>

          {/* Navigation Area matches the image layout: Link + Pill Button */}
          <div className="flex items-center gap-6 sm:gap-8">
            <Link to="/" className={`text-sm sm:text-[15px] font-medium tracking-wide transition-colors ${textColor}`}>
              关于
            </Link>

            {commonLinks.map((link) => {
              const isActive = location.pathname.startsWith(link.path);
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`text-sm sm:text-[15px] transition-colors tracking-wide ${
                    isActive ? (isTransparent ? 'text-white font-bold' : 'text-slate-900 font-bold') : textColor
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}

            <div className="relative" ref={roseMenuRef}>
              <button
                type="button"
                onClick={() => setRoseMenuOpen((prev) => !prev)}
                className={roseMenuButtonClass}
              >
                ROSE恋爱人格
                <ChevronDown className={`w-4 h-4 transition-transform ${roseMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {roseMenuOpen ? (
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-3 w-52 rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-200/60 p-2 z-50">
                  <Link
                    to="/survey?mode=test"
                    onClick={() => setRoseMenuOpen(false)}
                    className="block px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    ①测试ROSE人格
                  </Link>
                  <Link
                    to="/rose"
                    onClick={() => setRoseMenuOpen(false)}
                    className="block px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    ②查看ROSE恋爱人格
                  </Link>
                </div>
              ) : null}
            </div>

            {authLinks.map((link) => {
              const isActive = location.pathname.startsWith(link.path);
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`text-sm sm:text-[15px] transition-colors tracking-wide ${
                    isActive ? (isTransparent ? 'text-white font-bold' : 'text-slate-900 font-bold') : textColor
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}

            {token ? (
              <button
                onClick={handleLogout}
                className={`flex items-center gap-1.5 px-5 py-2 sm:py-2.5 rounded-full text-sm sm:text-[15px] font-bold transition-transform transform hover:-translate-y-0.5 ${buttonClass}`}
              >
                退出 <LogOut className="w-3.5 h-3.5 ml-1 inline-block" />
              </button>
            ) : (
              <Link
                to="/auth"
                className={`flex items-center gap-1.5 px-6 py-2 sm:px-7 sm:py-2.5 rounded-full text-sm sm:text-[15px] font-bold transition-transform transform hover:-translate-y-0.5 tracking-wide ${buttonClass}`}
              >
                登录
              </Link>
            )}
          </div>
        </div>
      </div>
    </motion.nav>
  );
}

export default Navbar;
