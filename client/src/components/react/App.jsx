import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { UserProvider } from './users/UserContext';

// Importar páginas
import Home from './Home';
import BookingWizard from './BookingWizard';
import Auth from './users/Auth';
import ResetPassword from './users/ResetPassword';
import ForgotPassword from './users/ForgotPassword';
import EditProfile from './users/EditProfile';
import HomeGallery from './HomeGallery';
import MyAppointments from './MyAppointments';
import Awards3D from './Awards3D';
import AdminPanel from './admin/AdminPanel'; // Asumiendo ruta

const App = () => {
    return (
        <BrowserRouter>
            <UserProvider>
                <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/turnos" element={<BookingWizard />} />
                    <Route path="/login" element={<Auth />} />
                    <Route path="/register" element={<Auth />} />
                    <Route path="/forgot-password" element={<ForgotPassword />} />
                    <Route path="/reset-password/:id/:token" element={<ResetPassword />} />
                    <Route path="/profile" element={<EditProfile />} />
                    <Route path="/gallery" element={<HomeGallery />} />
                    <Route path="/mis-turnos" element={<MyAppointments />} />
                    <Route path="/awards" element={<Awards3D />} />
                    <Route path="/admin" element={<AdminPanel />} />
                </Routes>
            </UserProvider>
        </BrowserRouter>
    );
};

export default App;