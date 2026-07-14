# Git workflow

`main` is the stable, deployable branch. `dev` is the integration branch for completed features. Feature work never commits directly to either long-lived branch.

## Branch path

```text
feature/*, fix/*, chore/*, docs/*
                  │
                  ▼
                 dev
                  │
                  ▼
                 main
```

## Start a feature

Always branch from an updated `dev`:

```bash
git switch dev
git pull --ff-only origin dev
git switch -c feature/short-description
```

Use `fix/*`, `chore/*`, or `docs/*` when those names describe the work better. Keep commits small and concise.

## Integrate a feature

Push the short-lived branch and open a pull request into `dev`:

```bash
git push -u origin feature/short-description
gh pr create --base dev --head feature/short-description
```

Merge only after Branch policy, Quality, and Browser tests pass. Delete the short-lived branch after merge.

## Promote a stable release

Open a pull request from `dev` into `main`:

```bash
gh pr create --base main --head dev
```

Only `dev` may target `main`. Merge after all required checks pass. Production deployments should track `main`; preview deployments may track feature branches or `dev`.

## Recover from a failed check

Fix the failure on the same short-lived branch, push again, and let CI rerun. Do not bypass `dev`, merge a broken check, or repair a feature directly on `main`.
