import { useEffect, useRef, useState } from 'react'
import { Routes, Route, useNavigate } from 'react-router-dom'
import api from './api'

function PasswordToggle({ visible, onToggle }) {
  return <button
    type="button"
    className="password-toggle"
    onMouseDown={event => event.preventDefault()}
    onClick={onToggle}
    aria-label={visible ? 'Hide password' : 'Show password'}
    aria-pressed={visible}
  >
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6Z" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  </button>
}

function Login() {
  const [captcha, setCaptcha] = useState(null)
  const [form, setForm] = useState({ userId: '', password: '', captchaText: '', rememberMe: false })
  const [showPassword, setShowPassword] = useState(false)
  const passwordInput = useRef(null)
  const [message, setMessage] = useState('')
  const navigate = useNavigate()

  function togglePassword() {
    const input = passwordInput.current
    const cursor = input?.selectionStart ?? input?.value.length ?? 0
    setShowPassword(visible => !visible)
    requestAnimationFrame(() => {
      input?.focus()
      input?.setSelectionRange(cursor, cursor)
    })
  }

  async function loadCaptcha(clearMessage = true) {
    try { const { data } = await api.get('/auth/captcha'); setCaptcha(data); setForm(f => ({ ...f, captchaText: '' })); if (clearMessage) setMessage('') }
    catch { setMessage('Cannot reach the API. Start the .NET backend first.') }
  }
  useEffect(() => { loadCaptcha() }, [])

  async function login(e) {
    e.preventDefault(); setMessage('')
    try {
      const { data } = await api.post('/auth/login', { ...form, captchaId: captcha.captchaId })
      localStorage.setItem('accessToken', data.accessToken)
      localStorage.setItem('user', JSON.stringify(data.user))
      navigate('/dashboard')
    } catch (err) {
      setMessage(err.response?.data?.message || 'Login failed')
      loadCaptcha(false)
    }
  }



  return <main className="auth-page">
    <section className="auth-shell">
      <aside className="brand-panel">
        <div className="brand brand-light">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l7 3v5c0 5-2.9 8.8-7 10-4.1-1.2-7-5-7-10V5l7-3zm0 2.2L7 6v4c0 3.8 2 6.8 5 8 3-1.2 5-4.2 5-8V6l-5-1.8zm-1 9.1l-2.2-2.2 1.4-1.4 1 1 3.1-3.1 1.4 1.4-4.7 4.3z"/></svg>
        </div>
        <div>
          <p className="eyebrow">Secure Authentication</p>
          <h2>Your account,<br/>protected by design.</h2>
          <p className="brand-copy">A simple and secure sign-in experience with verification at every step.</p>
        </div>
        <div className="security-note">
          <span className="security-dot"></span>
          <span>Protected connection</span>
        </div>
      </aside>

      <div className="auth-card">
        <div className="brand brand-mobile">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l7 3v5c0 5-2.9 8.8-7 10-4.1-1.2-7-5-7-10V5l7-3zm0 2.2L7 6v4c0 3.8 2 6.8 5 8 3-1.2 5-4.2 5-8V6l-5-1.8zm-1 9.1l-2.2-2.2 1.4-1.4 1 1 3.1-3.1 1.4 1.4-4.7 4.3z"/></svg>
        </div>
        <div className="form-heading">
          <h1>Welcome back</h1>
          <p className="muted">Sign in to your secure account</p>
        </div>
        {message && <div className="notice">{message}</div>}
        <form onSubmit={login}>
          <div className="field"><label htmlFor="userId">User ID</label><input id="userId" required inputMode="numeric" pattern="[0-9]+" value={form.userId} onChange={e=>setForm({...form,userId:e.target.value})} placeholder="Enter numeric user ID"/></div>
          <div className="field"><label htmlFor="password">Password</label><div className="password-field"><input ref={passwordInput} id="password" required type={showPassword ? 'text' : 'password'} value={form.password} onChange={e=>setForm({...form,password:e.target.value})} placeholder="Enter password"/><PasswordToggle visible={showPassword} onToggle={togglePassword}/></div></div>
          <div className="field">
            <label>Security check</label>
            <div className="captcha-row"><strong>{captcha?.captchaText || 'Loading...'}</strong><button type="button" className="secondary" onClick={loadCaptcha} aria-label="Refresh CAPTCHA">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11a8.1 8.1 0 10-2.4 6.1l1.4-1.4A6 6 0 114.1 13H7l-4 4-4-4h3.1A8 8 0 0020 11z"/></svg>
              Refresh
            </button></div>
            <input aria-label="CAPTCHA" required value={form.captchaText} onChange={e=>setForm({...form,captchaText:e.target.value})} placeholder="Enter CAPTCHA"/>
          </div>
          <div className="form-options">
            <label className="check"><input type="checkbox" checked={form.rememberMe} onChange={e=>setForm({...form,rememberMe:e.target.checked})}/><span>Keep me signed in <small>(30 days)</small></span></label>
            <button type="button" className="link forgot-link" onClick={()=>navigate('/forgot')}>Forgot password?</button>
          </div>
          <button className="primary">Login <span aria-hidden="true">→</span></button>
        </form>
        <button type="button" className="link" onClick={()=>navigate('/register')}>Create an account</button>
      </div>
    </section>
  </main>
}

