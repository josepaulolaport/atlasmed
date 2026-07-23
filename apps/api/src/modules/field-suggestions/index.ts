import { Elysia } from "elysia";
import { fieldSuggestionsRoute } from "./infrastructure/routes/field-suggestions.route";

export const fieldSuggestions = new Elysia({
  name: "field-suggestions",
  detail: {
    tags: ["FieldSuggestions"],
  },
}).use(fieldSuggestionsRoute);
