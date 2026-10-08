import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Orders from "./pages/Ordersrders";
import QRScanner from "./pages/QRScanner";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/dashboard/:companyId" element={<Dashboard />} />
        <Route path="/orders" element={<Orders />} />
        <Route path="/qrscanner" element={<QRScanner />} />
      </Routes>
    </Router>
  );
}

export default App;
