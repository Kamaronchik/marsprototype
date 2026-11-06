import { Link } from 'react-router-dom';
import Logo from './Logo';

// Full-page message for 404 / forbidden.
const StatusPage = ({ code, title, text }) => (
  <div className="flex min-h-screen flex-col items-center bg-paper px-6 py-10">
    <Logo />
    <div className="my-auto max-w-md py-10 text-center">
      <p className="font-display text-7xl font-semibold text-mars">{code}</p>
      <h1 className="mt-3 font-display text-2xl font-semibold text-ink">{title}</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">{text}</p>
      <Link to="/login" className="btn-primary mt-8">Back to start</Link>
    </div>
  </div>
);

export default StatusPage;
