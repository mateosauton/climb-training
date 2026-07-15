# Post-save session recommendation

## Goal

After a valid log is saved, clear all entered values and show a useful session assessment instead of log history.

## Design

- Keep saved logs in the existing user store so dashboard metrics continue to work.
- Replace the log history card with a recommendation card.
- Calculate an explainable 1–10 score from completion, effort relative to the planned intensity, pain, recovery, technical execution, and session output.
- Return a short summary plus prioritized coaching recommendations, with safety guidance taking priority when pain or recovery is poor.
- After save, hide the form and show the saved-session assessment with two choices: `Registrar otra sesión` resets to a fresh form; `Continuar` opens the dashboard.
- Reset every form field immediately after persistence, including notes, and clear validation errors.

## Error handling

Invalid values remain in the form with the existing field-range error. No assessment is shown and no log is saved.

## Testing

- Unit-test score bounds and recommendation priorities.
- Integration-test persistence, cleared inputs, removal of history, result display, and both post-save choices.
