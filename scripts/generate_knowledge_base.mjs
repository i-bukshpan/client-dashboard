#!/usr/bin/env node
/**
 * ============================================================
 * Nehemiah OS — Knowledge Base Generator for Text-to-SQL
 * ============================================================
 *
 * This script connects to the Supabase PostgreSQL database using
 * the service_role key and generates a comprehensive knowledge_base.json
 * containing:
 *   1. Schema: column names, data types, constraints
 *   2. Sample Data: 1 compact row per table (UUIDs & noisy columns stripped)
 *   3. Distinct Values: unique values for status/type/category/priority columns
 *   4. Relationships: foreign key mappings for JOIN queries
 *
 * Usage:
 *   node scripts/generate_knowledge_base.mjs
 *
 * The output file is saved to: scripts/knowledge_base.json
 */

import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

// ── Load .env.local ──────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "..", ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

// ── Supabase client with service_role (bypasses RLS) ────────
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ── Tables to SKIP (logs, receipts, tokens — low value for SQL) ─
const SKIP_TABLES = new Set([
  "notifications",
  "moshe_project_logs",
  "chat_read_receipts",
  "google_tokens",
]);

// ── Columns to strip from sample data (noisy / long) ───────
const STRIP_COLUMNS = new Set([
  "id",
  "created_by",
  "user_id",
  "assigned_to",
  "client_id",
  "employee_id",
  "conversation_id",
  "sender_id",
  "appointment_id",
  "project_id",
  "buyer_id",
  "updated_at",
  "created_at",
  "avatar_url",
  "drive_folder_id",
  "google_event_id",
  "access_token",
  "refresh_token",
  "expires_at",
  "metadata",
]);

// ── Tables to introspect ────────────────────────────────────
const TABLES = [
  "profiles",
  "clients",
  "appointments",
  "meeting_summaries",
  "tasks",
  "income",
  "expenses",
  "conversations",
  "chat_messages",
  "employee_bonuses",
  "goals",
  "recurring_finances",
  "employee_announcements",
  "moshe_projects",
  "moshe_project_payments",
  "moshe_buyers",
  "moshe_buyer_payments",
  "moshe_transactions",
  "moshe_calendar_events",
  "moshe_project_documents",
];

// ── Columns whose distinct values we want to capture ────────
const ENUM_COLUMN_KEYWORDS = [
  "status",
  "priority",
  "category",
  "type",
  "role",
  "risk_level",
  "advisory_track",
  "meeting_frequency",
];

