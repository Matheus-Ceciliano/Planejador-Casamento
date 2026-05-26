import { Navigate, Route, Routes } from 'react-router-dom';
import LoadingSpinner from './components/LoadingSpinner';
import OfflineNotice from './components/OfflineNotice';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { WeddingProvider, useWedding } from './hooks/useWedding';
import AppLayout from './layouts/AppLayout';
import Budget from './pages/Budget';
import BudgetDueDates from './pages/BudgetDueDates';
import Categories from './pages/Categories';
import Dashboard from './pages/Dashboard';
import Families from './pages/Families';
import Files from './pages/Files';
import Guests from './pages/Guests';
import Login from './pages/Login';
import Register from './pages/Register';
import Settings from './pages/Settings';
import Tables from './pages/Tables';
import Tasks from './pages/Tasks';
import Timeline from './pages/Timeline';
import Vendors from './pages/Vendors';

function Protected() {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex min-h-screen items-center justify-center"><LoadingSpinner /></div>;
  if (!user) return <Navigate to="/login" replace />;
  return (
    <WeddingProvider>
      <RequireWedding />
    </WeddingProvider>
  );
}

function RequireWedding() {
  const { wedding, loading } = useWedding();
  if (loading) return <div className="flex min-h-screen items-center justify-center"><LoadingSpinner /></div>;
  return (
    <AppLayout>
      {!wedding && location.pathname !== '/configuracoes' ? <Settings firstRun /> : <RoutesContent />}
    </AppLayout>
  );
}

function RoutesContent() {
  return (
    <Routes>
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/convidados" element={<Guests />} />
      <Route path="/familias" element={<Families />} />
      <Route path="/mesas" element={<Tables />} />
      <Route path="/orcamento" element={<Budget />} />
      <Route path="/orcamento/vencimentos" element={<BudgetDueDates />} />
      <Route path="/orcamento/:category" element={<Budget />} />
      <Route path="/categorias" element={<Categories />} />
      <Route path="/fornecedores" element={<Vendors />} />
      <Route path="/espacos" element={<Navigate to="/orcamento/espaco" replace />} />
      <Route path="/buffet" element={<Navigate to="/orcamento/buffet" replace />} />
      <Route path="/bebidas" element={<Navigate to="/orcamento/bebidas" replace />} />
      <Route path="/tarefas" element={<Tasks />} />
      <Route path="/cronograma" element={<Timeline />} />
      <Route path="/arquivos" element={<Files />} />
      <Route path="/configuracoes" element={<Settings />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/*" element={<Protected />} />
      </Routes>
      <OfflineNotice />
    </AuthProvider>
  );
}
