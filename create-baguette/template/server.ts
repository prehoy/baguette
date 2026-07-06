import { serve } from "@prehoy/baguette";

// Every file in ./api becomes a typed, validated, documented endpoint.
// Interactive docs: http://localhost:3000/api/docs
serve({ routesDir: "./api" });
