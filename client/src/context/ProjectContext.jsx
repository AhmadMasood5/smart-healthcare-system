import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../services/api';

const ProjectContext = createContext(null);
const STORAGE_KEY = 'spm.selectedProject';

function readStoredId() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function ProjectProvider({ children }) {
  const [projects, setProjects] = useState([]);
  const [selectedId, setSelectedId] = useState(readStoredId);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refreshProjects = useCallback(async () => {
    try {
      const list = await api.projects.list();
      setProjects(list);
      setError(null);
      setSelectedId((current) => (list.some((p) => p._id === current) ? current : list[0] ? list[0]._id : null));
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshProjects();
  }, [refreshProjects]);

  useEffect(() => {
    try {
      if (selectedId) localStorage.setItem(STORAGE_KEY, selectedId);
    } catch {
      /* storage unavailable */
    }
  }, [selectedId]);

  const value = useMemo(
    () => ({
      projects,
      project: projects.find((p) => p._id === selectedId) || null,
      projectId: selectedId,
      selectProject: setSelectedId,
      refreshProjects,
      loading,
      error,
    }),
    [projects, selectedId, refreshProjects, loading, error]
  );

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

export function useProject() {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error('useProject must be used inside ProjectProvider');
  return ctx;
}
