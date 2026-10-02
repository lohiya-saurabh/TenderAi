import { describe, it, expect } from 'vitest';
import { App } from './App.js';

describe('App Component', () => {
  it('should be defined as a React component function', () => {
    expect(App).toBeDefined();
    expect(typeof App).toBe('function');
  });
});
