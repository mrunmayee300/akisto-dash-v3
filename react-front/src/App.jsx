import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Login from './Login';
import Dashboard from './Dashboard';
import PODetail from './PODetail'; // Import the new PODetail component
import './style.css'; // Global styles

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Dashboard />} /> {/* Default route */}
      <Route path="/dashboard" element={<Dashboard />} />
      {/* Detail page route */}
      <Route path="/detail/:commsGroupId" element={<PODetail />} />
    </Routes>
  );
}

export default App;
