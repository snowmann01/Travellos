import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import GlobeScene from './GlobeScene';
import { useAuth } from '../context/authContext.jsx';
import {
  FaMapMarkedAlt,
  FaCamera,
  FaTrophy,
  FaShareAlt,
  FaLeaf,
  FaRecycle,
  FaSeedling,
  FaRoute,
  FaUserCircle,
  FaChevronRight,
  FaGlobeAmericas,
  FaHome,
} from 'react-icons/fa';

const ITINERARY_BUILDER_URL =
  'https://iti-gen-47hm-git-main-arushs-projects-de106c3b.vercel.app/';

const glassPanel =
  'rounded-2xl border border-white/25 bg-white/10 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.25)]';

const PanelLink = ({ to, href, icon, title, description, external }) => {
  const className =
    'group flex items-start gap-3 rounded-xl p-3 transition hover:bg-white/10 border border-transparent hover:border-white/15';
  const content = (
    <>
      <span className="mt-0.5 text-cyan-200 opacity-90 group-hover:opacity-100">{icon}</span>
      <span className="min-w-0 flex-1 text-left">
        <span className="flex items-center gap-1 font-semibold text-white">
          {title}
          <FaChevronRight className="h-3 w-3 opacity-0 transition group-hover:opacity-100" />
        </span>
        {description && (
          <span className="mt-0.5 block text-xs leading-snug text-cyan-100/75">{description}</span>
        )}
      </span>
    </>
  );

  if (href || external) {
    return (
      <a href={href || to} target="_blank" rel="noopener noreferrer" className={className}>
        {content}
      </a>
    );
  }
  return (
    <Link to={to} className={className}>
      {content}
    </Link>
  );
};

