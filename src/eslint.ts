// Flat ESLint config enforcing the baguette clean-code contract (see AGENTS.md).
// Zero plugins — every rule below is core ESLint, so it's a drop-in:
//
//   // eslint.config.js
//   import baguette from "baguette/eslint";
//   export default [...baguette];

const bannedSyntax = [
  {
    selector: "TSAsExpression > TSAnyKeyword, TSAsExpression > TSNeverKeyword",
    message: "No `as any` / `as never` in app code — fix the type at the source.",
  },
  {
    // c.req.json<T>() — bypasses the schema. Declare request.body instead.
    selector:
      "CallExpression[callee.property.name='json'] > TSTypeParameterInstantiation",
    message: "Don't hand-parse the body — declare request.body in defineRoute.",
  },
  {
    selector: "CallExpression[callee.property.name='all'][callee.object.name='app']",
    message: "No raw app.all — one defineRoute per file (raw handlers are the loader's job).",
  },
];

export default [
  {
    files: ["api/**/*.ts", "methods/**/*.ts", "cron/**/*.ts", "automations/**/*.ts", "lib/**/*.ts"],
    rules: {
      "no-console": "error", // use the exported logger
      "no-restricted-syntax": ["error", ...bannedSyntax],
    },
  },
  {
    // Webhooks are the blessed schema-less exception; allow the raw console there.
    files: ["api/**/webhooks/**/*.ts"],
    rules: { "no-console": "off" },
  },
];
