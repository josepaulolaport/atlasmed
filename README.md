# AtlasMed

A full-stack sales application built with modern technologies, organized as a monorepo for efficient development and deployment.

## Tech Stack

- **Backend**: Bun + TypeScript + Elysia
- **Web App**: Next.js 16 + React 19 + TypeScript + Tailwind CSS
- **Mobile App**: Flutter (Dart SDK 3.11.5)
- **Shared**: TypeScript types for API contracts

## Project Structure

```
atlasmed/
├── backend/          # Bun + Elysia API server
├── web/             # Next.js web application
├── mobile/          # Flutter mobile app
├── shared/          # Shared types and contracts
│   └── types/       # API contracts between backend & frontend
└── .github/         # CI/CD workflows
    └── workflows/
        ├── backend-ci.yml
        ├── web-ci.yml
        └── mobile-ci.yml
```

## Prerequisites

- [Bun](https://bun.sh/) >= 1.0.0
- [Flutter](https://flutter.dev/) >= 3.11.5
- [Git](https://git-scm.com/)

## Getting Started

### Initial Setup

1. Clone the repository:
```bash
git clone <your-repo-url>
cd atlasmed
```

2. Install all dependencies:
```bash
bun run install:all
```

This will install dependencies for both backend and web, and run `flutter pub get` for mobile.

### Development

#### Run Backend

```bash
bun run dev:backend
# or
cd backend && bun run dev
```

The backend API will start on the default port (check `backend/index.ts` for configuration).

#### Run Web App

```bash
bun run dev:web
# or
cd web && bun run dev
```

The web app will start at `http://localhost:3000`

#### Run Mobile App

```bash
bun run dev:mobile
# or
cd mobile && flutter run
```

Choose your target device when prompted.

### Working with Shared Types

The `shared/types/` directory contains TypeScript interfaces and types that are shared between backend and web.

**Import in Backend:**
```typescript
import type { User, CreateUserRequest } from '../../shared/types';
```

**Import in Web:**
```typescript
import type { User, CreateUserRequest } from '../../shared/types';
```

Keep this minimal - only add types that truly need to be shared between components.

## Building

### Build All (Backend + Web)

```bash
bun run build
```

### Build Individual Components

```bash
bun run build:backend
bun run build:web
bun run build:mobile
```

## Testing

### Run All Tests

```bash
bun run test
```

### Test Individual Components

```bash
bun run test:backend
bun run test:web
bun run test:mobile
```

## Linting

### Lint All Components

```bash
bun run lint
```

### Lint Individual Components

```bash
bun run lint:backend
bun run lint:web
bun run lint:mobile
```

## CI/CD

This monorepo uses **path-based triggers** for independent deployments:

- **Backend CI/CD** - Triggers on changes to `backend/**` or `shared/**`
- **Web CI/CD** - Triggers on changes to `web/**` or `shared/**`
- **Mobile CI/CD** - Triggers on changes to `mobile/**`

Each component deploys independently while sharing the same repository.

### Configuring Deployments

The GitHub Actions workflows are set up with placeholders for deployment. Configure your preferred platforms:

#### Self-Hosted with Uncloud (Recommended)
- **Uncloud** - Self-host with Docker Compose, automatic HTTPS via Caddy, zero-downtime deployments
- Full control over infrastructure with PaaS-like simplicity
- See [UNCLOUD_DEPLOYMENT.md](UNCLOUD_DEPLOYMENT.md) for complete setup guide

```bash
# Deploy entire stack with automatic HTTPS
uc compose up
```

#### Managed Platform Options

**Backend:**
- Railway
- Fly.io
- AWS / Google Cloud / Azure
- Heroku

Edit `.github/workflows/backend-ci.yml` and uncomment/configure the deployment section.

**Web:**
- Vercel (recommended for Next.js)
- Netlify
- AWS Amplify
- Cloudflare Pages

Edit `.github/workflows/web-ci.yml` and uncomment/configure the deployment section.

**Mobile:**
- TestFlight (iOS)
- Google Play Internal Testing (Android)

Edit `.github/workflows/mobile-ci.yml` and configure the deployment sections with your signing certificates and API keys.

## Repository Management

### Workspace Commands

The root `package.json` defines Bun workspaces for `backend` and `web`, enabling:

- Shared dependency management
- Faster installs with workspace linking
- Consistent versioning

### Adding Dependencies

**Backend:**
```bash
cd backend && bun add <package>
```

**Web:**
```bash
cd web && bun add <package>
```

**Mobile:**
```bash
cd mobile && flutter pub add <package>
```

### Cleaning Build Artifacts

```bash
bun run clean
```

This removes `node_modules`, build outputs, and `.next` directories.

## Development Workflow

1. Create a feature branch:
```bash
git checkout -b feature/your-feature-name
```

2. Make changes in the relevant component(s)

3. Test locally:
```bash
bun run test
```

4. Commit and push:
```bash
git add .
git commit -m "feat: your feature description"
git push origin feature/your-feature-name
```

5. Create a Pull Request on GitHub

6. CI will automatically run tests for the affected components

7. Once merged to `main`, only the changed components will deploy

## Environment Variables

Each component manages its own environment variables:

- **Backend**: Copy `backend/.env.example` to `backend/.env` and configure
- **Web**: Copy `web/.env.local.example` to `web/.env.local` and configure
- **Mobile**: Copy `mobile/.env.example` to `mobile/.env` and configure

**Important:** Never commit `.env` files to the repository. They are gitignored for security.

### Production Secrets Management

For production deployments, use **GitHub Secrets** (for CI/CD) and your deployment platform's secret management (for runtime).

**See [DEPLOYMENT.md](DEPLOYMENT.md) for comprehensive instructions on:**
- Setting up local development environment variables
- Configuring GitHub Secrets for CI/CD
- Managing production secrets in Railway, Vercel, Fly.io, etc.
- Security best practices for secrets management

## Contributing

As a solo developer project, maintain code quality by:

- Writing clear commit messages
- Testing changes before committing
- Keeping the monorepo structure clean
- Documenting significant changes

## Monorepo Benefits

This monorepo structure provides:

- **Single workspace** for the entire application
- **Shared types** between backend and frontend
- **Atomic commits** across multiple components
- **Independent deployments** with path-based CI/CD triggers
- **Less overhead** managing multiple repositories
- **Easier refactoring** when API contracts change

## Support

For issues or questions, create an issue in this repository.

## License

Private - All Rights Reserved
