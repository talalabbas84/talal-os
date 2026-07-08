# Talal OS v3.0 — Unified Knowledge Graph Architecture

## Product direction

Talal OS is a personal operating system, not a set of disconnected CRUD pages.

Capture is the primary input. Pages are generated views into the same underlying personal knowledge graph:

- Dashboard: what matters now.
- Tasks: action items.
- People: relationship context.
- Learn: retained knowledge and reviews.
- Thoughts: raw thinking and idea evolution.
- Memory: long-term identity, principles, beliefs, values, lessons, preferences, patterns, goals, and decision history.
- Projects: hubs that connect tasks, ideas, learning, people, captures, decisions, memories, timeline, and activity.

Manual editing remains possible, but the default behavior is:

Capture → Understand → Extract entities → Link relationships → Plan actions → Preview → Approve → Execute → Update graph.

The AI never writes directly to the database. It proposes structured actions. The execution engine performs writes and graph updates.

## Core graph model

Existing domain tables remain the source of truth for their data. The graph layer links them.

### CaptureRecord

`CaptureRecord` persists approved captures after the user saves them. It stores:

- raw text
- understood/cleaned text
- summary
- inferred intent
- metadata about the action plan

This gives every downstream entity a stable source node.

### KnowledgeGraphEdge

`KnowledgeGraphEdge` stores relationships between any two entities without forcing every feature table to know about every other feature table.

Each edge has:

- source type/id
- relation
- target type/id
- confidence
- evidence
- metadata
- creator

This supports relationships such as:

- Capture → created Task
- Capture → created Event
- Event → scheduled with Person
- Thought → related Project
- Learning Item → related Project
- Memory → reinforced by Capture
- Memory → contradicted by Capture
- Person → linked Event
- Person → linked Thought
- Project → generated Thought

The current implementation starts with safe automatic edges:

- created entity → `CREATED_FROM` → capture
- event → `SCHEDULED_WITH` → person
- entity → `REFERENCES_PERSON` → person when a related person is known
- entity → `BELONGS_TO_PROJECT` → project when a project id is known

The edge list is intentionally generic so future entity types can join the graph without schema churn.

## Entity types

The graph abstraction supports these entity types:

- CAPTURE
- TASK
- PROJECT
- PERSON
- PERSON_INTERACTION
- PERSON_MEMORY
- PERSON_INSIGHT
- MEMORY
- THOUGHT
- THOUGHT_UNIT
- LEARNING_ITEM
- EVENT
- HABIT
- DAILY_LOG
- REMINDER
- FOLLOW_UP
- ACTIVITY
- QUESTION
- GROWTH_ITEM
- INBOX_ENTRY
- TIMELINE_EVENT
- REFLECTION

## Linking service

`src/lib/knowledge-graph/linking-service.ts` owns graph writes.

Responsibilities:

- create a capture record from approved capture actions
- collect entity refs during execution
- infer safe automatic links
- persist deduplicated graph edges

Rules:

- Link only after the execution engine has created or found real database records.
- Do not expose graph internals in Capture preview.
- Prefer no link over a wrong link.
- Store low-confidence future links as questions, not fake relationships.
- Do not overwrite old meaning; add new nodes/edges.

## Universal search

`src/lib/knowledge-graph/universal-search.ts` is the first search abstraction.

Current behavior:

- queries people, tasks, projects, memories, thoughts, learning items, events, and capture records
- returns normalized `UniversalSearchResult` objects
- keeps pages separate while allowing one search surface

Future behavior:

- expand from matched nodes through graph edges
- rank direct matches first, then related entities
- support temporal filters such as today, this week, and last month
- support graph queries such as “everything related to Michael” or “dance across my life”

Example:

Searching `Michael` should return:

- Person Michael
- events with Michael
- interactions with Michael
- person memories
- related follow-ups
- captures that created those records
- related thoughts, tasks, learning, or projects when linked

## Evolution model

Nothing important should be overwritten when Talal changes.

The graph supports evolution by creating new records and linking them with relations:

- `EVOLVES_FROM`
- `REINFORCES`
- `CONTRADICTS`
- `DUPLICATE_OF`

Examples:

- A 2025 memory says: “I think I give up.”
- A 2026 memory says: “I usually come back after breaks.”
- The 2026 memory links to the 2025 memory with `CONTRADICTS` or `EVOLVES_FROM`.

This preserves growth instead of replacing history.

## Page architecture

Pages should increasingly behave as generated graph views.

Tasks should filter action-item nodes.

People should show:

- profile fields
- interactions
- person memories
- events together
- follow-ups
- related projects
- related learning
- graph timeline

Learn should show:

- learning items
- review schedule
- related projects
- related captures
- quiz/review history
- graph connections to prior knowledge

Thoughts should show:

- raw thought
- cleaned thought
- summary
- related thoughts
- related projects
- related memories
- evolution over time

Projects should show:

- tasks
- ideas
- learning
- people
- captures
- decisions
- memories
- timeline
- activity

## Implementation boundary for v3.0

This version establishes the architecture and framework:

- persistent capture records
- generic graph edge table
- linking service abstraction
- universal search abstraction
- execution-engine integration for safe automatic links
- architecture documentation

It does not attempt to implement every possible relationship yet. Future releases can add richer linking rules incrementally without rewriting the existing domain models.
