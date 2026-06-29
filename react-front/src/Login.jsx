import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const API_URL = import.meta.env.VITE_APPS_SCRIPT_URL;

function Login() {
  const [step, setStep] = useState(1);
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmedCompany, setConfirmedCompany] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('sessionToken');
    if (token) {
      navigate('/dashboard');
    }
  }, [navigate]);

  const handleCheckCompany = async (event) => {
    event.preventDefault();
    setErrorMessage('');
    try {
      const response = await fetch(`${API_URL}?action=checkCompany&companyName=${encodeURIComponent(companyName)}`);
      const data = await response.json();

      if (data.success) {
        setConfirmedCompany(data.companyName);
        setStep(2);
      } else {
        setErrorMessage(data.message || 'Company not found.');
      }
    } catch (error) {
      console.error('Error checking company:', error);
      setErrorMessage('Failed to check company. Please try again.');
    }
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    setErrorMessage('');
    try {
      const response = await fetch(`${API_URL}?action=login&companyName=${encodeURIComponent(confirmedCompany)}&email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`);
      const data = await response.json();

      if (data.success) {
        localStorage.setItem('sessionToken', data.token);
        localStorage.setItem('userEmail', data.email);
        localStorage.setItem('companyName', data.companyName);
        localStorage.setItem('userName', data.userName || '');
        localStorage.setItem('userRole', data.userRole || '');
        navigate('/dashboard');
      } else {
        setErrorMessage(data.message || 'Login failed. Please check your credentials.');
      }
    } catch (error) {
      console.error('Error logging in:', error);
      setErrorMessage('Failed to log in. Please try again.');
    }
  };

  const handleChangeCompany = () => {
    setStep(1);
    setErrorMessage('');
    setPassword('');
  };

  return (
    <div className="fixed inset-0 w-full h-full flex items-center justify-center bg-canvas p-5 z-[1000] overflow-y-auto">
      <div className="w-full max-w-[440px]">
        <div className="bg-white border border-line rounded-[16px] py-[36px] px-[32px] shadow-[0_12px_40px_rgba(11,61,46,0.12)]">
          <div className="flex items-center gap-[13px] mb-[32px] justify-center">
            <span className="text-[23px] font-extrabold text-emerald tracking-[-0.5px]">
              akisto<span className="text-gold">.</span>
            </span>
            <span className="text-[14.5px] text-muted font-semibold border-l border-line pl-[13px]">
              Client Portal
            </span>
          </div>

          {errorMessage && (
            <div id="error-container" className="bg-redfill border border-[#E6CFC9] rounded-lg py-3 px-4 mb-6 text-[13.5px] text-red font-semibold leading-[1.4]">
              <span id="error-message">{errorMessage}</span>
            </div>
          )}

          {step === 1 && (
            <form id="step1-form" className="flex flex-col" onSubmit={handleCheckCompany}>
              <h2 className="text-[20px] font-extrabold text-[#393939] mb-2">Welcome</h2>
              <p className="text-[14px] text-muted leading-[1.45] mb-6">Enter your company name to access your procurement dashboard.</p>

              <div className="mb-5 flex flex-col">
                <label htmlFor="company-name" className="text-[11px] text-muted font-bold uppercase tracking-[0.5px] mb-1.5">Company Name</label>
                <input
                  type="text"
                  id="company-name"
                  placeholder=""
                  required
                  autoComplete="organization"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full py-[11px] px-[14px] text-[14.5px] text-body bg-white border border-line rounded-lg outline-none transition-all duration-200 focus:border-accent focus:shadow-[0_0_0_3px_rgba(18,122,90,0.1)] placeholder-[#a0a4a8]"
                />
              </div>

              <button type="submit" id="step1-btn" className="w-full py-3 text-[14.5px] font-bold text-white bg-emerald hover:bg-darkE active:scale-[0.98] disabled:bg-muted disabled:cursor-not-allowed disabled:opacity-70 rounded-lg cursor-pointer transition-all duration-200 flex items-center justify-center">Continue</button>
            </form>
          )}

          {step === 2 && (
            <form id="step2-form" className="flex flex-col" onSubmit={handleLogin}>
              <h2 className="text-[20px] font-extrabold text-[#393939] mb-2">Sign In</h2>
              <div className="flex items-center justify-between bg-pale border border-[#C5E3D4] rounded-lg py-2.5 px-3.5 mb-6">
                <span className="flex items-center gap-2 text-[14px] font-bold text-emerald">
                  <span id="confirmed-company">{confirmedCompany}</span>
                </span>
                <button type="button" id="change-company-btn" className="bg-none border-none text-accent text-[13px] font-bold cursor-pointer py-1 px-2 rounded transition-all duration-200 hover:text-darkE hover:bg-[rgba(14,92,68,0.05)]" onClick={handleChangeCompany}>Change</button>
              </div>

              <div className="mb-5 flex flex-col">
                <label htmlFor="email" className="text-[11px] text-muted font-bold uppercase tracking-[0.5px] mb-1.5">Email Address</label>
                <input
                  type="email"
                  id="email"
                  placeholder="name@company.com"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full py-[11px] px-[14px] text-[14.5px] text-body bg-white border border-line rounded-lg outline-none transition-all duration-200 focus:border-accent focus:shadow-[0_0_0_3px_rgba(18,122,90,0.1)] placeholder-[#a0a4a8]"
                />
              </div>

              <div className="mb-5 flex flex-col">
                <label htmlFor="password" className="text-[11px] text-muted font-bold uppercase tracking-[0.5px] mb-1.5">Password</label>
                <input
                  type="password"
                  id="password"
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full py-[11px] px-[14px] text-[14.5px] text-body bg-white border border-line rounded-lg outline-none transition-all duration-200 focus:border-accent focus:shadow-[0_0_0_3px_rgba(18,122,90,0.1)] placeholder-[#a0a4a8]"
                />
              </div>

              <button type="submit" id="step2-btn" className="w-full py-3 text-[14.5px] font-bold text-white bg-emerald hover:bg-darkE active:scale-[0.98] disabled:bg-muted disabled:cursor-not-allowed disabled:opacity-70 rounded-lg cursor-pointer transition-all duration-200 flex items-center justify-center">Log In</button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default Login;
