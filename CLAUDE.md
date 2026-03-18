# CLAUDE.md — AI Assistant Guide for LockBit_Blogue

## Project Overview

**LockBit_Blogue** is a minimal static blog site built with [Astro](https://astro.build/) 4.5.5. It features a dark-themed, card-based layout with custom color theming and TypeScript type safety. The project is in early development (v0.0.1).

---

## Tech Stack

| Tool | Version | Purpose |
|------|---------|---------|
| Astro | ^4.5.5 | Static site framework |
| TypeScript | ^5.4.2 | Type safety |
| @astrojs/check | ^0.5.9 | TS type checking in build |
| pnpm | (lockfile present) | Package manager |

---

## Repository Structure

```
LockBit_Blogue/
├── public/
│   └── favicon.svg              # Site favicon
├── src/
│   ├── components/
│   │   ├── Card.astro           # Reusable blog post card
│   │   └── colors.astro         # Shared color constants
│   ├── layouts/
│   │   └── Layout.astro         # Base HTML layout template
│   ├── pages/
│   │   └── index.astro          # Homepage (route: /)
│   └── env.d.ts                 # Astro client type references
├── .vscode/
│   ├── extensions.json          # Recommends Astro VSCode extension
│   └── launch.json              # Dev server launch config
├── astro.config.mjs             # Astro configuration (minimal)
├── tsconfig.json                # Extends astro/tsconfigs/strict
├── package.json                 # Scripts and dependencies
└── pnpm-lock.yaml               # Locked dependency versions
```

---

## Development Commands

Always use `pnpm` (not `npm` or `yarn`):

```bash
pnpm dev          # Start dev server at http://localhost:4321
pnpm start        # Alias for dev
pnpm build        # Type check + production build to ./dist/
pnpm preview      # Preview production build locally
pnpm astro        # Run Astro CLI directly
```

The `build` script runs `astro check && astro build` — type errors will fail the build.

---

## Key Files and Their Roles

### `src/components/Card.astro`
Reusable card component for displaying blog-style posts.

- **Props**: `title: string`, `body: string`, `href: string`
- Renders a "Key Protected" badge, a linked title, and a body (max 80px height, overflow hidden)
- Background color sourced from `colors.astro`
- Includes hover effect styling

### `src/components/colors.astro`
Centralized color constants module. Import from here — do not hardcode colors in components.

```ts
export const background_color = "#f71b3a";      // Bright red
export const post_block_bad_color = "#ffeded";  // Light pink
export const post_block_good_color = "e9f9f1";  // Light green
```

### `src/layouts/Layout.astro`
Base HTML layout wrapping all pages.

- **Props**: `title: string`
- Defines global CSS variables:
  - `--accent`: `rgb(247, 27, 58)` — primary red
  - `--accent-light`: `rgb(224, 204, 250)` — light purple
  - `--accent-dark`: `rgb(49, 10, 101)` — dark purple
- Background: `#13151a` (dark theme)

### `src/pages/index.astro`
The homepage, rendered at `/`.

- Uses `Layout.astro` with title "Astro"
- Displays a gradient "Welcome to Astro" heading
- Renders a 2×2 grid of `Card` components

---

## Conventions

### Styling
- Use CSS variables defined in `Layout.astro` for accent colors (`--accent`, `--accent-light`, `--accent-dark`)
- Import shared colors from `src/components/colors.astro` for component-level background colors
- Global styles live in `Layout.astro`; component-scoped styles go in `<style>` blocks within each `.astro` file

### TypeScript
- Config extends `astro/tsconfigs/strict` — strict mode is enforced
- All components should be properly typed (props interface in frontmatter)
- `src/env.d.ts` references Astro client types — do not remove

### File Naming
- Components: `PascalCase.astro` (e.g., `Card.astro`)
- Pages: `lowercase.astro` (e.g., `index.astro`)
- Layouts: `PascalCase.astro` (e.g., `Layout.astro`)

### Adding New Pages
Create `.astro` files in `src/pages/` — Astro uses file-based routing. A file at `src/pages/about.astro` becomes `/about`.

### Adding New Components
Place in `src/components/`. Import colors from `colors.astro` rather than hardcoding hex values.

---

## Testing

No test framework is configured. Type checking is the primary quality gate:

```bash
pnpm astro check   # Run TypeScript type checking
```

This runs automatically as part of `pnpm build`.

---

## Git Workflow

- **Active development branch**: `claude/add-claude-documentation-AuETx`
- **Remote**: `origin` (Gitea instance at `127.0.0.1:43561`)
- Main remote branch is `origin/main`

Commit messages follow a descriptive style (see history):
- "Update accent color in global styles"
- "Refactor Card component layout and styles"
- "Add colors module"

---

## Known Project State

- No routing beyond the homepage (`/`) yet
- No content management system or markdown blog posts integrated
- No deployment configuration present
- Card component links currently point to Astro documentation resources (placeholder content)
- The "Key Protected" badge in Card.astro appears to be a design element for future functionality
