import { Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { EvaluationPage } from './pages/EvaluationPage';
import { ReviewPage } from './pages/ReviewPage';
import { StudiesPage } from './pages/StudiesPage';

export function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<StudiesPage />} />
        <Route path="studies/:studyId" element={<ReviewPage />} />
        <Route path="evaluation" element={<EvaluationPage />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

function NotFound() {
  return (
    <div className="browser">
      <h1>Page not found</h1>
      <p className="muted">Choose Studies, Review, or Evaluation from the top bar.</p>
    </div>
  );
}
