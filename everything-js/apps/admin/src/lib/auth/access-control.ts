import { createAccessControl } from "better-auth/plugins"

// Matches the organization plugin's own default statements. Dynamic access
// control (custom, per-organization roles) requires this to be passed
// explicitly — it isn't inferred just from `dynamicAccessControl: { enabled: true }`.
export const statement = {
  organization: ["update", "delete"],
  member: ["create", "update", "delete"],
  invitation: ["create", "cancel"],
  team: ["create", "update", "delete"],
  ac: ["create", "read", "update", "delete"],
} as const

export const accessControl = createAccessControl(statement)