const Dashboard = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState({
    firstName: '',
    lastName: '',
    email: '',
    country: '',
  });
  const [badgeCount, setBadgeCount] = useState(null);

  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const { data } = await axios.get('/api/user/profile', { withCredentials: true });
        setProfile({
          firstName: data.firstName || '',
          lastName: data.lastName || '',
          email: data.email || '',
          country: data.country || '',
        });
      } catch {
        /* profile API optional when not logged in / CORS */
      }
    };

    const fetchBadges = async () => {
      try {
        const { data } = await axios.get('/api/user/badges', { withCredentials: true });
        setBadgeCount(Array.isArray(data) ? data.length : 0);
      } catch {
        setBadgeCount(null);
      }
    };

    fetchUserProfile();
    fetchBadges();
  }, []);

  const displayName =
    [profile.firstName, profile.lastName].filter(Boolean).join(' ') ||
    user?.email?.split('@')[0] ||
    'Traveler';
  const displayEmail = profile.email || user?.email || '';

  const leftFeatures = [
    {
      title: 'Hidden Attractions',
      description: 'Maps and tips for secret spots near you.',
      to: '/hidden-attraction-maps',
      icon: <FaMapMarkedAlt className="h-5 w-5" />,
    },
    {
      title: 'Challenges & Quests',
      description: 'Photo challenges and rewards.',
      to: '/Challenge',
      icon: <FaCamera className="h-5 w-5" />,
    },
    {
      title: 'Achievements',
      description: 'Badges, levels, and milestones.',
      to: '/my-badges',
      icon: <FaTrophy className="h-5 w-5" />,
    },
    {
      title: 'Dynamic itinerary',
      description: 'AI-powered trip planning (external builder).',
      href: ITINERARY_BUILDER_URL,
      external: true,
      icon: <FaRoute className="h-5 w-5" />,
    },
    {
      title: 'My Quests',
      description: 'Track active quests.',
      to: '/quests',
      icon: <FaGlobeAmericas className="h-5 w-5" />,
    },
  ];

  const rightFeatures = [
    {
      title: 'Social integration',
      description: 'Link social accounts and share trips.',
      to: '/socials',
      icon: <FaShareAlt className="h-5 w-5" />,
    },
    {
      title: 'Eco-friendly travel',
      description: 'Greener choices and local impact.',
      to: '/eco-friendly',
      icon: <FaSeedling className="h-5 w-5" />,
    },
    {
      title: 'Green points & carbon',
      description: 'Points, footprint, and eco insights.',
      to: '/green-points-system',
      icon: <FaRecycle className="h-5 w-5" />,
    },
    {
      title: 'Leaderboard',
      description: 'See top explorers.',
      to: '/leaderboard',
      icon: <FaTrophy className="h-5 w-5" />,
    },
    {
      title: 'Offline mode',
      description: 'Download guides for no-signal areas.',
      to: '/offline-mode',
      icon: <FaLeaf className="h-5 w-5" />,
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-cyan-950/80 to-slate-900">
      <div className="relative flex min-h-screen flex-col overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            background:
              'radial-gradient(ellipse 80% 60% at 50% 40%, rgba(34,211,238,0.15), transparent 55%)',
          }}
        />

        <header className="relative z-20 flex items-center justify-between border-b border-white/10 bg-black/20 px-4 py-3 backdrop-blur-md lg:px-6">
          <Link
            to="/"
            className="flex items-center gap-2 text-lg font-bold tracking-tight text-white transition hover:text-cyan-200"
          >
            <FaHome className="h-5 w-5 text-cyan-300" />
            travello
          </Link>
        </header>

        <div className="relative z-10 flex flex-1 flex-col gap-4 p-4 lg:flex-row lg:gap-5 lg:p-6">
          {/* Left glass panel */}
          <aside
            className={`order-2 flex w-full shrink-0 flex-col lg:order-1 lg:w-[min(100%,320px)] ${glassPanel}`}
          >
            <h2 className="mb-1 text-lg font-bold tracking-tight text-white">Explore</h2>
            <p className="mb-4 text-xs text-cyan-100/70">Discovery, quests, and your itinerary</p>
            <nav className="flex flex-col gap-1 overflow-y-auto pr-1 lg:max-h-[calc(100vh-8rem)]">
              {leftFeatures.map((f) => (
                <PanelLink key={f.title} {...f} />
              ))}
            </nav>
          </aside>

          {/* Center: globe */}
          <section className="order-1 flex min-h-[42vh] flex-1 flex-col lg:order-2 lg:min-h-0">
            <div className="mb-3 text-center lg:text-left">
              <h1 className="bg-gradient-to-r from-cyan-200 to-teal-200 bg-clip-text text-2xl font-bold text-transparent sm:text-3xl">
                Welcome back, {displayName}
              </h1>
              <p className="mt-1 text-sm text-cyan-100/80">
                Spin the globe — pick a feature from the panels to continue your journey.
              </p>
            </div>
            <div className="relative flex flex-1 min-h-[320px]">
              <GlobeScene />
            </div>
          </section>

          {/* Right glass panel */}
          <aside
            className={`order-3 flex w-full shrink-0 flex-col lg:w-[min(100%,320px)] ${glassPanel}`}
          >
            <h2 className="mb-1 text-lg font-bold tracking-tight text-white">Your travel hub</h2>
            <p className="mb-4 text-xs text-cyan-100/70">Profile, rewards, and social eco tools</p>

            <div className="mb-4 rounded-xl border border-white/20 bg-black/20 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 to-teal-600 text-lg font-bold text-white shadow-lg">
                  {displayName.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-white">{displayName}</p>
                  {displayEmail && (
                    <p className="truncate text-xs text-cyan-100/70">{displayEmail}</p>
                  )}
                  {profile.country && (
                    <p className="text-xs text-cyan-200/80">{profile.country}</p>
                  )}
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-center">
                <div className="rounded-lg bg-white/5 py-2">
                  <p className="text-lg font-bold text-cyan-200">
                    {badgeCount === null ? '—' : badgeCount}
                  </p>
                  <p className="text-[10px] uppercase tracking-wide text-cyan-100/60">Badges</p>
                </div>
                <Link
                  to="/profile"
                  className="flex flex-col items-center justify-center rounded-lg bg-cyan-500/20 py-2 text-cyan-100 transition hover:bg-cyan-500/30"
                >
                  <FaUserCircle className="mb-0.5 h-5 w-5" />
                  <span className="text-[10px] font-medium uppercase tracking-wide">Profile</span>
                </Link>
              </div>
            </div>

            <nav className="flex flex-col gap-1 overflow-y-auto pr-1 lg:max-h-[calc(100vh-14rem)]">
              {rightFeatures.map((f) => (
                <PanelLink key={f.title} {...f} />
              ))}
            </nav>
          </aside>
        </div>

        <ToastContainer theme="dark" />
      </div>
    </div>
  );
};

export default Dashboard;