// ── Foreign keys defined in migrations (manually mapped) ────
const FOREIGN_KEYS = [
  // profiles
  { table: "profiles", column: "id", references_table: "auth.users", references_column: "id" },

  // clients
  { table: "clients", column: "created_by", references_table: "profiles", references_column: "id" },
  { table: "clients", column: "user_id", references_table: "auth.users", references_column: "id" },

  // appointments
  { table: "appointments", column: "client_id", references_table: "clients", references_column: "id" },
  { table: "appointments", column: "employee_id", references_table: "profiles", references_column: "id" },

  // meeting_summaries
  { table: "meeting_summaries", column: "appointment_id", references_table: "appointments", references_column: "id" },

  // tasks
  { table: "tasks", column: "assigned_to", references_table: "profiles", references_column: "id" },
  { table: "tasks", column: "client_id", references_table: "clients", references_column: "id" },
  { table: "tasks", column: "created_by", references_table: "profiles", references_column: "id" },

  // income
  { table: "income", column: "client_id", references_table: "clients", references_column: "id" },
  { table: "income", column: "created_by", references_table: "profiles", references_column: "id" },

  // expenses
  { table: "expenses", column: "created_by", references_table: "profiles", references_column: "id" },

  // conversations
  { table: "conversations", column: "admin_id", references_table: "profiles", references_column: "id" },
  { table: "conversations", column: "employee_id", references_table: "profiles", references_column: "id" },

  // chat_messages
  { table: "chat_messages", column: "conversation_id", references_table: "conversations", references_column: "id" },
  { table: "chat_messages", column: "sender_id", references_table: "profiles", references_column: "id" },

  // employee_bonuses
  { table: "employee_bonuses", column: "employee_id", references_table: "profiles", references_column: "id" },
  { table: "employee_bonuses", column: "created_by", references_table: "profiles", references_column: "id" },

  // goals
  { table: "goals", column: "assigned_employee", references_table: "profiles", references_column: "id" },
  { table: "goals", column: "assigned_client", references_table: "clients", references_column: "id" },
  { table: "goals", column: "created_by", references_table: "auth.users", references_column: "id" },

  // recurring_finances
  { table: "recurring_finances", column: "client_id", references_table: "clients", references_column: "id" },
  { table: "recurring_finances", column: "created_by", references_table: "auth.users", references_column: "id" },

  // employee_announcements
  { table: "employee_announcements", column: "created_by", references_table: "auth.users", references_column: "id" },
  { table: "employee_announcements", column: "target_employee_id", references_table: "profiles", references_column: "id" },

  // chat_read_receipts
  { table: "chat_read_receipts", column: "message_id", references_table: "chat_messages", references_column: "id" },
  { table: "chat_read_receipts", column: "user_id", references_table: "profiles", references_column: "id" },

  // google_tokens
  { table: "google_tokens", column: "user_id", references_table: "profiles", references_column: "id" },

  // notifications
  { table: "notifications", column: "user_id", references_table: "profiles", references_column: "id" },

  // moshe_projects — no FK
  // moshe_project_payments
  { table: "moshe_project_payments", column: "project_id", references_table: "moshe_projects", references_column: "id" },

  // moshe_buyers
  { table: "moshe_buyers", column: "project_id", references_table: "moshe_projects", references_column: "id" },

  // moshe_buyer_payments
  { table: "moshe_buyer_payments", column: "buyer_id", references_table: "moshe_buyers", references_column: "id" },
  { table: "moshe_buyer_payments", column: "project_id", references_table: "moshe_projects", references_column: "id" },

  // moshe_transactions
  { table: "moshe_transactions", column: "project_id", references_table: "moshe_projects", references_column: "id" },

  // moshe_calendar_events — no FK

  // moshe_project_documents
  { table: "moshe_project_documents", column: "project_id", references_table: "moshe_projects", references_column: "id" },

  // moshe_project_logs
  { table: "moshe_project_logs", column: "project_id", references_table: "moshe_projects", references_column: "id" },
];

// ── Helpers ──────────────────────────────────────────────────

/**
 * Fetch column metadata for a table via a single-row query + introspection.
 * We use a raw RPC call to information_schema.
 */
async function getTableSchema(tableName) {
  // Use the Supabase REST API to get a single row — the response headers
  // don't give us schema, so we use an RPC approach or fallback.
  // Since we can't directly query information_schema via the REST API,
  // we'll get sample data and infer types, then enrich with our migration knowledge.
  const { data, error } = await supabase
    .from(tableName)
    .select("*")
    .limit(1);

  if (error) {
    console.warn(`  ⚠ Could not fetch schema for ${tableName}: ${error.message}`);
    return null;
  }

  if (!data || data.length === 0) {
    // Table exists but is empty — return column names from migration knowledge
    return [];
  }

  return Object.keys(data[0]);
}

/**
 * Fetch sample rows from a table (default: 1 row).
 */
async function getSampleData(tableName, limit = 1) {
  const { data, error } = await supabase
    .from(tableName)
    .select("*")
    .limit(limit);

  if (error) {
    console.warn(`  ⚠ Could not fetch sample data for ${tableName}: ${error.message}`);
    return [];
  }

  return data || [];
}

/**
 * Remove noisy columns (UUIDs, tokens, timestamps) from a sample row
 * so the output stays compact for the LLM context window.
 */
