# Ava Generator auth preview TDZ fix

Fixes a runtime crash after the protected asset preview patch:

`ReferenceError: Cannot access 'st' before initialization`

Cause: the generator preview callbacks referenced `generatorPreviewObjectUrlsRef` and `generatorAssetPreviewMap` before their React hooks were initialized in `StandaloneGeneratorPage.jsx`.

Change: move the `useRef/useState` declarations above `ensureGeneratorAssetPreview` and remove the later duplicate declarations. No backend, persistence, credits, or notification logic is changed.
