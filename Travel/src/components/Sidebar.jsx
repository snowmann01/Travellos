import React from 'react';
import { Link } from 'react-router-dom';
import {
  FaHome,
  FaMapMarkedAlt,
  FaShareAlt,
  FaUsers,
  FaCamera,
  FaLeaf,
  FaTrophy,
  FaUserCircle,
  FaRoute,
} from 'react-icons/fa';

const Sidebar = () => {
  return (
    <div className="w-1/5 min-h-screen bg-gradient-to-b from-[#49c6e5] to-[#54defd] p-6 flex flex-col justify-between">
      <div>
        <div className="flex items-center mb-6">
          <Link
            to="/"
            className="text-white flex items-center text-2xl font-bold hover:text-gray-200"
          >
            <FaHome className="mr-5" /> travello
          </Link>
        </div>
        <div className="space-y-4">
          <Link
            to="/hidden-attraction-maps"
            className="text-white text-lg font-semibold hover:bg-[#00bd9d] p-3 rounded-md flex items-center transition ease-in-out duration-300"
          >
            <FaMapMarkedAlt className="mr-3" /> Hidden Attractions
          </Link>
          <Link
            to="/socials"
            className="text-white text-lg font-semibold hover:bg-[#00bd9d] p-3 rounded-md flex items-center transition ease-in-out duration-300"
          >
            <FaShareAlt className="mr-3" /> Link your Socials
          </Link>
          <Link
            to="/leaderboard"
            className="text-white text-lg font-semibold hover:bg-[#00bd9d] p-3 rounded-md flex items-center transition ease-in-out duration-300"
          >
            <FaUsers className="mr-3" /> Leaderboard
          </Link>
          <Link
            to="/quests"
            className="text-white text-lg font-semibold hover:bg-[#00bd9d] p-3 rounded-md flex items-center transition ease-in-out duration-300"
          >
            <FaCamera className="mr-3" /> My Quests
          </Link>
          <Link
            to="/itinerary"
            className="text-white text-lg font-semibold hover:bg-[#00bd9d] p-3 rounded-md flex items-center transition ease-in-out duration-300"
          >
            <FaRoute className="mr-3" /> My Itinerary
          </Link>
          <Link
            to="/my-badges"
            className="text-white text-lg font-semibold hover:bg-[#00bd9d] p-3 rounded-md flex items-center transition ease-in-out duration-300"
          >
            <FaTrophy className="mr-3" /> My Badges
          </Link>
          <Link
            to="/Challenge"
            className="text-white text-lg font-semibold hover:bg-[#00bd9d] p-3 rounded-md flex items-center transition ease-in-out duration-300"
          >
            <FaTrophy className="mr-3" /> My Challenges
          </Link>
          <Link
            to="/local"
            className="text-white text-lg font-semibold hover:bg-[#00bd9d] p-3 rounded-md flex items-center transition ease-in-out duration-300"
          >
            <FaLeaf className="mr-3" /> Local Immersion
          </Link>
          <Link
            to="/eco-friendly"
            className="text-white text-lg font-semibold hover:bg-[#00bd9d] p-3 rounded-md flex items-center transition ease-in-out duration-300"
          >
            <FaLeaf className="mr-3" /> Let's Go Green
          </Link>
          <Link
            to="/sdg"
            className="text-white text-lg font-semibold hover:bg-[#00bd9d] p-3 rounded-md flex items-center transition ease-in-out duration-300"
          >
            <FaLeaf className="mr-3" /> Our Social Development Goals
          </Link>
        </div>
      </div>
      <Link
        to="/profile"
        className="text-white flex items-center text-xl font-bold hover:text-gray-300"
      >
        <FaUserCircle className="mr-3" /> My Profile
      </Link>
    </div>
  );
};

export default Sidebar;
