// The v2 app is fully client-side: its state lives in localStorage, so a
// server render always shows the defaults. Hydrating that markup against the
// loaded state lets input bindings clobber it (e.g. a stored layer color
// reverting to the default cyan). Render on the client only.
export const ssr = false;
