# NitroIDB

Supercharged IndexedDB. Simple, Fast, Developer-Friendly

A modern, safe, ergonomic wrapper around IndexedDB designed to solve browser inconsistencies (especially Safari/iOS), silent hangs, migration pain, and poor developer experience.

## Features

- 🛡️ **Safety First** - Database never silently corrupts or hangs
- 🌐 **Browser Compatibility** - Handles Safari/WebKit quirks automatically
- 📦 **Modular Design** - Tiny core (~8KB) + optional advanced modules
- 🔒 **Type Safe** - Full TypeScript support with inference
- 🚀 **Performance** - Optimized bulk operations with adaptive batching
- 🔧 **Developer Experience** - Clear errors, health checks, and debugging tools

## Installation

```bash
npm install nitroidb
```

## Quick Start

```typescript
import { createDB } from 'nitroidb';

const db = createDB({
  name: 'myapp',
  version: 1,
  stores: {
    users: { primaryKey: 'id', indexes: ['email'] },
    todos: { primaryKey: 'id', indexes: ['completed', 'createdAt'] },
  },
});

// Key-Value API
await db.kv.set('theme', 'dark');
const theme = await db.kv.get('theme');

// Table API
await db.table('users').add({ id: '1', email: 'user@example.com', name: 'John' });
const user = await db.table('users').get('1');
const users = await db.table('users').where('email').equals('user@example.com');
```

## Status

🚧 **In Development** - Currently implementing core infrastructure

### Completed
- ✅ Project setup (TypeScript, build pipeline, testing)
- ✅ Core types (Schema, Store, Transaction, Browser)
- ✅ Browser detection utilities
- ✅ Error classes (Transaction, Storage, Migration, Browser, Corruption)

### In Progress
- 🔄 Schema engine & database creation
- 🔄 Key-Value API
- 🔄 Table API

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Run browser tests
npm run test:browser

# Build
npm run build

# Type check
npm run typecheck
```

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 15+
- Edge 90+
- iOS Safari 15+

## License

MIT
