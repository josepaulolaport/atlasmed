# ADR 0002: Decide Production Mobile Stack

## Status

Proposed

## Context

The current repository contains a Flutter starter app under `apps/mobile`. The target product preference is React Native with Expo to maximize shared TypeScript expertise and accelerate iteration across backend, web, and mobile.

## Decision

For production mobile development, prefer React Native with Expo unless a near-term native requirement makes Flutter or bare native a stronger choice.

## Rationale

- Shared TypeScript expertise across backend, web, and mobile.
- Faster iteration for product discovery and field workflows.
- Better alignment with shared validation schemas and API contracts.
- Expo provides a pragmatic starting point with native escape hatches.

## Consequences

- The existing Flutter starter should be treated as disposable unless explicitly retained.
- A migration/replacement plan is needed before mobile feature implementation.
- Any native-only requirements should be documented before choosing bare React Native.
