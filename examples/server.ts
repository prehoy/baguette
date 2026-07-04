import { serve } from "../src/index";

// Drop a file in ./api, get a typed + documented endpoint. Docs at /api/docs.
serve({ routesDir: `${import.meta.dir}/api` });
