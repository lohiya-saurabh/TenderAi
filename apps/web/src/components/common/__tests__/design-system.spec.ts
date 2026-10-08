import { describe, it, expect } from 'vitest';
import React from 'react';
import {
  StatusBadge,
  RiskBadge,
  Badge,
  Button,
  Input,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableCell,
  TableBody,
  Tabs,
  TabPanel,
  Modal,
  Drawer,
  Tooltip,
  Alert,
  LoadingSkeleton,
  Spinner,
  LoadingState,
  EmptyState,
  ErrorBanner,
  ErrorState,
  PageContainer,
  PageHeader,
  SectionHeader,
  PageGrid,
} from '../index.js';

describe('Design System Primitives & Tokens Suite', () => {
  describe('Semantic Status Badges', () => {
    it('should export and instantiate canonical semantic status badges', () => {
      const passElement = React.createElement(StatusBadge, { status: 'PASS' });
      const failElement = React.createElement(StatusBadge, { status: 'FAIL' });
      const missingElement = React.createElement(StatusBadge, { status: 'MISSING' });
      const reviewElement = React.createElement(StatusBadge, { status: 'REVIEW_REQUIRED' });
      const naElement = React.createElement(StatusBadge, { status: 'NOT_APPLICABLE' });

      expect(passElement.props.status).toBe('PASS');
      expect(failElement.props.status).toBe('FAIL');
      expect(missingElement.props.status).toBe('MISSING');
      expect(reviewElement.props.status).toBe('REVIEW_REQUIRED');
      expect(naElement.props.status).toBe('NOT_APPLICABLE');
    });

    it('should support legacy and document status aliases seamlessly', () => {
      const readyElement = React.createElement(StatusBadge, { status: 'READY' });
      const flaggedElement = React.createElement(StatusBadge, { status: 'FLAGGED' });
      const pendingElement = React.createElement(StatusBadge, { status: 'PENDING' });
      const waivedElement = React.createElement(StatusBadge, { status: 'WAIVED' });
      const processingElement = React.createElement(StatusBadge, { status: 'PROCESSING', iconOnly: true });
      const queuedElement = React.createElement(StatusBadge, { status: 'QUEUED_FOR_EXTRACTION', iconOnly: true });
      const completedElement = React.createElement(StatusBadge, { status: 'COMPLETED' });

      expect(readyElement.props.status).toBe('READY');
      expect(flaggedElement.props.status).toBe('FLAGGED');
      expect(pendingElement.props.status).toBe('PENDING');
      expect(waivedElement.props.status).toBe('WAIVED');
      expect(processingElement.props.status).toBe('PROCESSING');
      expect(processingElement.props.iconOnly).toBe(true);
      expect(queuedElement.props.status).toBe('QUEUED_FOR_EXTRACTION');
      expect(queuedElement.props.iconOnly).toBe(true);
      expect(completedElement.props.status).toBe('COMPLETED');
    });
  });

  describe('Semantic Risk Badges', () => {
    it('should instantiate all 4 semantic risk levels', () => {
      const criticalElement = React.createElement(RiskBadge, { level: 'CRITICAL' });
      const highElement = React.createElement(RiskBadge, { level: 'HIGH' });
      const mediumElement = React.createElement(RiskBadge, { level: 'MEDIUM' });
      const lowElement = React.createElement(RiskBadge, { level: 'LOW' });

      expect(criticalElement.props.level).toBe('CRITICAL');
      expect(highElement.props.level).toBe('HIGH');
      expect(mediumElement.props.level).toBe('MEDIUM');
      expect(lowElement.props.level).toBe('LOW');
    });
  });

  describe('Badges & Section Headers', () => {
    it('should instantiate Badge with variant, size, and dot indicator', () => {
      const badge = React.createElement(
        Badge,
        { variant: 'success', size: 'sm', dot: true },
        'Verified'
      );
      expect(badge.props.variant).toBe('success');
      expect(badge.props.size).toBe('sm');
      expect(badge.props.dot).toBe(true);
    });

    it('should instantiate SectionHeader with title, description, and heading level', () => {
      const header = React.createElement(SectionHeader, {
        title: 'Evidence Map',
        description: 'Pinned profile version',
        level: 'h3',
      });
      expect(header.props.title).toBe('Evidence Map');
      expect(header.props.level).toBe('h3');
    });
  });

  describe('Buttons & Inputs', () => {
    it('should define button variants, sizes, and states', () => {
      const btn = React.createElement(
        Button,
        { variant: 'primary', size: 'lg', isLoading: true },
        'Submit Bid'
      );
      expect(btn.props.variant).toBe('primary');
      expect(btn.props.size).toBe('lg');
      expect(btn.props.isLoading).toBe(true);
    });

    it('should define input with label and validation attributes', () => {
      const input = React.createElement(Input, {
        label: 'Tender Reference',
        error: 'Required field',
        required: true,
      });
      expect(input.props.label).toBe('Tender Reference');
      expect(input.props.error).toBe('Required field');
      expect(input.props.required).toBe(true);
    });
  });

  describe('Cards & Tables', () => {
    it('should construct card hierarchy', () => {
      const header = React.createElement(CardHeader, null, React.createElement(CardTitle, null, 'Project'));
      const content = React.createElement(CardContent, null, 'Card body text');
      const card = React.createElement(Card, { variant: 'interactive' }, header, content);

      expect(card.props.variant).toBe('interactive');
      expect(card.props.children).toHaveLength(2);
    });

    it('should construct table hierarchy', () => {
      const row = React.createElement(
        TableRow,
        null,
        React.createElement(TableCell, null, 'Clause 4.1')
      );
      const head = React.createElement(TableHead, null, React.createElement(TableHeader, null, 'Clause'));
      const body = React.createElement(TableBody, null, row);
      const table = React.createElement(Table, { striped: true, hoverable: true }, head, body);

      expect(table.props.striped).toBe(true);
      expect(table.props.hoverable).toBe(true);
    });
  });

  describe('Tabs & Panels', () => {
    it('should define tabs and tab panels', () => {
      const tabsData = [
        { id: 'all', label: 'All Items', badge: 12 },
        { id: 'missing', label: 'Missing Evidence', badge: 3, badgeVariant: 'warning' as const },
      ];
      const tabs = React.createElement(Tabs, {
        tabs: tabsData,
        activeTab: 'missing',
        onChange: () => {},
      });
      const panel = React.createElement(
        TabPanel,
        { tabId: 'missing', activeTab: 'missing' },
        'Missing content'
      );

      expect(tabs.props.activeTab).toBe('missing');
      expect(tabs.props.tabs).toHaveLength(2);
      expect(panel.props.tabId).toBe('missing');
    });
  });

  describe('Dialogs, Drawers & Tooltips', () => {
    it('should configure Modal dialog', () => {
      const modal = React.createElement(
        Modal,
        { isOpen: true, onClose: () => {}, title: 'Confirm Submission', size: 'lg' },
        'Modal body'
      );
      expect(modal.props.isOpen).toBe(true);
      expect(modal.props.title).toBe('Confirm Submission');
      expect(modal.props.size).toBe('lg');
    });

    it('should configure Drawer slide-over', () => {
      const drawer = React.createElement(
        Drawer,
        { isOpen: true, onClose: () => {}, title: 'Evidence Citation', width: '560px' },
        'Drawer body'
      );
      expect(drawer.props.isOpen).toBe(true);
      expect(drawer.props.title).toBe('Evidence Citation');
      expect(drawer.props.width).toBe('560px');
    });

    it('should configure Tooltip wrapper', () => {
      const tooltip = React.createElement(
        Tooltip,
        { content: 'More info', position: 'top' },
        React.createElement('button', null, 'Hover')
      );
      expect(tooltip.props.content).toBe('More info');
      expect(tooltip.props.position).toBe('top');
    });
  });

  describe('Alerts, Loading & Error States', () => {
    it('should configure Alert variants', () => {
      const alert = React.createElement(
        Alert,
        { variant: 'warning', title: 'High LD Risk' },
        'LD capped at 10%.'
      );
      expect(alert.props.variant).toBe('warning');
      expect(alert.props.title).toBe('High LD Risk');
    });

    it('should configure LoadingSkeleton and Spinner', () => {
      const skeleton = React.createElement(LoadingSkeleton, { count: 3, variant: 'text' });
      const spinner = React.createElement(Spinner, { size: 'lg' });
      const loadingState = React.createElement(LoadingState, { message: 'Extracting clauses...' });

      expect(skeleton.props.count).toBe(3);
      expect(spinner.props.size).toBe('lg');
      expect(loadingState.props.message).toBe('Extracting clauses...');
    });

    it('should configure EmptyState and ErrorBanner', () => {
      const empty = React.createElement(EmptyState, {
        title: 'No Bids Found',
        description: 'Upload your first tender NIT document to begin.',
      });
      const error = React.createElement(ErrorBanner, {
        message: 'Network connection lost',
        onRetry: () => {},
      });
      const errorState = React.createElement(ErrorState, {
        title: 'Backend Unavailable',
        message: 'Could not connect to TenderPulse AI service.',
      });

      expect(empty.props.title).toBe('No Bids Found');
      expect(error.props.message).toBe('Network connection lost');
      expect(errorState.props.title).toBe('Backend Unavailable');
    });
  });

  describe('Page Layout Containers', () => {
    it('should configure PageContainer, PageHeader, and PageGrid', () => {
      const header = React.createElement(PageHeader, {
        title: 'Bidding Workspace',
        subtitle: 'Review requirements and proof mapping',
      });
      const grid = React.createElement(PageGrid, { columns: 2 });
      const container = React.createElement(PageContainer, null, header, grid);

      expect(header.props.title).toBe('Bidding Workspace');
      expect(grid.props.columns).toBe(2);
      expect(container.props.children).toHaveLength(2);
    });
  });
});
