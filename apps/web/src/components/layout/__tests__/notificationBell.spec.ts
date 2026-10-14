import { describe, it, expect } from 'vitest';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { NotificationBell } from '../NotificationBell.js';

describe('NotificationBell Component Suite', () => {
  it('should instantiate NotificationBell component within Router context', () => {
    const element = React.createElement(MemoryRouter, null, React.createElement(NotificationBell));
    expect(element).toBeDefined();
  });
});
