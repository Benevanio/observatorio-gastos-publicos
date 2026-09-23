import { Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Municipalities } from './pages/Municipalities';
import { Collections } from './pages/Collections';
import { Procurements } from './pages/Procurements';
import { Contracts, Suppliers, Payments } from './pages/ContractsSuppliersPayments';
import { Findings } from './pages/Findings';
import { Analytics, Comparison, Imports, Reports, Logs } from './pages/OtherPages';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="municipalities" element={<Municipalities />} />
        <Route path="collections" element={<Collections />} />
        <Route path="procurements" element={<Procurements />} />
        <Route path="contracts" element={<Contracts />} />
        <Route path="suppliers" element={<Suppliers />} />
        <Route path="payments" element={<Payments />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="findings" element={<Findings />} />
        <Route path="comparison" element={<Comparison />} />
        <Route path="imports" element={<Imports />} />
        <Route path="reports" element={<Reports />} />
        <Route path="logs" element={<Logs />} />
      </Route>
    </Routes>
  );
}
