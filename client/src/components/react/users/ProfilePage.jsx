import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { UserProvider } from './UserContext';
import EditProfile from './EditProfile';

const ProfilePage = () => {
    return (
        <UserProvider>
            <BrowserRouter>
                <EditProfile />
            </BrowserRouter>
        </UserProvider>
    );
};

export default ProfilePage;