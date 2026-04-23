import { Link } from 'react-router-dom';

export default function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="ops-placeholder">
      <h1 className="ops-placeholder-title">{title}</h1>
      <p className="ops-placeholder-text">This section is not wired yet. Use the dashboard for live queue and map.</p>
      <Link to="/" className="ops-btn ops-btn--primary">
        Back to dashboard
      </Link>
    </div>
  );
}