function Register() {
  const [form,setForm]=useState({userId:'',password:'',confirmPassword:'',email:'',mobileNumber:''})
  const [message,setMessage]=useState('')
  const [created,setCreated]=useState(false)
  const navigate=useNavigate()

  async function register(e) {
    e.preventDefault()
    setMessage('')
    if(form.password!==form.confirmPassword){setMessage('Passwords do not match.');return}
    try {
      const {confirmPassword,...request}=form
      const {data}=await api.post('/auth/register',request)
      setCreated(true)
      setMessage(data.message)
    } catch(err) {
      setMessage(err.response?.data?.message||'Could not create your account.')
    }
  }

  return <main className="auth-page">
    <section className="auth-shell auth-shell-small">
      <div className="auth-card">
        <div className="brand brand-mobile">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l7 3v5c0 5-2.9 8.8-7 10-4.1-1.2-7-5-7-10V5l7-3zm0 2.2L7 6v4c0 3.8 2 6.8 5 8 3-1.2 5-4.2 5-8V6l-5-1.8zm-1 9.1l-2.2-2.2 1.4-1.4 1 1 3.1-3.1 1.4 1.4-4.7 4.3z"/></svg>
        </div>
        <div className="form-heading">
          <h1>Create an account</h1>
          <p className="muted">Set up your secure account</p>
        </div>
        {message&&<div className={`notice${created?' notice-success':''}`}>{message}</div>}
        {!created&&<form onSubmit={register}>
          <div className="field"><label htmlFor="registerUserId">User ID</label><input id="registerUserId" required inputMode="numeric" pattern="[0-9]+" maxLength="20" value={form.userId} onChange={e=>setForm({...form,userId:e.target.value})} placeholder="Choose a numeric user ID"/></div>
          <div className="field"><label htmlFor="registerEmail">Email address</label><input id="registerEmail" required type="email" autoComplete="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} placeholder="you@example.com"/></div>
          <div className="field"><label htmlFor="registerMobile">Mobile number</label><input id="registerMobile" required type="tel" autoComplete="tel" value={form.mobileNumber} onChange={e=>setForm({...form,mobileNumber:e.target.value})} placeholder="Enter your mobile number"/></div>
          <div className="field"><label htmlFor="registerPassword">Password</label><input id="registerPassword" required minLength="8" type="password" autoComplete="new-password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} placeholder="At least 8 characters"/></div>
          <div className="field"><label htmlFor="confirmRegisterPassword">Confirm password</label><input id="confirmRegisterPassword" required minLength="8" type="password" autoComplete="new-password" value={form.confirmPassword} onChange={e=>setForm({...form,confirmPassword:e.target.value})} placeholder="Re-enter your password"/></div>
          <button className="primary">Create account <span aria-hidden="true">→</span></button>
        </form>}
        <button type="button" className="link" onClick={()=>navigate('/')}>{created?'Go to login':'Back to login'}</button>
      </div>
    </section>
  </main>
}

