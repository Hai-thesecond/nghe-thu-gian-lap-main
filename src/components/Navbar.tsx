import React from 'react';
import { Link } from 'react-router-dom';

const Navbar: React.FC = () => {
  return (
    <nav className="bg-white p-2">
      <div className="container mx-auto flex items-center justify-between">
        <div className="flex items-center">
          <Link
            to="/"
            className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md transition-colors duration-300"
          >
            Home
          </Link>
          <Link
            to="/about"
            className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md transition-colors duration-300"
          >
            Giới thiệu
          </Link>
          <Link
            to="/connection-test"
            className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md transition-colors duration-300"
          >
            Kiểm tra kết nối
          </Link>
        </div>
      </div>
    </nav>
  );
};

export default Navbar; 