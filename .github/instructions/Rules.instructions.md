---
description: Always read these instructions before generating code.
# applyTo: 'Describe when these instructions should be loaded by the agent based on task context' # when provided, instructions will automatically be added to the request context when the pattern matches an attached file
---

<!-- Tip: Use /create-instructions in chat to generate content with agent assistance -->

Provide project context and coding guidelines that AI should follow when generating code, answering questions, or reviewing changes.

Always use Tailwind for styling
Use Framer Motion for animations.
If something is incomplete, add a // TODO: comment instead of leaving broken code.
Always add aria-label / accessibility attributes on interactive elements
Use Tailwind utility classes only — no inline styles, no CSS modules
Mobile-first responsive design always.
Run Npm Lint before concluding a task is completed.