function Forgot() {
  const [userId,setUserId]=useState(''), [otp,setOtp]=useState(''), [password,setPassword]=useState(''), [confirmPassword,setConfirmPassword]=useState('')
  const [stage,setStage]=useState(1), [message,setMessage]=useState(''), [isDevelopmentOtp,setIsDevelopmentOtp]=useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const passwordInput = useRef(null)
  const confirmPasswordInput = useRef(null)
  const navigate=useNavigate()
  function togglePassword() {
    const input = passwordInput.current
    const cursor = input?.selectionStart ?? input?.value.length ?? 0
    setShowPassword(visible => !visible)
    requestAnimationFrame(() => {
      input?.focus()
      input?.setSelectionRange(cursor, cursor)
    })
  }
  function toggleConfirmPassword() {
    const input = confirmPasswordInput.current
    const cursor = input?.selectionStart ?? input?.value.length ?? 0
    setShowConfirmPassword(visible => !visible)
    requestAnimationFrame(() => {
      input?.focus()
      input?.setSelectionRange(cursor, cursor)
    })
  }
  async function send(e){e.preventDefault();try{const {data}=await api.post('/password/forgot',{userId});setStage(2);setIsDevelopmentOtp(Boolean(data.developmentOtp));setMessage(data.developmentOtp?`${data.message} Code: ${data.developmentOtp}`:data.message)}catch(err){setMessage(err.response?.data?.message||'Request failed')}}
  async function reset(e){e.preventDefault();if(password!==confirmPassword){setMessage('Passwords do not match.');return}try{const {data}=await api.post('/password/reset',{userId,otp,newPassword:password});setMessage(data.message);setStage(3)}catch(err){setMessage(err.response?.data?.message||'Reset failed')}}
  return <main className="auth-page">
    <section className="auth-shell auth-shell-small">
      <div className="auth-card">
        <div className="brand brand-mobile"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l7 3v5c0 5-2.9 8.8-7 10-4.1-1.2-7-5-7-10V5l7-3zm0 2.2L7 6v4c0 3.8 2 6.8 5 8 3-1.2 5-4.2 5-8V6l-5-1.8zm-1 9.1l-2.2-2.2 1.4-1.4 1 1 3.1-3.1 1.4 1.4-4.7 4.3z"/></svg></div>
        <div className="form-heading"><h1>Reset password</h1><p className="muted">{stage===1?'Recover access to your account':stage===2?'Verify and choose a new password':'Your password has been updated'}</p></div>
        {message&&<div className="notice">{message}</div>}
        {stage===1&&<form onSubmit={send}><div className="field"><label htmlFor="forgotUserId">User ID</label><input id="forgotUserId" required inputMode="numeric" value={userId} onChange={e=>setUserId(e.target.value)} placeholder="Enter your numeric user ID"/></div><button className="primary">Send verification code <span aria-hidden="true">→</span></button></form>}
        {stage===2&&!isDevelopmentOtp&&<a className="link inbox-link" href="https://mail.google.com/mail/u/0/#inbox" target="_blank" rel="noopener noreferrer">Open Gmail to check your code</a>}
        {stage===2&&<form onSubmit={reset}><div className="field"><label htmlFor="resetOtp">Email verification code</label><input className="otp-input" id="resetOtp" required inputMode="numeric" maxLength="6" value={otp} onChange={e=>setOtp(e.target.value.replace(/\D/g,''))} placeholder="000000"/></div><div className="field"><label htmlFor="newPassword">New password</label><div className="password-field"><input ref={passwordInput} id="newPassword" required minLength="8" type={showPassword ? 'text' : 'password'} value={password} onChange={e=>{setPassword(e.target.value);setMessage('')}} placeholder="At least 8 characters"/><PasswordToggle visible={showPassword} onToggle={togglePassword}/></div></div><div className="field"><label htmlFor="confirmPassword">Confirm new password</label><div className="password-field"><input ref={confirmPasswordInput} id="confirmPassword" required minLength="8" type={showConfirmPassword ? 'text' : 'password'} value={confirmPassword} onChange={e=>{setConfirmPassword(e.target.value);setMessage('')}} placeholder="Re-enter your new password"/><PasswordToggle visible={showConfirmPassword} onToggle={toggleConfirmPassword}/></div></div><button className="primary">Reset password <span aria-hidden="true">→</span></button></form>}
        {stage===3&&<button className="primary reset-success-action" onClick={()=>navigate('/')}>Return to login <span aria-hidden="true">→</span></button>}
        {stage!==3&&<button className="link" onClick={()=>navigate('/')}>Back to login</button>}
      </div>
    </section>
  </main>
}

function Dashboard() {
  const [profile,setProfile]=useState(null), [error,setError]=useState(''), [loading,setLoading]=useState(true)
  const navigate=useNavigate()
  useEffect(()=>{const token=localStorage.getItem('accessToken');if(!token){setError('Your session is not valid. Please log in again.');setLoading(false);return}api.get('/auth/profile',{headers:{Authorization:`Bearer ${token}`}}).then(r=>setProfile(r.data)).catch(err=>{if(err.response?.status===401){localStorage.removeItem('accessToken');localStorage.removeItem('user')}setError('Your session is not valid. Please log in again.')}).finally(()=>setLoading(false))},[])
  async function logout(){try{await api.post('/auth/logout')}finally{localStorage.removeItem('accessToken');localStorage.removeItem('user');navigate('/')}}
  return <main className="auth-page">
    <section className="dashboard">
      <header className="dashboard-header">
        <div className="dashboard-brand"><div className="brand"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l7 3v5c0 5-2.9 8.8-7 10-4.1-1.2-7-5-7-10V5l7-3zm0 2.2L7 6v4c0 3.8 2 6.8 5 8 3-1.2 5-4.2 5-8V6l-5-1.8zm-1 9.1l-2.2-2.2 1.4-1.4 1 1 3.1-3.1 1.4 1.4-4.7 4.3z"/></svg></div><div><p>Secure Authentication</p><span>Account dashboard</span></div></div>
        <button className="logout-button" onClick={logout}>Logout</button>
      </header>
      <div className="dashboard-content">
        <div><p className="eyebrow dark">Account overview</p><h1>Welcome back</h1><p className="muted">Your secure session is active.</p></div>
        {profile?<section className="profile-grid">
          <article><span>User ID</span><strong>{profile.userId}</strong></article>
          <article><span>Email address</span><strong>{profile.email}</strong></article>
          <article><span>Mobile number</span><strong>{profile.mobileNumber}</strong></article>
        </section>:loading?<div className="profile-loading"><span className="spinner"></span>Loading profile...</div>:<div className="profile-loading">{error}<button className="link" onClick={()=>navigate('/')}>Back to login</button></div>}
      </div>
    </section>
  </main>
}
export default function App(){return <Routes><Route path="/" element={<Login/>}/><Route path="/register" element={<Register/>}/><Route path="/forgot" element={<Forgot/>}/><Route path="/dashboard" element={<Dashboard/>}/></Routes>}
