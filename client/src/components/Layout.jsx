import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import { useProject } from '../context/ProjectContext';
import { ErrorAlert } from './ui';

export default function Layout() {
  const { error } = useProject();
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Navbar />
        <main className="flex-1 p-4 md:p-6">
          <ErrorAlert error={error} />
          <Outlet />
        </main>
      </div>
    </div>
  );
}