function sanitizeSampleRow(row) {
  const clean = {};
  for (const [key, value] of Object.entries(row)) {
    if (STRIP_COLUMNS.has(key)) continue;
    clean[key] = value;
  }
  return clean;
}

/**
 * Get distinct values for enum-like columns in a table.
 */
async function getDistinctValues(tableName, columns) {
  const distinctValues = {};

  for (const col of columns) {
    // Check if this column matches our enum keywords
    const isEnum = ENUM_COLUMN_KEYWORDS.some(
      (kw) => col === kw || col.endsWith(`_${kw}`) || col.startsWith(`${kw}_`)
    );

    if (!isEnum) continue;

    const { data, error } = await supabase
      .from(tableName)
      .select(col)
      .not(col, "is", null)
      .limit(500);

    if (error || !data) continue;

    const unique = [...new Set(data.map((row) => row[col]))].filter(Boolean).sort();
    if (unique.length > 0 && unique.length <= 50) {
      distinctValues[col] = unique;
    }
  }

  return distinctValues;
}

// ── Column type definitions from migrations ─────────────────
// This is the authoritative source of truth since we can't query
// information_schema through the Supabase REST API.
const COLUMN_TYPES = {
  profiles: {
    id: "UUID (PK)",
    full_name: "TEXT",
    role: "TEXT — CHECK ('admin', 'employee')",
    avatar_url: "TEXT",
    email: "TEXT",
    salary_base: "NUMERIC(12,2)",
    created_at: "TIMESTAMPTZ",
    updated_at: "TIMESTAMPTZ",
  },
  clients: {
    id: "UUID (PK)",
    name: "TEXT",
    email: "TEXT",
    phone: "TEXT",
    id_number: "TEXT",
    address: "TEXT",
    notes: "TEXT",
    drive_folder_id: "TEXT",
    created_by: "UUID (FK → profiles.id)",
    created_at: "TIMESTAMPTZ",
    birth_date: "DATE",
    portfolio_value: "NUMERIC(15,2)",
    client_since: "DATE",
    meeting_frequency: "TEXT",
    risk_level: "TEXT — CHECK ('low', 'medium', 'high', 'very_high')",
    advisory_goal: "TEXT",
    advisory_track: "TEXT",
    status: "TEXT — CHECK ('active', 'inactive', 'prospect', 'archived') — DEFAULT 'active'",
    user_id: "UUID (FK → auth.users.id)",
    updated_at: "TIMESTAMPTZ",
  },
  appointments: {
    id: "UUID (PK)",
    client_id: "UUID (FK → clients.id)",
    employee_id: "UUID (FK → profiles.id)",
    start_time: "TIMESTAMPTZ",
    end_time: "TIMESTAMPTZ",
    title: "TEXT",
    status: "TEXT — CHECK ('scheduled', 'done', 'cancelled') — DEFAULT 'scheduled'",
    notes: "TEXT",
    created_at: "TIMESTAMPTZ",
    updated_at: "TIMESTAMPTZ",
    google_event_id: "TEXT (UNIQUE)",
  },
  meeting_summaries: {
    id: "UUID (PK)",
    appointment_id: "UUID (FK → appointments.id)",
    notes: "TEXT",
    action_items: "JSONB — DEFAULT '[]'",
    created_at: "TIMESTAMPTZ",
  },
  tasks: {
    id: "UUID (PK)",
    title: "TEXT",
    description: "TEXT",
    status: "TEXT — CHECK ('todo', 'in_progress', 'done') — DEFAULT 'todo'",
    priority: "TEXT — CHECK ('low', 'medium', 'high', 'urgent') — DEFAULT 'medium'",
    due_date: "DATE",
    assigned_to: "UUID (FK → profiles.id)",
    client_id: "UUID (FK → clients.id)",
    created_by: "UUID (FK → profiles.id)",
    created_at: "TIMESTAMPTZ",
    updated_at: "TIMESTAMPTZ",
    archived: "BOOLEAN",
  },
  income: {
    id: "UUID (PK)",
    amount: "NUMERIC(12,2) — CHECK (amount > 0)",
    category: "TEXT — DEFAULT 'ייעוץ'",
    date: "DATE",
    client_id: "UUID (FK → clients.id)",
    notes: "TEXT",
    created_by: "UUID (FK → profiles.id)",
    created_at: "TIMESTAMPTZ",
  },
  expenses: {
    id: "UUID (PK)",
    amount: "NUMERIC(12,2) — CHECK (amount > 0)",
    category: "TEXT — DEFAULT 'כללי'",
    date: "DATE",
    notes: "TEXT",
    created_by: "UUID (FK → profiles.id)",
    created_at: "TIMESTAMPTZ",
  },
  conversations: {
    id: "UUID (PK)",
    admin_id: "UUID (FK → profiles.id)",
    employee_id: "UUID (FK → profiles.id)",
    created_at: "TIMESTAMPTZ",
  },
  chat_messages: {
    id: "UUID (PK)",
    conversation_id: "UUID (FK → conversations.id)",
    sender_id: "UUID (FK → profiles.id)",
    content: "TEXT",
    metadata: "JSONB",
    created_at: "TIMESTAMPTZ",
  },
  employee_bonuses: {
    id: "UUID (PK)",
    employee_id: "UUID (FK → profiles.id)",
    amount: "NUMERIC(12,2)",
    reason: "TEXT",
    date: "DATE",
    created_by: "UUID (FK → profiles.id)",
    created_at: "TIMESTAMPTZ",
  },
  goals: {
    id: "UUID (PK)",
    title: "TEXT",
    description: "TEXT",
    target_amount: "DECIMAL",
    current_amount: "DECIMAL — DEFAULT 0",
    target_date: "DATE",
    assigned_employee: "UUID (FK → profiles.id)",
    assigned_client: "UUID (FK → clients.id)",
    is_completed: "BOOLEAN — DEFAULT false",
    created_at: "TIMESTAMPTZ",
    created_by: "UUID (FK → auth.users.id)",
  },
  recurring_finances: {
    id: "UUID (PK)",
    type: "TEXT — CHECK ('income', 'expense')",
    amount: "DECIMAL",
    category: "TEXT",
    description: "TEXT",
    client_id: "UUID (FK → clients.id)",
    active: "BOOLEAN — DEFAULT true",
    created_at: "TIMESTAMPTZ",
    created_by: "UUID (FK → auth.users.id)",
  },
  employee_announcements: {
    id: "UUID (PK)",
    title: "TEXT",
    content: "TEXT",
    is_active: "BOOLEAN — DEFAULT true",
    created_at: "TIMESTAMPTZ",
    created_by: "UUID (FK → auth.users.id)",
    target_employee_id: "UUID (FK → profiles.id)",
  },
  chat_read_receipts: {
    id: "UUID (PK)",
    message_id: "UUID (FK → chat_messages.id)",
    user_id: "UUID (FK → profiles.id)",
    read_at: "TIMESTAMPTZ",
  },
  google_tokens: {
    user_id: "UUID (PK, FK → profiles.id)",
    access_token: "TEXT",
    refresh_token: "TEXT",
    expires_at: "BIGINT",
    created_at: "TIMESTAMPTZ",
  },
  notifications: {
    id: "UUID (PK)",
    user_id: "UUID (FK → profiles.id)",
    type: "TEXT — CHECK ('task_assigned', 'task_overdue', 'new_message', 'appointment_reminder', 'goal_updated', 'general')",
    title: "TEXT",
    body: "TEXT",
    link: "TEXT",
    read: "BOOLEAN — DEFAULT false",
    created_at: "TIMESTAMPTZ",
  },
  moshe_projects: {
    id: "UUID (PK)",
    name: "TEXT",
    address: "TEXT",
    contact_name: "TEXT",
    contact_phone: "TEXT",
    total_project_cost: "NUMERIC(15,2)",
    notes: "TEXT",
    status: "TEXT — CHECK ('active', 'pending', 'closed') — DEFAULT 'active'",
    start_date: "DATE",
    created_at: "TIMESTAMPTZ",
    drive_folder_url: "TEXT",
  },
  moshe_project_payments: {
    id: "UUID (PK)",
    project_id: "UUID (FK → moshe_projects.id)",
    amount: "NUMERIC(15,2)",
    due_date: "DATE",
    notes: "TEXT",
    is_paid: "BOOLEAN — DEFAULT false",
    paid_at: "TIMESTAMPTZ",
    created_at: "TIMESTAMPTZ",
  },
  moshe_buyers: {
    id: "UUID (PK)",
    project_id: "UUID (FK → moshe_projects.id)",
    name: "TEXT",
    phone: "TEXT",
    email: "TEXT",
    id_number: "TEXT",
    unit_description: "TEXT",
    contract_date: "DATE",
    total_amount: "NUMERIC(15,2)",
    notes: "TEXT",
    created_at: "TIMESTAMPTZ",
  },
  moshe_buyer_payments: {
    id: "UUID (PK)",
    buyer_id: "UUID (FK → moshe_buyers.id)",
    project_id: "UUID (FK → moshe_projects.id)",
    amount: "NUMERIC(15,2)",
    due_date: "DATE",
    notes: "TEXT",
    is_received: "BOOLEAN — DEFAULT false",
    received_at: "TIMESTAMPTZ",
    created_at: "TIMESTAMPTZ",
  },
  moshe_transactions: {
    id: "UUID (PK)",
    project_id: "UUID (FK → moshe_projects.id)",
    type: "TEXT — CHECK ('income', 'expense')",
    amount: "NUMERIC(15,2)",
    date: "DATE — DEFAULT CURRENT_DATE",
    category: "TEXT",
    notes: "TEXT",
    created_at: "TIMESTAMPTZ",
  },
  moshe_calendar_events: {
    id: "UUID (PK)",
    title: "TEXT",
    start_time: "TIMESTAMPTZ",
    end_time: "TIMESTAMPTZ",
    notes: "TEXT",
    type: "TEXT — CHECK ('meeting', 'reminder', 'other') — DEFAULT 'meeting'",
    created_at: "TIMESTAMPTZ",
  },
  moshe_project_documents: {
    id: "UUID (PK)",
    project_id: "UUID (FK → moshe_projects.id)",
    name: "TEXT",
    url: "TEXT",
    created_at: "TIMESTAMPTZ",
  },
  moshe_project_logs: {
    id: "UUID (PK)",
    project_id: "UUID (FK → moshe_projects.id)",
    actor: "TEXT — DEFAULT 'משה'",
    action: "TEXT",
    details: "TEXT",
    created_at: "TIMESTAMPTZ",
  },
};

