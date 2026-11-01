import '@testing-library/jest-dom/vitest';
import { cloneElement, createElement } from 'react';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// jsdom has no layout engine, so give Recharts' ResponsiveContainer a fixed size in tests.
vi.mock('recharts', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    ResponsiveContainer: ({ children }) => createElement('div', { style: { width: 800, height: 400 } }, cloneElement(children, { width: 800, height: 400 })),
  };
});

afterEach(() => cleanup());
