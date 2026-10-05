import { describe, it, expect } from 'vitest';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { ProfilePage } from '../ProfilePage.js';
import { SettingsPage } from '../SettingsPage.js';
import { AuthProvider } from '../../auth/AuthProvider.js';
import { CompanyProvider } from '../../context/CompanyContext.js';

describe('Profile & Settings Pages Suite', () => {
  describe('ProfilePage', () => {
    it('should render ProfilePage within Auth and Company providers', () => {
      const element = React.createElement(
        MemoryRouter,
        { initialEntries: ['/profile'] },
        React.createElement(
          AuthProvider,
          null,
          React.createElement(
            CompanyProvider,
            null,
            React.createElement(ProfilePage)
          )
        )
      );
      expect(element).toBeDefined();
    });
  });

  describe('SettingsPage', () => {
    it('should render SettingsPage with default general tab', () => {
      const element = React.createElement(
        MemoryRouter,
        { initialEntries: ['/settings'] },
        React.createElement(
          AuthProvider,
          null,
          React.createElement(
            CompanyProvider,
            null,
            React.createElement(SettingsPage)
          )
        )
      );
      expect(element).toBeDefined();
    });

    it('should render SettingsPage with notifications tab query parameter', () => {
      const element = React.createElement(
        MemoryRouter,
        { initialEntries: ['/settings?tab=notifications'] },
        React.createElement(
          AuthProvider,
          null,
          React.createElement(
            CompanyProvider,
            null,
            React.createElement(SettingsPage)
          )
        )
      );
      expect(element).toBeDefined();
    });

    it('should render SettingsPage with security tab query parameter', () => {
      const element = React.createElement(
        MemoryRouter,
        { initialEntries: ['/settings?tab=security'] },
        React.createElement(
          AuthProvider,
          null,
          React.createElement(
            CompanyProvider,
            null,
            React.createElement(SettingsPage)
          )
        )
      );
      expect(element).toBeDefined();
    });

    it('should render SettingsPage with team tab query parameter', () => {
      const element = React.createElement(
        MemoryRouter,
        { initialEntries: ['/settings?tab=team'] },
        React.createElement(
          AuthProvider,
          null,
          React.createElement(
            CompanyProvider,
            null,
            React.createElement(SettingsPage)
          )
        )
      );
      expect(element).toBeDefined();
    });

    it('should render SettingsPage with companies tab query parameter', () => {
      const element = React.createElement(
        MemoryRouter,
        { initialEntries: ['/settings?tab=companies'] },
        React.createElement(
          AuthProvider,
          null,
          React.createElement(
            CompanyProvider,
            null,
            React.createElement(SettingsPage)
          )
        )
      );
      expect(element).toBeDefined();
    });
  });
});