// ── Main ─────────────────────────────────────────────────────
async function main() {
  console.log("🚀 Nehemiah OS — Knowledge Base Generator");
  console.log("==========================================\n");

  const knowledgeBase = {
    _meta: {
      description:
        "Nehemiah OS database schema knowledge base for Text-to-SQL. " +
        "Use this to generate accurate PostgreSQL queries against a Supabase database.",
      generated_at: new Date().toISOString(),
      database: "Supabase PostgreSQL",
      schema: "public",
      important_notes: [
        "All tables are in the 'public' schema.",
        "All primary keys are UUID type.",
        "Timestamps are TIMESTAMPTZ (ISO 8601 with timezone).",
        "Dates are DATE type (YYYY-MM-DD).",
        "Hebrew text is used for some values (e.g., income.category = 'ייעוץ').",
        "Use service_role key to bypass RLS when querying.",
        "For JOIN queries, match UUID foreign keys to the referenced table's 'id' column.",
      ],
    },
    tables: {},
    relationships: FOREIGN_KEYS,
    join_examples: [
      {
        description: "Get appointments with client names",
        sql: "SELECT a.*, c.name AS client_name FROM appointments a LEFT JOIN clients c ON a.client_id = c.id",
      },
      {
        description: "Get tasks assigned to employees with their names",
        sql: "SELECT t.*, p.full_name AS assigned_name FROM tasks t LEFT JOIN profiles p ON t.assigned_to = p.id",
      },
      {
        description: "Get income with client names",
        sql: "SELECT i.*, c.name AS client_name FROM income i LEFT JOIN clients c ON i.client_id = c.id",
      },
      {
        description: "Get all buyer payments for a specific project",
        sql: "SELECT bp.*, b.name AS buyer_name, mp.name AS project_name FROM moshe_buyer_payments bp JOIN moshe_buyers b ON bp.buyer_id = b.id JOIN moshe_projects mp ON bp.project_id = mp.id",
      },
      {
        description: "Get project financial summary (total payments vs total received)",
        sql: "SELECT mp.name, COALESCE(SUM(pp.amount) FILTER (WHERE pp.is_paid), 0) AS total_paid_expenses, COALESCE(SUM(bp.amount) FILTER (WHERE bp.is_received), 0) AS total_received_income FROM moshe_projects mp LEFT JOIN moshe_project_payments pp ON pp.project_id = mp.id LEFT JOIN moshe_buyer_payments bp ON bp.project_id = mp.id GROUP BY mp.id, mp.name",
      },
    ],
  };

  // Filter relationships to exclude skipped tables
  const activeRelationships = FOREIGN_KEYS.filter(
    (fk) => !SKIP_TABLES.has(fk.table) && !SKIP_TABLES.has(fk.references_table)
  );
  knowledgeBase.relationships = activeRelationships;

  for (const tableName of TABLES) {
    console.log(`📋 Processing: ${tableName}...`);

    // 1. Schema (from our migration definitions)
    const schema = COLUMN_TYPES[tableName] || {};

    // 2. Sample data — 1 row, sanitized
    const rawSample = await getSampleData(tableName, 1);
    const sampleData = rawSample.map(sanitizeSampleRow);

    // 3. Get columns from raw data or schema definition
    const columns = rawSample.length > 0 ? Object.keys(rawSample[0]) : Object.keys(schema);

    // 4. Distinct values for enum-like columns
    const distinctValues = await getDistinctValues(tableName, columns);

    // 5. Row count (approximate)
    const { count } = await supabase
      .from(tableName)
      .select("*", { count: "exact", head: true });

    // 6. Foreign keys for this table
    const fks = activeRelationships.filter((fk) => fk.table === tableName);

    knowledgeBase.tables[tableName] = {
      row_count: count || 0,
      schema,
      sample_data: sampleData.length > 0 ? sampleData : undefined,
      distinct_values: Object.keys(distinctValues).length > 0 ? distinctValues : undefined,
      foreign_keys: fks.length > 0 ? fks : undefined,
    };

    console.log(
      `   ✅ ${Object.keys(schema).length} cols, ${sampleData.length} sample, ` +
        `${Object.keys(distinctValues).length} enum, ${count || 0} rows`
    );
  }

  // ── Write output ────────────────────────────────────────────
  const outputPath = resolve(__dirname, "knowledge_base.json");
  writeFileSync(outputPath, JSON.stringify(knowledgeBase, null, 2), "utf-8");

  console.log(`\n✨ Done! Knowledge base saved to:\n   ${outputPath}`);
  console.log(`   File size: ${(JSON.stringify(knowledgeBase).length / 1024).toFixed(1)} KB`);
  console.log(`\n📌 Next step: Copy the contents of this file into your`);
  console.log(`   Gemini System Prompt in n8n for accurate Text-to-SQL.`);
}

main().catch((err) => {
  console.error("❌ Fatal error:", err);
  process.exit(1);
});
