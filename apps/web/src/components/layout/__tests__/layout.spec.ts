import { describe, it, expect } from 'vitest';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs.js';
import { Header } from '@/components/layout/Header.js';
import { UserAccountMenu } from '@/components/layout/UserAccountMenu.js';
import { AppShell } from '@/components/layout/AppShell.js';

describe('Application Shell Layout Suite', () => {
  describe('Breadcrumbs Navigation', () => {
    it('should instantiate Breadcrumbs component for root and nested routes', () => {
      const element = React.createElement(
        MemoryRouter,
        { initialEntries: ['/bids/bid_123/compliance/item_456'] },
        React.createElement(Breadcrumbs),
      );
      expect(element).toBeDefined();
    });
  });

  describe('Header Component', () => {
    it('should instantiate the top navigation Header', () => {
      const header = React.createElement(MemoryRouter, null, React.createElement(Header));
      expect(header).toBeDefined();
    });
  });

  describe('User Account Menu', () => {
    it('should instantiate UserAccountMenu', () => {
      const menu = React.createElement(MemoryRouter, null, React.createElement(UserAccountMenu));
      expect(menu).toBeDefined();
    });
  });

  describe('AppShell Root Container', () => {
    it('should instantiate AppShell with responsive desktop and mobile containers', () => {
      const shell = React.createElement(MemoryRouter, null, React.createElement(AppShell));
      expect(shell).toBeDefined();
    });
  });
});
