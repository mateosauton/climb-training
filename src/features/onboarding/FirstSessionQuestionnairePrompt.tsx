import { ONBOARDING_COPY } from "./onboarding-copy";

export function FirstSessionQuestionnairePrompt({ onOpen }: { onOpen: () => void }) {
  return (
    <aside className="mx-auto mb-4 w-full max-w-3xl rounded-xl border border-border/70 bg-card px-4 py-4" data-testid="first-session-questionnaire">
      <h2 className="text-base font-semibold">{ONBOARDING_COPY.questionnairePromptTitle}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{ONBOARDING_COPY.questionnairePromptBody}</p>
      <button type="button" className="mt-3 text-sm font-semibold underline underline-offset-2" onClick={onOpen}>
        {ONBOARDING_COPY.questionnairePromptCta}
      </button>
    </aside>
  );
}
