import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { UserProvider } from './UserContext';
import Auth from './Auth';

const AuthPage = () => {
    const handleSuccess = () => {
        // Redirección forzada para recargar la aplicación Astro
        window.location.href = '/';
    };

    return (
        <UserProvider>
            <BrowserRouter>
                <Auth onSuccess={handleSuccess} />
            </BrowserRouter>
        </UserProvider>
    );
};

export default AuthPage;