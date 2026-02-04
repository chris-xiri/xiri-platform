import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { LandingPage } from './pages/LandingPage';
import { CustomerForm } from './pages/CustomerForm';
import { VendorChat } from './pages/VendorChat';

function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/get-started" element={<CustomerForm />} />
                <Route path="/chat/:vendorId" element={<VendorChat />} />
            </Routes>
        </BrowserRouter>
    )
}

export default App
