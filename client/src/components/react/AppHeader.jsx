import React from 'react';
import { UserProvider } from './users/UserContext';
import Header from './Header';

const AppHeader = () => {
  return (
    <UserProvider>
      <Header />
    </UserProvider>
  );
};

export default AppHeader;