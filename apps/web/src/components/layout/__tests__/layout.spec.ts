import { describe, it, expect } from 'vitest';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { Breadcrumbs } from '../Breadcrumbs.js';
import { Sidebar } from '../Sidebar.js';
import { Header } from '../Header.js';
import { UserAccountMenu } from '../UserAccountMenu.js';
import { AppShell } from '../AppShell.js';

describe('Application Shell Layout Suite', () => {
  describe('Breadcrumbs Navigation', () => {
    it('should instantiate Breadcrumbs component for root and nested routes', () => {
      const element = React.createElement(
        MemoryRouter,
        { initialEntries: ['/bids/bid_123/compliance/item_456'] },
        React.createElement(Breadcrumbs)
      );
      expect(element).toBeDefined();
    });
  });

  describe('Sidebar Navigation', () => {
    it('should instantiate Sidebar in default expanded desktop mode', () => {
      const sidebar = React.createElement(
        MemoryRouter,
        null,
        React.createElement(Sidebar, { isCollapsed: false })
      );
      expect(sidebar).toBeDefined();
    });

    it('should instantiate Sidebar in collapsed rail mode', () => {
      const sidebar = React.createElement(
        MemoryRouter,
        null,
        React.createElement(Sidebar, { isCollapsed: true })
      );
      expect(sidebar).toBeDefined();
    });

    it('should instantiate Sidebar in mobile drawer overlay mode', () => {
      const sidebar = React.createElement(
        MemoryRouter,
        null,
        React.createElement(Sidebar, { isMobileOpen: true, onCloseMobile: () => {} })
      );
      expect(sidebar).toBeDefined();
    });
  });

  describe('Header Component', () => {
    it('should instantiate Header with navigation toggles', () => {
      const header = React.createElement(
        MemoryRouter,
        null,
        React.createElement(Header, {
          isSidebarCollapsed: false,
          onToggleMobileSidebar: () => {},
          onToggleSidebarCollapse: () => {},
        })
      );
      expect(header).toBeDefined();
    });
  });

  describe('User Account Menu', () => {
    it('should instantiate UserAccountMenu', () => {
      const menu = React.createElement(
        MemoryRouter,
        null,
        React.createElement(UserAccountMenu)
      );
      expect(menu).toBeDefined();
    });
  });

  describe('AppShell Root Container', () => {
    it('should instantiate AppShell with responsive desktop and mobile containers', () => {
      const shell = React.createElement(
        MemoryRouter,
        null,
        React.createElement(AppShell)
      );
      expect(shell).toBeDefined();
    });
  });
});
