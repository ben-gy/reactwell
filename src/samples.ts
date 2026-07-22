// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Ben Richardson — https://benrichardson.dev
// Additional terms under AGPL-3.0 section 7(b) apply; see ADDITIONAL-TERMS.md.
/** Starter snippets shown in the picker and used as the default document. */

export interface Sample {
  id: string;
  label: string;
  code: string;
}

export const SAMPLES: Sample[] = [
  {
    id: 'counter',
    label: 'Counter (useState)',
    code: `export default function Counter() {
  const [count, setCount] = React.useState(0);
  return (
    <div style={{ fontFamily: 'system-ui', display: 'grid', gap: 12, placeItems: 'start' }}>
      <h2>Count: {count}</h2>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => setCount((c) => c - 1)}>−</button>
        <button onClick={() => setCount((c) => c + 1)}>+</button>
        <button onClick={() => setCount(0)}>reset</button>
      </div>
    </div>
  );
}
`,
  },
  {
    id: 'ticker',
    label: 'Live clock (useEffect)',
    code: `import { useEffect, useState } from 'react';

export default function Clock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 40 }}>
      {now.toLocaleTimeString()}
    </div>
  );
}
`,
  },
  {
    id: 'typescript',
    label: 'TypeScript props',
    code: `type Item = { id: number; name: string; done: boolean };

const DATA: Item[] = [
  { id: 1, name: 'Transpile JSX in the browser', done: true },
  { id: 2, name: 'Render with React', done: true },
  { id: 3, name: 'Send nothing to a server', done: true },
];

function Row({ item }: { item: Item }) {
  return (
    <li style={{ opacity: item.done ? 0.55 : 1 }}>
      {item.done ? '✓' : '○'} {item.name}
    </li>
  );
}

export default function List() {
  return (
    <ul style={{ fontFamily: 'system-ui', lineHeight: 1.8 }}>
      {DATA.map((item) => <Row key={item.id} item={item} />)}
    </ul>
  );
}
`,
  },
  {
    id: 'form',
    label: 'Controlled form',
    code: `import { useState } from 'react';

export default function Greeter() {
  const [name, setName] = useState('');
  return (
    <div style={{ fontFamily: 'system-ui', display: 'grid', gap: 10, maxWidth: 320 }}>
      <label>
        Your name
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="type here…"
          style={{ display: 'block', width: '100%', padding: 8, marginTop: 4 }}
        />
      </label>
      <p style={{ fontSize: 22 }}>
        {name ? \`Hello, \${name}!\` : 'Hello, stranger.'}
      </p>
    </div>
  );
}
`,
  },
];

export const DEFAULT_SAMPLE = SAMPLES[0];
