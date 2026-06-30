import { readFileSync, writeFileSync } from "fs";
import path from "path";

const file = path.resolve(import.meta.dir, "../prisma/schema.prisma");
let content = readFileSync(file, "utf8");

// Add @@schema("public") to enums that don't have @@schema
content = content.replace(
  /(enum \w+ \{[\s\S]*?)(\n\})/g,
  (match, body, close) => {
    if (body.includes('@@schema("public")')) return match;
    return `${body}\n  @@schema("public")${close}`;
  }
);

// Add @@schema("public") before @@map on models
content = content.replace(
  /(model \w+ \{[\s\S]*?)(  @@map\()/g,
  (match, body, mapStart) => {
    if (body.includes('@@schema("public")')) return match;
    return `${body}  @@schema("public")\n${mapStart}`;
  }
);

writeFileSync(file, content);
console.log("Added @@schema(public) annotations");
