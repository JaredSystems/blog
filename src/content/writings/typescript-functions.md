---
title: TypeScript Functions
description: One tiny function to prove Markdown works.
article_date: 2025-10-17
tags: [typescript, basics]
---

Testing

```ts
import { z } from "zod";

const User = z.object({
  username: z.string(),
});

// At runtime (when this code is run), the `User` schema
// stores some information to validate objects.
User.parse({ username: "Ludwig" });

// At compile-time, the `User` schema has a special Zod type which
// can be synthesized back into a regular Typescript type with
// `infer<...>`
type User = z.infer<typeof User>;
```
