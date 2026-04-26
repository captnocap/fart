# Agentic IDE & AI Workspace: Comprehensive Data Shape Specification

> An overly-scoped type system catalog for parallel multi-agent collaboration, recurring memory, and multi-domain intelligence. Pick and choose what fits your architecture.

---

## 1. Identity, Agent Model & Actor Resolution

Every action in the agentic workspace — human keystroke, agent plan, CI webhook — originates from an **Actor**. This chapter defines the foundational identity layer: participating entities, capability descriptions, and authority flows. All subsequent shapes carry an `actorId` referencing types defined here. A single polymorphic root with type-specific extensions enables uniform permission checking, provenance tracing, and shared presence semantics.

### 1.1 Core Identity Primitives

#### 1.1.1 Actor

The Actor is the universal base entity for every participant that generates events, holds permissions, or appears in presence channels. The `actorType` discriminator determines which extension table — Agent, User, ServiceIdentity, or ActorGroup — holds type-specific data.

```typescript
interface Actor {
  /** Primary identifier — referenced by every event, memory entry, and permission check */
  id: UUID;
  /** Polymorphic discriminator: 'user' | 'agent' | 'service' | 'group' */
  actorType: ActorType;
  /** Display name in UI, mention syntax, and log entries */
  displayName: string;
  /** Unique handle for @mentions (workspace-scoped uniqueness) */
  handle: string;
  /** Reference to the MemoryProfile (Chapter 2) holding recurring memory */
  memoryProfileId: UUID;
  /** Current presence state across all workspaces */
  presence: PresenceState;
  /** Aggregated trust score (0.0–1.0) from delegation history and outcome quality */
  trustScore: number;
  /** Actor that created this identity (system-rooted for top-level actors) */
  createdBy: UUID;
  /** When this identity was established */
  createdAt: Timestamp;
  /** Optimistic concurrency version */
  version: number;
  /** Extension data for platform-specific attributes */
  metadata: Record<string, unknown>;
}
```

**Key design notes.** The `trustScore` reflects learned confidence across all interactions — distinct from DelegationGraph trust (relationship-specific) and per-skill proficiency (on CapabilityFingerprint). The `memoryProfileId` binding ensures that if an agent is terminated and respawned, its accumulated memory context remains reachable via the same profile. Presence is first-class because real-time awareness drives UI rendering, workstream allocation, and notification routing.

#### 1.1.2 Agent

The Agent is the central autonomous actor — capable of independent reasoning, parallel workstream execution, delegation, and self-modification within policy bounds. It maintains continuous activity loops: monitoring workstreams, evaluating initiative triggers, and spawning sub-agents when capacity exhausts. The shape captures the full lifecycle from spawn through active operation, suspension, and termination.

```typescript
interface Agent {
  /** Reference to base Actor */
  actorId: UUID;
  /** Lifecycle state machine value */
  lifecycle: 'spawning' | 'active' | 'suspended' | 'terminating' | 'terminated';
  /** Persona governing behavior */
  personaId: UUID;
  /** Maximum parallel workstreams */
  maxConcurrentWorkstreams: number;
  /** Currently allocated workstreams (derived for fast scheduling) */
  activeWorkstreamCount: number;
  /** Whether this agent can spawn child agents */
  canSpawnAgents: boolean;
  /** Delegation depth permitted (0 = none) */
  maxDelegationDepth: number;
  /** Maximum trust this agent can assign to delegates */
  maxDelegatedTrust: number;
  /** Self-modification policy bounds */
  selfModificationPolicy: SelfModificationPolicy;
  /** Weighted score (0.0–1.0) from historical task quality */
  trustScore: number;
  /** Model provider, name, temperature, etc. */
  modelConfig: ModelConfiguration;
  /** Cost tracking */
  costBudget: CostBudget;
  /** Agents spawned by this one (provenance chain) */
  spawnedAgentIds: UUID[];
  /** Parent agent if spawned */
  parentAgentId?: UUID;
  /** Ephemeral reasoning for current work */
  currentReasoningChain: ReasoningStep[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

interface SelfModificationPolicy {
  allowPersonaMutation: boolean;
  /** Max persona trait percentage modifiable per session */
  personaMutationBudget: number;
  allowModelConfigMutation: boolean;
  allowSkillAcquisition: boolean;
  /** Approval level for self-modifications */
  approvalRequired: 'none' | 'low_risk_only' | 'all';
}
```

**Key design notes.** Lifecycle transitions may be triggered by policy violations, budget exhaustion, or human intervention. The `SelfModificationPolicy` is granular because unconstrained self-modification introduces compounding risk — `personaMutationBudget` prevents drift from chartered behavior. Separating `maxConcurrentWorkstreams` from `activeWorkstreamCount` enables rapid scheduling without joining workstream tables.

#### 1.1.3 User

The User represents the human participant — ultimate approval authority, notification recipient, and holder of explicit permission grants that agents cannot autonomously obtain. This shape bridges external identity providers with workspace-local preference state.

```typescript
interface User {
  actorId: UUID;
  /** External identity providers (SSO, OAuth, SAML) */
  authProviders: AuthProviderBinding[];
  email: string;
  sessionPreferences: SessionPreferences;
  notificationSettings: NotificationSettings;
  /** Positive-only grants — default-deny model */
  explicitPermissions: PermissionGrant[];
  /** Default workspace on login */
  defaultWorkspaceId?: UUID;
  isSystemAdmin: boolean;
  preferredLanguage: string;
  timezone: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

interface PermissionGrant {
  /** namespace:action format */
  permission: string;
  scopeType: 'workspace' | 'project' | 'system';
  scopeId?: UUID;
  expiresAt?: Timestamp;
  /** Whether agents acting for this user can exercise this grant */
  delegable: boolean;
}
```

**Key design notes.** The `delegable` flag on each PermissionGrant determines whether an agent acting on the user's behalf can exercise that permission, directly feeding into DelegationGraph construction. Multiple `AuthProviderBinding` entries support enterprise SSO alongside personal OAuth accounts.

#### 1.1.4 ServiceIdentity

ServiceIdentity covers non-agent backend services — search indexers, CI triggers, analytics pipelines — with capability declarations but no memory, conversational state, or autonomous agency. They emit events and receive work items but do not reason, delegate, or appear in presence channels.

```typescript
interface ServiceIdentity {
  actorId: UUID;
  capabilities: ServiceCapability[];
  inboundProtocol: 'webhook' | 'queue' | 'grpc' | 'rest';
  endpoint: string;
  healthStatus: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  /** Max throughput (requests/min) */
  rateLimit: number;
  /** Average latency for capacity planning (ms) */
  typicalLatencyMs: number;
  /** Event types this service may emit */
  emittedEventTypes: string[];
  circuitBreaker: CircuitBreakerState;
  registeredAt: Timestamp;
  lastHealthCheckAt?: Timestamp;
}

interface ServiceCapability {
  id: UUID;
  name: string;
  action: string;
  inputSchemaUri: string;
  outputSchemaUri: string;
  available: boolean;
}

interface CircuitBreakerState {
  state: 'closed' | 'open' | 'half_open';
  failureCount: number;
  lastFailureAt?: Timestamp;
  openedAt?: Timestamp;
}
```

**Key design notes.** `CircuitBreakerState` is stored inline because service health directly affects workstream scheduling. Services lack `trustScore` because they execute deterministic operations against declared schemas. `rateLimit` and `typicalLatencyMs` feed into the scheduler's capacity model.

---

### 1.2 Agent Profiles, Personas & Capabilities

#### 1.2.1 Persona

A Persona is a versioned behavioral configuration agents reference for communication, reasoning, and collaboration patterns. Separating Persona from Agent enables sharing across agents (e.g., one "careful reviewer" applied to five parallel agents) and independent evolution.

```typescript
interface Persona {
  id: UUID;
  name: string;
  /** Semantic version */
  version: string;
  /** Lineage reference for A/B testing and rollback */
  parentPersonaId?: UUID;
  voiceStyle: 'concise' | 'elaborate' | 'socratic' | 'instructional' | 'collaborative';
  thinkingStyle: 'step_by_step' | 'intuitive' | 'first_principles' | 'pattern_matching' | 'adversarial';
  /** Threshold (0.0–1.0) below which the agent asks before acting */
  initiativeThreshold: number;
  proactivityLevel: 'reactive' | 'contextual' | 'proactive' | 'anticipatory';
  collaborationMode: 'independent' | 'consultative' | 'consensus_seeking' | 'competitive';
  verbosityRules: VerbosityRule[];
  /** Explicit constraints (e.g., "never modify production configs") */
  constraints: string[];
  /** Context window priority for attention allocation */
  priorityHints: PriorityHint[];
  defaultModelConfig: ModelConfiguration;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: UUID;
}

interface VerbosityRule {
  context: string;
  level: 'minimal' | 'moderate' | 'detailed' | 'exhaustive';
}

interface PriorityHint {
  contextType: 'recent_memory' | 'relevant_skill' | 'workspace_state' | 'conversation_history' | 'explicit_goal';
  weight: number;
}
```

**Key design notes.** `initiativeThreshold` is the primary behavioral dial: at 0.9 the agent asks before most actions; at 0.1 it acts autonomously. `collaborationMode` determines ActorGroup behavior — `competitive` challenges peers while `consensus_seeking` works toward agreement. Version lineage enables A/B testing and rollback.

#### 1.2.2 Skill

Skill is the atomic unit of capability — a declarative action description with input/output schemas, prerequisite chains, proficiency tracking, and few-shot examples. Skills enable automatic agent-to-work matching and capability discovery.

```typescript
interface Skill {
  id: UUID;
  name: string;
  /** Namespaced action (e.g., "code:refactor") */
  action: string;
  domain: 'code' | 'design' | 'research' | 'planning' | 'communication' | 'analysis' | 'infrastructure' | 'custom';
  description: string;
  inputSchema: JSONSchema;
  outputSchema: JSONSchema;
  prerequisiteSkillIds: UUID[];
  sideEffects: SideEffectDeclaration[];
  fewShotExamples: SkillExample[];
  delegable: boolean;
  typicalCostEstimate: CostEstimate;
  requiresApproval: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: UUID;
}

interface SkillExample {
  input: unknown;
  output: unknown;
  reasoning: string;
}

interface SideEffectDeclaration {
  type: 'file_write' | 'api_call' | 'state_mutation' | 'notification' | 'agent_spawn';
  description: string;
  reversible: boolean;
}

interface CostEstimate {
  estimatedTokens: number;
  estimatedTimeSeconds: number;
  estimatedCostUsd: number;
}
```

**Key design notes.** Namespacing on `action` prevents collisions — `code:refactor` and `design:refactor` are distinct. `SideEffectDeclaration` is essential for safety: agents inspect side effects before invocation to decide if human approval is warranted. `prerequisiteSkillIds` enables skill trees for learning paths and skill-gap analysis during delegation planning.

#### 1.2.3 CapabilityFingerprint

CapabilityFingerprint is a dynamic, per-actor representation of demonstrated abilities — distinct from the static Skill registry. While Skill defines what CAN be done in the abstract, this shape tracks what a SPECIFIC actor has proven it can do, with measured proficiency and latent capabilities (predicted reachable but unproven). The scheduler consults this shape when assigning work.

```typescript
interface CapabilityFingerprint {
  actorId: UUID;
  /** Embedding for similarity-based matching */
  capabilityEmbedding: Vector;
  /** Proven skills with measured proficiency */
  demonstratedSkills: DemonstratedSkill[];
  /** Predicted reachable but unproven skills */
  latentCapabilities: LatentCapability[];
  /** Composite scores by domain */
  domainProficiency: DomainProficiency[];
  trackRecord: TrackRecordSummary;
  lastUpdatedAt: Timestamp;
  version: number;
}

interface DemonstratedSkill {
  skillId: UUID;
  proficiencyLevel: number;
  assessmentMethod: 'demonstrated' | 'inferred' | 'self_reported' | 'evaluated';
  invocationCount: number;
  recentSuccessRate: number;
  lastUsedAt: Timestamp;
  recencyScore: number;
}

interface LatentCapability {
  skillId: UUID;
  confidence: number;
  inferenceBasis: 'similarity' | 'prerequisite_chain' | 'transfer_learning';
  supportingSkillIds: UUID[];
}

interface DomainProficiency {
  domain: string;
  aggregateScore: number;
  skillCount: number;
  topSkillIds: UUID[];
}

interface TrackRecordSummary {
  totalInvocations: number;
  overallSuccessRate: number;
  tasksCompleted: number;
  tasksFailed: number;
  averageQualityScore: number;
  totalCostIncurred: number;
}
```

**Key design notes.** `capabilityEmbedding` enables semantic search: when no agent has demonstrated a required skill, the system finds agents with capability vectors closest to the skill's embedding. `LatentCapability` flags expansion opportunities rather than certifying competence. Track record is denormalized for fast scheduling queries.

---

### 1.3 Delegation, Teams & Provenance

#### 1.3.1 DelegationGraph

The DelegationGraph encodes directed authority relationships for handing off work. It is a runtime structure — not a static org chart — evolving as agents spawn children or have authority revoked. Each edge carries skill scoping, depth limits, trust scores, and temporal validity. Cycle detection prevents infinite delegation loops.

```typescript
interface DelegationGraph {
  id: UUID;
  scopeType: 'workspace' | 'project' | 'task' | 'conversation';
  scopeId: UUID;
  edges: DelegationEdge[];
  maxAllowedDepth: number;
  hasCycle: boolean;
  enforcementMode: 'strict' | 'permissive' | 'audit_only';
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

interface DelegationEdge {
  id: UUID;
  fromActorId: UUID;
  toActorId: UUID;
  /** Delegated skills (empty = all) */
  delegatedSkillIds: UUID[];
  maxDepth: number;
  /** Trust the delegator assigns (0.0–1.0) */
  trustScore: number;
  validFrom: Timestamp;
  validUntil?: Timestamp;
  /** Whether delegatee can further delegate */
  transitive: boolean;
  revocationConditions: RevocationCondition[];
  active: boolean;
  modificationLog: DelegationModification[];
}

interface RevocationCondition {
  type: 'trust_drops_below' | 'task_failed' | 'budget_exceeded' | 'manual' | 'expiry';
  threshold?: number;
}

interface DelegationModification {
  modifiedAt: Timestamp;
  modifiedBy: UUID;
  changeType: 'created' | 'trust_updated' | 'revoked' | 'extended';
  previousValue?: Record<string, unknown>;
}
```

**Key design notes.** DelegationGraphs are scoped — authority does not blanket-transfer across unrelated workspaces. `hasCycle` is recomputed on every edge mutation: forbidden in `strict` mode, logged in `audit_only`. `RevocationCondition` enables automatic cleanup on trust drops or budget exhaustion, preventing zombie authority. Trust is directional: Alice may trust Bob at 0.9 for code review but 0.3 for infrastructure changes, expressed via separate edges.

#### 1.3.2 ActorGroup

ActorGroup represents a team or ensemble collaborating toward a shared objective. Unlike ad-hoc mentions, a group has structure: communication protocol, consensus mechanism, shared memory space, and dissolution criteria for automatic cleanup. Groups support mixed membership — humans, agents, and nested groups.

```typescript
interface ActorGroup {
  id: UUID;
  name: string;
  purpose: string;
  members: GroupMember[];
  communicationProtocol: CommunicationProtocol;
  consensusMechanism: ConsensusMechanism;
  /** Reference to shared memory space (Chapter 2) */
  sharedMemorySpaceId: UUID;
  parentGroupId?: UUID;
  childGroupIds: UUID[];
  dissolutionCriteria: DissolutionCriterion[];
  active: boolean;
  maxMembers: number;
  createdAt: Timestamp;
  dissolvedAt?: Timestamp;
  createdBy: UUID;
}

interface GroupMember {
  actorId: UUID;
  role: string;
  permissionLevel: 'observer' | 'contributor' | 'moderator' | 'leader';
  joinedAt: Timestamp;
}

interface CommunicationProtocol {
  topology: 'broadcast' | 'hierarchical' | 'mesh' | 'star' | 'ring';
  hubActorId?: UUID;
  persistMessages: boolean;
  routingRules: RoutingRule[];
}

interface ConsensusMechanism {
  type: 'unanimous' | 'majority' | 'leader_decides' | 'weighted_vote' | 'no_consensus_required';
  votingWeights?: Record<UUID, number>;
  timeoutSeconds: number;
  fallback: 'escalate_to_leader' | 'defer_to_human' | 'proceed_without' | 'dissolve_group';
}

interface DissolutionCriterion {
  type: 'task_completed' | 'all_members_left' | 'explicit' | 'timeout' | 'goal_achieved';
  parameter?: string;
  timeoutAt?: Timestamp;
}

interface RoutingRule {
  eventType: string;
  targetSelector: 'all' | 'leader' | 'role' | 'specific_actor';
  targetId?: UUID;
  targetRole?: string;
}
```

**Key design notes.** The `topology` shapes information flow: `star` routes through a coordinator (review workflows), `mesh` enables peer-to-peer collaboration (brainstorming). `ConsensusMechanism` with `fallback` prevents deadlocks — on timeout, the fallback determines whether the leader decides, a human is consulted, or the group dissolves. Task-scoped groups auto-cleanup on completion via dissolution criteria.

#### 1.3.3 RoleAssignment

RoleAssignment binds an actor to a role within a specific context — workspace, project, task, or conversation. Unlike group membership (team participation), role assignment is about authority and responsibility. The same actor can hold different roles in different scopes simultaneously, with temporal expiry enabling time-bound grants that auto-revoke.

```typescript
interface RoleAssignment {
  id: UUID;
  actorId: UUID;
  roleDefinitionId: UUID;
  scopeType: 'workspace' | 'project' | 'task' | 'conversation';
  scopeId: UUID;
  grantedBy: UUID;
  grantedAt: Timestamp;
  expiresAt?: Timestamp;
  active: boolean;
  revocation?: RoleRevocation;
  /** Whether agents acting for this actor can assume this role */
  delegable: boolean;
  /** Denormalized for fast access control checks */
  effectivePermissions: string[];
  history: RoleAssignmentHistory[];
}

interface RoleRevocation {
  revokedBy: UUID;
  revokedAt: Timestamp;
  reason: string;
  /** Whether revocation cascades to delegated permissions */
  cascadeToDelegations: boolean;
}

interface RoleAssignmentHistory {
  modifiedAt: Timestamp;
  modifiedBy: UUID;
  changeType: 'created' | 'extended' | 'revoked' | 'permission_modified';
  previousExpiresAt?: Timestamp;
  previousPermissions?: string[];
}
```

**Key design notes.** RoleAssignment is decoupled from ActorGroup membership — an actor can belong to a group without a role, or hold a role without group membership. `effectivePermissions` is denormalized because access control checks happen frequently. Temporal expiry is essential: "Tech Lead" authority should not persist after a project ends. The `cascadeToDelegations` flag prevents privilege escalation through delegation of revoked authority.


## 2. Memory Systems & Knowledge Persistence

Memory transforms isolated agent interactions into cumulative capability. This chapter defines a four-tier memory architecture — working, episodic, semantic, and procedural — together with indexing, retrieval, and cross-session continuity mechanisms. Every shape embodies boundedness: finite capacity, explicit eviction policies, and measurable fidelity.

### 2.1 Memory Tiers & Lifecycle

#### 2.1.1 MemoryProfile

MemoryProfile is the root container for all memory stores belonging to a single actor. It holds references to tier-specific stores, tracks consolidation state, and enforces a global token budget. Without this container, memory stores would be orphaned fragments with no ownership lineage.

```typescript
interface MemoryProfile {
  /** Unique identifier — typically 1:1 with an Actor */
  id: UUID;
  /** The actor that owns this memory profile */
  actorId: UUID;
  /** Reference to the working memory store */
  workingMemoryId: UUID;
  /** References to episodic memory records, ordered by recency */
  episodicMemoryIds: UUID[];
  /** References to semantic knowledge entries */
  semanticMemoryIds: UUID[];
  /** References to procedural skill memories */
  proceduralMemoryIds: UUID[];
  /** Consolidation lifecycle state */
  consolidationStatus: 'idle' | 'scheduled' | 'running' | 'stalled';
  /** Most recent consolidation job */
  lastConsolidationJobId?: UUID;
  /** Global memory budget in tokens */
  totalTokenBudget: number;
  /** Current utilization ratio, 0.0 to 1.0+ */
  utilizationRatio: number;
  /** Tier priority weights for retention: episodic, semantic, procedural */
  tierRetentionWeights: [number, number, number];
  /** Whether cross-session continuity is enabled */
  continuityEnabled: boolean;
  /** Reference to the continuity anchor */
  continuityAnchorId?: UUID;
  /** Timestamp of profile creation */
  createdAt: Timestamp;
  /** Timestamp of last memory write across any tier */
  lastWriteAt: Timestamp;
  /** Schema version for migration tracking */
  schemaVersion: string;
}
```

**Design Notes.** The `tierRetentionWeights` tuple allows differentiated survival priorities: research agents weight semantic highest; creative agents may prioritize episodic. The `totalTokenBudget` enforces boundedness at the actor level, preventing monopolization of platform resources.

#### 2.1.2 WorkingMemory

WorkingMemory models bounded attention with strictly limited token capacity. It implements ranked slots competing for position via relevance scoring, with lowest-ranked candidates evicted when capacity is exceeded. The context stack enables nested parallel work: agents push frames when spawning sub-tasks and pop back to restore parent focus without context loss.

```typescript
interface WorkingMemory {
  /** Unique identifier */
  id: UUID;
  /** The actor whose attention this represents */
  actorId: UUID;
  /** Maximum token capacity — hard ceiling */
  capacityTokens: number;
  /** Currently consumed tokens */
  currentTokenUsage: number;
  /** Ranked slots ordered by relevanceScore descending */
  slots: WorkingMemorySlot[];
  /** Maximum number of slots permitted */
  maxSlotCount: number;
  /** Context stack for nested task handling */
  contextStack: ContextFrame[];
  /** Slot currently receiving focused attention */
  focusedSlotId?: UUID;
  /** Whether currently in a nested state */
  isNested: boolean;
  /** Stack depth — 0 means root context */
  nestingDepth: number;
  /** Eviction strategy */
  evictionPolicy: 'lru' | 'relevance' | 'hybrid';
  /** Instantiation timestamp */
  createdAt: Timestamp;
  /** Last modification timestamp */
  lastModifiedAt: Timestamp;
}

interface WorkingMemorySlot {
  /** Unique slot identifier */
  id: UUID;
  /** Raw content — memory reference, text fragment, or structured data */
  content: string;
  /** Estimated token count */
  tokenCount: number;
  /** Relevance score driving rank and eviction, 0.0 to 1.0 */
  relevanceScore: number;
  /** Source memory reference if derived from persistent storage */
  sourceMemoryId?: UUID;
  /** Source tier type */
  sourceTier?: 'episodic' | 'semantic' | 'procedural' | 'external';
  /** Access count since creation */
  accessCount: number;
  /** Timestamp of last access — drives LRU */
  lastAccessedAt: Timestamp;
  /** Auto-expiration time in milliseconds */
  ttlMs?: number;
}

interface ContextFrame {
  /** Frame identifier */
  id: UUID;
  /** Label for the nested task */
  taskLabel: string;
  /** Slot IDs active when the frame was pushed */
  savedSlotIds: UUID[];
  /** Previously focused slot */
  previousFocusSlotId?: UUID;
  /** When this frame was pushed */
  pushedAt: Timestamp;
}
```

**Design Notes.** The `contextStack` enables parallel multi-agent delegation: push before spawning a sub-task, restore focus upon completion. `ttlMs` supports automatic expiration of transient observations. The `hybrid` eviction policy combines recency and relevance.

#### 2.1.3 EpisodicMemory

EpisodicMemory captures discrete experiences with emotional valence, importance scoring, temporal chaining, and multi-actor provenance. Each record participates in a forgetting curve modeled on exponential decay: accessibility erodes over time unless reinforced by access or high initial importance. Temporal chaining links sequential events into narrative threads for session reconstruction.

```typescript
interface EpisodicMemory {
  /** Unique identifier */
  id: UUID;
  /** Owning actor */
  actorId: UUID;
  /** Natural language description of the experience */
  description: string;
  /** Dense vector embedding for semantic retrieval */
  embedding: Vector;
  /** Emotional valence: -1.0 (strongly negative) to +1.0 (strongly positive) */
  valence: number;
  /** Importance influencing decay and consolidation priority, 0.0 to 1.0 */
  importance: number;
  /** Current accessibility after forgetting decay, 0.0 to 1.0 */
  accessibilityScore: number;
  /** Decay factor — higher means faster forgetting */
  decayFactor: number;
  /** Number of retrievals */
  accessCount: number;
  /** When the experience occurred */
  occurredAt: Timestamp;
  /** Timestamp of most recent access */
  lastAccessedAt: Timestamp;
  /** Previous episode in temporal chain */
  previousEpisodeId?: UUID;
  /** Next episode in temporal chain */
  nextEpisodeId?: UUID;
  /** Actors who participated or observed */
  participantActorIds: UUID[];
  /** Workspace session */
  sessionId: UUID;
  /** Categorical tags */
  tags: string[];
  /** Whether consolidated into semantic or procedural form */
  isConsolidated: boolean;
  /** IDs of derived semantic/procedural memories */
  derivedMemoryIds: UUID[];
  /** Original raw observation */
  rawObservation?: string;
  /** Record creation timestamp */
  createdAt: Timestamp;
}
```

**Design Notes.** The `decayFactor` is per-memory, supporting different agent forgetfulness profiles. Valence enables emotional reasoning — agents learn to avoid negative patterns. The doubly-linked temporal chain supports efficient chronological traversal. `isConsolidated` prevents duplicate distillation.

#### 2.1.4 SemanticMemory

SemanticMemory encodes factual knowledge as subject-predicate-object triples with confidence scoring, verification status, and contradiction detection. Where episodic memory records "I debugged the auth service," semantic memory extracts "Auth service has average debug latency of N." Contradiction detection flags when new triples conflict with existing knowledge, triggering resolution workflows.

```typescript
interface SemanticMemory {
  /** Unique identifier */
  id: UUID;
  /** Owning actor */
  actorId: UUID;
  /** Subject of the knowledge triple */
  subject: string;
  /** Predicate relating subject to object */
  predicate: string;
  /** Object of the knowledge triple */
  object: string;
  /** Dense vector embedding of the combined triple */
  embedding: Vector;
  /** Confidence score, 0.0 to 1.0 */
  confidence: number;
  /** How this knowledge was validated */
  verificationStatus: 'unverified' | 'agent_inferred' | 'human_confirmed' | 'test_validated' | 'deprecated';
  /** Distinct observations reinforcing this triple */
  reinforcementCount: number;
  /** Episodic memories contributing evidence */
  sourceEpisodeIds: UUID[];
  /** Semantic memories contradicting this triple */
  contradictingMemoryIds: UUID[];
  /** Whether involved in unresolved contradiction */
  hasActiveContradiction: boolean;
  /** Timestamp of last reinforcement */
  lastReinforcedAt: Timestamp;
  /** Derivation explanation */
  provenanceNote?: string;
  /** Domain classification */
  domainTags: string[];
  /** Whether from external source vs. learned */
  isExternalKnowledge: boolean;
  /** Expiry after which re-verification required */
  expiresAt?: Timestamp;
  /** Record creation timestamp */
  createdAt: Timestamp;
}
```

**Design Notes.** `contradictingMemoryIds` enables proactive conflict detection: inserting a triple with matching subject-predicate but different object creates mutual references. `expiresAt` is critical for time-sensitive knowledge like API behaviors and library versions. `reinforcementCount` drives Bayesian confidence updates.

#### 2.1.5 ProceduralMemory

ProceduralMemory captures how-to knowledge — action sequences, execution traces, step-level fallbacks, and learned variations. Each procedure includes ordered steps, historical traces grounding instructions in real outcomes, recursive fallback alternatives, and statistical success rates. Learned variations encode context-specific adaptations discovered through repetition.

```typescript
interface ProceduralMemory {
  /** Unique identifier */
  id: UUID;
  /** Owning actor */
  actorId: UUID;
  /** Procedure name */
  name: string;
  /** Description of what this accomplishes */
  description: string;
  /** Dense vector embedding */
  embedding: Vector;
  /** Ordered steps of primary execution path */
  steps: ProceduralStep[];
  /** Historical executions */
  executionTraces: ExecutionTrace[];
  /** Overall success rate, 0.0 to 1.0 */
  successRate: number;
  /** Total invocations */
  invocationCount: number;
  /** Contextual adaptations */
  learnedVariations: LearnedVariation[];
  /** Preconditions for applicability */
  preconditions: string[];
  /** Postconditions after success */
  postconditions: string[];
  /** Estimated token cost */
  estimatedCostTokens?: number;
  /** Estimated duration in milliseconds */
  estimatedDurationMs?: number;
  /** Episodic memories this was distilled from */
  sourceEpisodeIds: UUID[];
  /** Whether human-reviewed */
  isHumanVerified: boolean;
  /** Domain tags */
  domainTags: string[];
  /** Last successful execution */
  lastExecutedAt?: Timestamp;
  /** Record creation timestamp */
  createdAt: Timestamp;
}

interface ProceduralStep {
  id: UUID;
  sequenceOrder: number;
  instruction: string;
  requiredTool?: string;
  fallbackSteps: ProceduralStep[];
  stepSuccessRate: number;
  maxRetries: number;
  isDecisionPoint: boolean;
}

interface ExecutionTrace {
  id: UUID;
  sessionId: UUID;
  succeeded: boolean;
  failedStepId?: UUID;
  failureReason?: string;
  actualCostTokens: number;
  actualDurationMs: number;
  startedAt: Timestamp;
  completedAt: Timestamp;
  inputContext?: string;
}

interface LearnedVariation {
  id: UUID;
  conditionDescription: string;
  triggerConditions: Record<string, string>;
  modifiedSteps: ProceduralStep[];
  variationSuccessRate: number;
  usageCount: number;
}
```

**Design Notes.** The `fallbackSteps` nested structure creates a recursive fallback tree for resilience when tool calls fail. `learnedVariations` capture discovered adaptations — different optimal test ordering for TypeScript versus Python projects. `executionTraces` provide empirical grounding for evidence-based procedure selection.

### 2.2 Memory Indexing, Retrieval & Cross-Session Continuity

#### 2.2.1 MemoryIndex

MemoryIndex maintains four parallel indexing strategies — vector similarity, temporal ordering, tag filtering, and associative links — over all memory tiers. It includes auto-compaction triggers and fragmentation monitoring to manage degradation in write-heavy workloads where consolidated episodic records leave tombstone entries.

```typescript
interface MemoryIndex {
  /** Unique identifier */
  id: UUID;
  /** Memory profile this index serves */
  memoryProfileId: UUID;
  /** Index configurations by tier */
  tierIndexes: TierIndexConfig[];
  /** Vector index for semantic similarity */
  vectorIndex: {
    dimension: number;
    neighborCount: number;
    indexType: 'hnsw' | 'ivf_flat' | 'brute_force';
    lastRebuildAt: Timestamp;
  };
  /** Temporal index for range queries */
  temporalIndex: {
    bucketGranularity: 'hour' | 'day' | 'week';
    bucketCount: number;
    earliestTimestamp: Timestamp;
    latestTimestamp: Timestamp;
  };
  /** Tag-based inverted index */
  tagIndex: {
    uniqueTagCount: number;
    totalMappings: number;
  };
  /** Associative link index */
  associativeIndex: {
    linkCount: number;
    averageLinksPerEntry: number;
  };
  /** Fragmentation ratio — triggers compaction when exceeding threshold */
  fragmentationRatio: number;
  /** Auto-compaction configuration */
  autoCompaction: {
    enabled: boolean;
    triggerThreshold: number;
    minIntervalMs: number;
    lastCompactionAt?: Timestamp;
  };
  /** Total indexed entries */
  totalIndexedEntries: number;
  /** Index size in bytes */
  indexSizeBytes: number;
  /** Creation timestamp */
  createdAt: Timestamp;
  /** Last maintenance timestamp */
  lastMaintainedAt: Timestamp;
}

interface TierIndexConfig {
  tier: 'working' | 'episodic' | 'semantic' | 'procedural';
  includedInUnifiedSearch: boolean;
  relevanceBoost: number;
  activeIndexTypes: ('vector' | 'temporal' | 'tag' | 'associative')[];
  entryCount: number;
}
```

**Design Notes.** Multi-strategy indexing avoids over-reliance on vector similarity: chronological and categorical queries execute more efficiently on specialized structures. Each tier's `relevanceBoost` allows context-dependent prioritization — debugging boosts episodic; design contexts boost procedural.

#### 2.2.2 MemoryQuery

MemoryQuery defines the unified retrieval interface accepting search vectors, natural language, temporal ranges, tier filters, and associative seeds — combining them into weighted relevance scores. It supports point lookups and range scans with explicit relevance feedback for iterative refinement.

```typescript
interface MemoryQuery {
  /** Unique identifier */
  id: UUID;
  /** Actor issuing the query — results scoped to their profile */
  actorId: UUID;
  /** Natural language query converted to embedding */
  queryText?: string;
  /** Pre-computed vector used directly if provided */
  queryVector?: Vector;
  /** Tiers to search — empty means all */
  targetTiers: ('working' | 'episodic' | 'semantic' | 'procedural')[];
  /** Temporal range constraint */
  temporalRange?: { from: Timestamp; to: Timestamp };
  /** Tag filters */
  requiredTags?: string[];
  /** Whether all tags must match */
  requireAllTags: boolean;
  /** Associative seed — related memories prioritized */
  associativeSeedId?: UUID;
  /** Link traversal depth from seed */
  associativeHopDepth: number;
  /** Relevance feedback from prior results */
  relevanceFeedback?: { memoryId: UUID; relevance: number }[];
  /** Tier boost weights */
  tierWeights?: { working: number; episodic: number; semantic: number; procedural: number };
  /** Maximum results */
  limit: number;
  /** Minimum relevance threshold */
  minRelevanceThreshold: number;
  /** Include score component breakdowns */
  includeScoreBreakdown: boolean;
  /** Include associated memories */
  includeAssociated: boolean;
  /** Query issuance timestamp */
  issuedAt: Timestamp;
  /** Maximum execution time */
  timeoutMs: number;
}

interface MemoryQueryResult {
  memory: EpisodicMemory | SemanticMemory | ProceduralMemory | WorkingMemorySlot;
  relevanceScore: number;
  scoreBreakdown?: { vectorSimilarity: number; temporalProximity: number; tagMatch: number; associativeProximity: number; tierBoost: number };
  sourceTier: 'working' | 'episodic' | 'semantic' | 'procedural';
  queryId: UUID;
}
```

**Design Notes.** `relevanceFeedback` enables feedback loops where useful memories from initial queries improve subsequent scoring. The `associativeSeedId` with `associativeHopDepth` supports exploratory navigation via link traversal from known memories.

#### 2.2.3 MemoryConsolidationJob

MemoryConsolidationJob is the background process transforming episodic experiences into semantic knowledge and procedural skills. Each job applies pattern extraction to a batch of candidate episodes, producing distilled memories and tracking compression metrics as a quality signal. Jobs run asynchronously to avoid interfering with active operations.

```typescript
interface MemoryConsolidationJob {
  /** Unique identifier */
  id: UUID;
  /** Memory profile being consolidated */
  memoryProfileId: UUID;
  /** Lifecycle state */
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  /** Input episodic memory IDs */
  sourceEpisodeIds: UUID[];
  /** Episodes processed */
  episodesProcessed: number;
  /** Episodes skipped */
  episodesSkipped: number;
  /** Produced semantic memories */
  producedSemanticMemoryIds: UUID[];
  /** Produced procedural memories */
  producedProceduralMemoryIds: UUID[];
  /** Quality metrics */
  compressionMetrics: {
    inputTokens: number;
    outputTokens: number;
    compressionRatio: number;
    semanticYieldRate: number;
    proceduralYieldRate: number;
    averageSemanticConfidence: number;
  };
  /** Strategies applied */
  strategiesUsed: ('triple_extraction' | 'pattern_generalization' | 'sequence_abstraction' | 'parameter_folding')[];
  /** Human review status */
  humanReviewStatus: 'not_required' | 'pending' | 'approved' | 'rejected' | 'partially_approved';
  /** Error if failed */
  errorMessage?: string;
  /** Queued timestamp */
  queuedAt: Timestamp;
  /** Start timestamp */
  startedAt?: Timestamp;
  /** Completion timestamp */
  completedAt?: Timestamp;
  /** Creation timestamp */
  createdAt: Timestamp;
}
```

**Design Notes.** `compressionRatio` (input/output tokens) is the primary quality signal — 10:1 indicates effective generalization; below 2:1 suggests heterogeneous input. `strategiesUsed` tracks which techniques were applied for auditability. `humanReviewStatus` enables gated learning in sensitive domains.

#### 2.2.4 ContinuityAnchor

The ContinuityAnchor is the keystone of recurring memory — the artifact making an agent feel like the same agent across sessions. It captures core facts, active projects, pending decisions, relationship dynamics, and a working memory snapshot enabling instant resumption of interrupted work. This is the first memory loaded when an agent instantiates in a new session.

```typescript
interface ContinuityAnchor {
  /** Unique identifier */
  id: UUID;
  /** Actor whose identity this preserves */
  actorId: UUID;
  /** Facts loaded into working memory at session start */
  coreFacts: CoreFact[];
  /** Active projects from recent sessions */
  activeProjects: ActiveProject[];
  /** Pending decisions requiring attention */
  pendingDecisions: PendingDecision[];
  /** Relationship states with other actors */
  relationshipStates: RelationshipState[];
  /** Working memory snapshot from most recent session */
  lastMindSnapshot?: WorkingMemorySnapshot;
  /** Most recent session */
  lastSessionId?: UUID;
  /** When last session ended */
  lastSessionEndedAt?: Timestamp;
  /** Recurring themes driving proactive retrieval */
  recurringThemes: string[];
  /** Current goals */
  activeGoals: string[];
  /** Unread notifications */
  unreadNotifications: UnreadNotification[];
  /** Learned workspace preferences */
  learnedPreferences: Record<string, string>;
  /** Consecutive sessions active */
  sessionContinuityCount: number;
  /** Whether loaded in current session */
  isActive: boolean;
  /** Creation timestamp */
  createdAt: Timestamp;
  /** Last update timestamp */
  updatedAt: Timestamp;
}

interface CoreFact {
  id: UUID;
  content: string;
  importance: number;
  establishedAt: Timestamp;
  source: 'human_set' | 'agent_inferred' | 'system_default';
}

interface ActiveProject {
  projectId: UUID;
  name: string;
  phase: string;
  agentRole: string;
  lastActiveAt: Timestamp;
  isBlockedOnAgent: boolean;
}

interface PendingDecision {
  id: UUID;
  description: string;
  options: string[];
  requestedBy?: UUID;
  flaggedAt: Timestamp;
  urgency: 'low' | 'medium' | 'high' | 'critical';
}

interface RelationshipState {
  otherActorId: UUID;
  otherActorRole: string;
  trustLevel: number;
  interactionFrequency: 'daily' | 'weekly' | 'rarely' | 'once';
  outstandingCommitments: string[];
  lastInteractionAt: Timestamp;
  sharedContext: string[];
}

interface UnreadNotification {
  id: UUID;
  fromActorId: UUID;
  content: string;
  sentAt: Timestamp;
  priority: 'low' | 'medium' | 'high';
}

interface WorkingMemorySnapshot {
  slots: { content: string; relevanceScore: number; sourceTier?: string }[];
  focusedSlotIndex?: number;
  nestingDepth: number;
  sessionId: UUID;
  capturedAt: Timestamp;
}
```

**Design Notes.** `sessionContinuityCount` indicates agent maturity — high-count agents operate more autonomously. `coreFacts` importance ordering prevents fact overload. `relationshipStates` captures dyadic dynamics absent from other tiers: knowing Actor A prefers terse communication shapes every composed message. The `WorkingMemorySnapshot` enables literal resumption of interrupted thought.

#### 2.2.5 CrossWorkspaceMemory

CrossWorkspaceMemory enables knowledge to transcend individual workspace sessions while respecting visibility constraints. It defines shared entries with explicit visibility scopes, dual embeddings for domain-specific and domain-general retrieval, and provenance tracking recording origin workspaces.

```typescript
interface CrossWorkspaceMemory {
  /** Unique identifier */
  id: UUID;
  /** Actor that produced this knowledge */
  originActorId: UUID;
  /** Origin workspace */
  originWorkspaceId: UUID;
  /** Origin workspace name */
  originWorkspaceName: string;
  /** Semantic or procedural memory being shared */
  sourceMemoryId: UUID;
  /** Type of source memory */
  sourceMemoryType: 'semantic' | 'procedural';
  /** Generalized version — stripped of project-specific references */
  generalizedContent: string;
  /** Embedding for retrieval within similar contexts */
  domainSpecificEmbedding: Vector;
  /** Embedding for retrieval across diverse contexts */
  domainGeneralEmbedding: Vector;
  /** Visibility scope */
  visibility: 'private' | 'workspace_org' | 'organization' | 'public';
  /** Explicitly granted workspaces */
  sharedWithWorkspaceIds: UUID[];
  /** Explicitly excluded workspaces */
  excludedWorkspaceIds: UUID[];
  /** Discovery tags */
  crossContextTags: string[];
  /** Retrieval count in other workspaces */
  crossWorkspaceRetrievalCount: number;
  /** Workspaces that successfully applied this */
  appliedInWorkspaceIds: UUID[];
  /** Whether origin actor marked as shareable */
  isShareable: boolean;
  /** Organizational review status */
  complianceReviewStatus: 'pending' | 'approved' | 'rejected';
  /** Reviewer */
  complianceReviewerId?: UUID;
  /** Success rate in cross-workspace contexts */
  crossWorkspaceSuccessRate: number;
  /** Source memory creation timestamp */
  sourceCreatedAt: Timestamp;
  /** Cross-workspace entry creation timestamp */
  crossWorkspaceCreatedAt: Timestamp;
  /** Last retrieval timestamp */
  lastRetrievedAt?: Timestamp;
}
```

**Design Notes.** The dual embedding strategy is key: a memory about "debugging NestJS auth middleware" has a domain-specific embedding matching NestJS memories and a domain-general embedding mapping to "web framework middleware debugging" that surfaces for Express.js projects. `generalizedContent` strips proprietary identifiers. `complianceReviewStatus` gates sharing in regulated environments.


## 3. Workspace, Project & Context Model

Chapters 1 and 2 established *who* participates and *what they remember*. This chapter defines *where* work happens and *what is visible* to agents operating within it. The workspace hierarchy provides the structural backbone — every conversation, task, and artifact lives inside a workspace and project. Without rigorous container boundaries, parallel multi-agent collaboration would devolve into chaos: agents would lack clear file access boundaries, context windows would overflow with irrelevant information, and cross-project dependencies would become untraceable. The nine data shapes that follow establish a three-tier container hierarchy (workspace, project, environment), a context management system that dynamically constrains agent visibility, and a resource reference layer that enables precise, versioned, dependency-aware access to all entities.

### 3.1 Workspace Hierarchy

The container hierarchy mirrors real-world engineering organizations. A workspace corresponds to a billing entity — the outermost boundary for all activity. Projects represent distinct efforts, each with its own resources, goals, and conversation histories. Environments subdivide a project into runtime-specific configurations, enabling the same codebase to be reasoned about under different variable sets and deployment targets. This three-level nesting — workspace → project → environment — provides the foundation for access control, resource isolation, and contextual scoping.

#### 3.1.1 Workspace

The Workspace is the absolute root container. Every other entity in the system exists inside exactly one workspace. It serves as both an identity boundary (who has access) and a billing boundary (who pays for compute and storage). In multi-tenant deployments, workspaces are the isolation primitive preventing data leakage between organizations. The workspace carries a configuration profile defining default agent behavior: LLM providers, memory retention policies, and available tool integrations.

```typescript
interface Workspace {
  id: UUID;
  name: string;
  description?: string;
  ownerId: UUID;
  members: WorkspaceMember[];
  configProfile: WorkspaceConfigProfile;
  billing: BillingBoundary;
  projectIds: UUID[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
  archived: boolean;
}

interface WorkspaceMember {
  actorId: UUID;
  role: "owner" | "admin" | "editor" | "viewer";
  joinedAt: Timestamp;
}

interface WorkspaceConfigProfile {
  defaultLLMProvider: string;
  memoryRetentionPolicy: UUID;
  enabledIntegrations: string[];
  maxAgentsPerProject: number;
}
```

**Key design notes.** The `ownerId` references an Actor from Chapter 1. The `configProfile` is duplicated into each Project at creation to allow per-project overrides. The `archived` boolean supports soft-deletion for compliance retention. Member roles are intentionally coarse — fine-grained permissions live at the Project level.

#### 3.1.2 Project

The Project is the unit of work. It encapsulates resource collections, goals, task graphs, conversation threads, and generated artifacts. When an agent needs to understand what it is working on, the Project provides the narrative context — its goals, constraints, and current state. Projects can declare dependencies on other projects within the same workspace, enabling composition patterns where one project's outputs become another's inputs.

```typescript
interface Project {
  id: UUID;
  name: string;
  description: string;
  workspaceId: UUID;
  goals: Goal[];
  conversationThreadIds: UUID[];
  resourceIds: UUID[];
  environmentIds: UUID[];
  dependsOnProjectIds: UUID[];
  dependedOnByProjectIds: UUID[];
  activeTaskGraphId?: UUID;
  defaultContextScopeId: UUID;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  archived: boolean;
}

interface Goal {
  id: UUID;
  statement: string;
  priority: "critical" | "high" | "medium" | "low";
  status: "open" | "in_progress" | "completed" | "deferred";
  parentGoalIds: UUID[];
  associatedTaskIds: UUID[];
}
```

**Key design notes.** The bidirectional dependency fields must be kept in sync by the system for O(1) traversal during impact analysis. The `defaultContextScopeId` references a ContextScope (Section 3.2.1) that agents inherit on project join, preventing "everything is visible" defaults that cause immediate context overflow. Goals form a DAG via `parentGoalIds`, allowing hierarchical decomposition. The `activeTaskGraphId` links to a DependencyGraph (Section 3.3.3) orchestrating concurrent agent work.

#### 3.1.3 Environment

An Environment represents a named configuration space within a project — typically dev, staging, and production. Environments hold variables, deployment targets, and connection strings that differ across runtime contexts. When an agent executes a task, it does so within a specific environment, ensuring that operations in staging do not accidentally affect production. The environment is the safety boundary that constrains agent actions with real-world side effects.

```typescript
interface Environment {
  id: UUID;
  name: string;
  projectId: UUID;
  variables: Record<string, string>;
  deploymentTargets: DeploymentTarget[];
  runtimeConfig: RuntimeConfig;
  allowsDestructiveOps: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

interface DeploymentTarget {
  id: UUID;
  name: string;
  type: string;
  connectionParams: ResourceRef;
  currentVersion?: ResourceVersion;
}

interface RuntimeConfig {
  llmProviderOverride?: string;
  maxTokenBudget: number;
  operationTimeoutMs: number;
  toolsEnabled: boolean;
}
```

**Key design notes.** The `allowsDestructiveOps` flag provides a coarse safety mechanism — production environments should rarely permit destructive operations without additional approval. Sensitive variable values should be stored in an external secrets manager and referenced via ResourceRef (Section 3.3.1). The `llmProviderOverride` enables cost optimization: development can use cheaper models while production uses premium ones.

### 3.2 Context Scopes, Boundaries & Snapshots

In a large workspace with thousands of files and extensive memory records, no agent can process everything. The context management system dynamically constrains what information is visible to an agent at any moment. This is not merely a performance optimization — it is a correctness mechanism. Agents that see irrelevant information hallucinate more and consume exponentially more tokens. ContextScope defines *what is currently visible*, ContextBoundary defines *the rules determining visibility*, and ContextSnapshot captures an immutable record of *what was visible at a specific point in time*.

#### 3.2.1 ContextScope

The ContextScope is the active information boundary. It specifies exactly which files, conversations, memory entries, and resources are included in or excluded from an agent's current working context. A ContextScope is dynamic — it changes as work progresses, and different parallel agents on the same project may have different scopes. When an agent begins a task, the system computes a ContextScope from the project's default, the task's requirements, and the agent's memory profile, preventing context overflow by showing only relevant items.

```typescript
interface ContextScope {
  id: UUID;
  label: string;
  projectId: UUID;
  agentId?: UUID;
  includedFileIds: UUID[];
  excludedFileIds: UUID[];
  includedConversationIds: UUID[];
  includedMemoryIds: UUID[];
  includedResourceRefs: ResourceRef[];
  boundaries: ContextBoundary[];
  maxTokenBudget: number;
  currentTokenEstimate: number;
  computedAt: Timestamp;
  isAutoManaged: boolean;
}
```

**Key design notes.** The `maxTokenBudget` and `currentTokenEstimate` fields enable proactive overflow prevention — when the estimate exceeds a threshold (typically 80%), the system triggers re-computation to exclude lower-priority items. The `isAutoManaged` flag distinguishes system-managed scopes (heuristic) from human-curated ones. Each parallel agent receives its own ContextScope instance to prevent interference.

#### 3.2.2 ContextBoundary

A ContextBoundary defines the *rule* that determines whether something falls inside or outside a ContextScope. Boundaries can be explicit ("always include /src/api"), implicit ("exclude all test files"), or heuristic ("include files mentioned in the last five messages"). This abstraction separates the *policy* of what should be visible from the *mechanism* of computing that visibility, enabling the system to explain *why* an agent can see a particular file.

```typescript
interface ContextBoundary {
  id: UUID;
  description: string;
  type: "explicit" | "implicit" | "heuristic";
  appliesTo: "file" | "conversation" | "memory" | "resource" | "any";
  direction: "include" | "exclude";
  exactIds?: UUID[];
  pathPatterns?: string[];
  heuristicRef?: string;
  heuristicParams?: Record<string, unknown>;
  priority: number;
  updatedAt: Timestamp;
}
```

**Key design notes.** The `priority` field resolves conflicts when multiple boundaries match the same entity — higher priority wins. This enables powerful composition: a heuristic might broadly include files, while an explicit boundary with higher priority excludes sensitive ones. The `heuristicRef` and `heuristicParams` are intentionally opaque, referencing pluggable algorithms that the system can extend without schema changes.

#### 3.2.3 ContextSnapshot

A ContextSnapshot is an immutable, point-in-time capture of a ContextScope. It records exactly what an agent could see when it made a particular decision. This immutability is fundamental for debugging and accountability: when an agent behaves unexpectedly, the snapshot reveals what information it had access to. Snapshots also enable reproducibility — given the same snapshot, another agent can be seeded with identical context to reproduce or validate the original work.

```typescript
interface ContextSnapshot {
  id: UUID;
  sourceScopeId: UUID;
  agentId: UUID;
  taskId?: UUID;
  resolvedFileIds: UUID[];
  resolvedConversationIds: UUID[];
  resolvedMemoryIds: UUID[];
  resolvedResourceRefs: ResourceRef[];
  activeBoundaryIds: UUID[];
  totalTokenCount: number;
  contentHash: string;
  capturedAt: Timestamp;
  immutable: true;
}
```

**Key design notes.** The `contentHash` enables cryptographic verification for compliance auditing. Snapshots are intentionally denormalized — they store exact file IDs rather than current state, and can be cross-referenced with ResourceVersion records (Section 3.3.2) to retrieve precise visible content. The `immutable: true` field is a type-level guarantee. Snapshots should be stored with a retention policy balancing debugging utility against storage costs.

### 3.3 Resource References & Dependencies

Every entity in the system — files, conversations, memory entries, API endpoints — can be referenced by agents. The resource reference layer provides a uniform, typed, version-aware mechanism for these references, while the dependency graph tracks relationships between them. This layer enables agents to reason about "what depends on what" — the foundation for impact analysis, change propagation, safe parallelization, and intelligent code navigation.

#### 3.3.1 ResourceRef

A ResourceRef is a typed, resolvable pointer to any resource an agent might need to access. It unifies references to internal entities (files, memory entries) and external entities (URLs, API endpoints, database records). The type field determines resolution strategy, and freshness requirements tell the system whether cached values are acceptable. Access credentials are stored by reference to a secrets manager, keeping the ResourceRef safe for logging and serialization.

```typescript
interface ResourceRef {
  id: UUID;
  type: "file" | "url" | "api_endpoint" | "database_record" | "memory_entry" | "conversation" | "secret";
  locator: string;
  projectId?: UUID;
  freshness: FreshnessRequirement;
  credentialsRef?: UUID;
  contentType?: string;
  description?: string;
  metadata: Record<string, unknown>;
  createdAt: Timestamp;
}

interface FreshnessRequirement {
  maxAgeMs: number | null;
  allowStaleWhileRevalidate: boolean;
}
```

**Key design notes.** The `locator` uses a polymorphic string format for extensibility — new resource types require no schema changes. The `freshness` abstraction is critical: when an agent reads a file being edited by another agent, freshness determines whether it sees the latest version or a cached copy. The `credentialsRef` is always a UUID to a secrets manager — credentials are never inlined.

#### 3.3.2 ResourceVersion

ResourceVersion captures a specific immutable state of a resource. It stores a content hash enabling reproducible resolution: given a ResourceVersion ID, the system retrieves exactly the same bytes available when that version was created. This is essential for temporal analysis ("what did the codebase look like when this agent decided?") and deterministic replay of agent workflows. Versioned resources also support branching — different agents may work with different versions of the same file.

```typescript
interface ResourceVersion {
  id: UUID;
  resourceRefId: UUID;
  contentHash: string;
  sizeBytes: number;
  capturedAt: Timestamp;
  createdBy?: UUID;
  contentStorageRef: string;
  previousVersionId?: UUID;
  branchLabel?: string;
  tokenCount?: number;
}
```

**Key design notes.** The `contentStorageRef` references external blob storage — versions can be large, and metadata must stay lightweight. The `previousVersionId` chain enables efficient diff computation. The `branchLabel` supports divergent editing where two agents modify the same file concurrently. The `tokenCount` is cached at creation to avoid recomputation during context scope resolution, which is a hot path.

#### 3.3.3 DependencyGraph

The DependencyGraph is a directed graph tracking relationships between all entities in a project — files that import other files, tasks that produce artifacts, goals that depend on sub-goals. This graph is the backbone of impact analysis: when an agent changes a file, the graph reveals what else might be affected. It also drives execution ordering (tasks wait for dependencies) and parallelization detection (independent tasks run concurrently). The graph supports both forward traversal (what does X affect?) and reverse traversal (what affects X?).

```typescript
interface DependencyGraph {
  id: UUID;
  projectId: UUID;
  edges: DependencyEdge[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastUpdatedBy?: UUID;
  validationStatus: "valid" | "stale" | "invalid";
}

interface DependencyEdge {
  id: UUID;
  fromId: UUID;
  fromKind: "file" | "task" | "goal" | "conversation" | "agent" | "resource";
  toId: UUID;
  toKind: "file" | "task" | "goal" | "conversation" | "agent" | "resource";
  relationType: "imports" | "produces" | "depends_on" | "references" | "triggers" | "contains";
  strength: number;
  detectionMethod: "auto" | "manual";
  confirmedAt: Timestamp;
}
```

**Key design notes.** The `validationStatus` indicates whether the graph has been recomputed since the last change — stale graphs trigger background recomputation rather than blocking operations. The `strength` field enables fuzzy impact analysis: strong dependencies (0.9) require immediate attention on change, weak ones (0.1) can be deferred. The `detectionMethod` is crucial for trust calibration — auto-detected edges may have false positives, while manual edges are ground truth. The graph supports heterogeneous entities, enabling cross-domain queries ("which conversations reference files depending on the module I just changed?"). Cycle detection runs continuously; flagged cycles often indicate architectural problems rather than being silently broken.


## 4. Conversation, Threading & Discourse

Preceding chapters established who participates (Actor, Chapter 1), what they remember (MemoryProfile, Chapter 2), and where work happens (Workspace, Project, Chapter 3). This chapter defines *how they talk to each other*. In a multi-agent workspace, conversation is a first-class activity domain: it coordinates parallel work, surfaces decisions, captures reasoning, and persists as organizational memory. The shapes that follow model discourse as tree-structured, multi-modal, protocol-aware interaction. Messages branch when agents explore alternatives. Turns capture complete thought processes. Flow control primitives enable pausing for human approval, forking parallel sub-discussions, and merging branches — the coordination patterns without which parallel multi-agent collaboration collapses into cacophony.

### 4.1 Thread & Message Primitives

#### 4.1.1 ConversationThread

The ConversationThread is the root container for multi-party discourse. It binds to a project, scopes participants explicitly, carries lifecycle state, and links to the workstream that spawned it. A project may contain dozens of threads — ephemeral, long-lived, protocol-driven, or freeform — each a distinct conversational context agents can join, leave, or fork independently.

```typescript
interface ConversationThread {
  id: UUID;
  title: string;
  projectId: UUID;
  topicId?: UUID;
  workstreamId: UUID;
  participantIds: UUID[];
  status: "active" | "paused" | "forked" | "merged" | "archived";
  discourseProtocolId?: UUID;
  rootMessageIds: UUID[];
  contextScopeId: UUID;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: UUID;
  archived: boolean;
  metadata: Record<string, unknown>;
}
```

**Key design notes.** The `participantIds` array is append-only with explicit membership changes — no implicit participation by project membership. This prevents context leakage when sensitive threads exist within shared projects. The `rootMessageIds` array supports multiple independent conversation trees within one thread, enabling parallel sub-discussions branching from different starting points. When `discourseProtocolId` is present, the thread enforces phase transitions and role constraints from the DiscourseProtocol (Section 4.3.3). The `contextScopeId` references a ContextScope (Chapter 3) that participants inherit, ensuring bounded visibility.

#### 4.1.2 Message

The Message is the atomic communication unit — not a text blob but a tree-structured node carrying multi-modal content, intent classification, and reasoning chain links. The tree structure is critical: a message can have multiple children representing alternative responses or parallel explorations, enabling conversation to grow as a DAG rather than a sequential list. Agents use intent classification to decide whether and how to respond.

```typescript
interface Message {
  id: UUID;
  threadId: UUID;
  parentId: UUID | null;
  childrenIds: UUID[];
  authorId: UUID;
  turnId: UUID;
  contentBlocks: ContentBlock[];
  intent: MessageIntent;
  intentConfidence: number;
  reasoningChainLinkIds: UUID[];
  embedding?: Vector;
  visibility: "public" | "internal";
  createdAt: Timestamp;
  editedAt?: Timestamp;
  deleted: boolean;
  source: "llm" | "human" | "system" | "tool" | "webhook";
  metadata: Record<string, unknown>;
}

type MessageIntent =
  | "question" | "answer" | "proposal" | "critique"
  | "agreement" | "disagreement" | "command"
  | "clarification" | "summary" | "inform";
```

**Key design notes.** The `childrenIds` array enables tree-structured conversation — a message proposing three architectural alternatives can have three child messages, each exploring one branch. The `reasoningChainLinkIds` connect discourse to agent cognition; following these links reveals the step-by-step thinking that produced the message. This is essential for debugging and for memory consolidation (Chapter 2). The `embedding` enables semantic search across all project conversations, surfacing relevant prior discussions when agents encounter similar problems.

#### 4.1.3 MessageTurn

A MessageTurn groups multiple messages into a single semantic contribution from one speaker. When an agent processes a request, it typically emits a sequence — internal reasoning, draft, tool invocation, polished output. Without turns, these fragment comprehension for both humans and other agents. The turn collects them into a unified envelope, capturing the complete thought process while preserving individual messages for granular reference.

```typescript
interface MessageTurn {
  id: UUID;
  threadId: UUID;
  actorId: UUID;
  messageIds: UUID[];
  status: "building" | "finalized" | "collapsed";
  turnType: TurnType;
  summary?: string;
  tokenCount: number;
  startedAt: Timestamp;
  completedAt?: Timestamp;
  metadata: Record<string, unknown>;
}

type TurnType =
  | "thought_process" | "draft" | "final_response"
  | "tool_invocation" | "tool_result" | "system_event" | "human_input";
```

**Key design notes.** The `"building"` status indicates the actor is still producing messages — the UI shows a typing indicator and other agents defer response. The `"collapsed"` status enables memory efficiency: after learnings are extracted (Chapter 2), the detailed sequence can be replaced by a summary, freeing context window space. `turnType` drives UI rendering — `thought_process` turns may be visually subdued while `final_response` turns are prominent. Turns are the unit of attention for conversation state tracking (Section 4.3.1).

### 4.2 Message Content Model

#### 4.2.1 ContentBlock

The ContentBlock is the fundamental segment of message content. Every message body is an ordered array of typed blocks, each carrying a type discriminator, payload, and rendering hints. This decomposition allows agents to consume message content programmatically — extracting code for execution, parsing structured data for decisions, referencing attachments for analysis — without fragile text parsing.

```typescript
interface ContentBlock {
  id: UUID;
  type: ContentBlockType;
  content: string;
  secondaryContent?: string;
  renderHints: RenderHints;
  format?: string;
  label?: string;
  editable: boolean;
  metadata: Record<string, unknown>;
}

type ContentBlockType =
  | "text" | "code" | "image" | "structured_data"
  | "tool_call" | "tool_result" | "attachment_ref" | "divider" | "quote";

interface RenderHints {
  displayMode: "inline" | "block" | "collapsed" | "hidden";
  emphasized: boolean;
  maxHeightPx?: number;
  theme?: "light" | "dark" | "auto";
}
```

**Key design notes.** The `type` discriminator is the pivot for all content processing pipelines. When an agent receives a message, it inspects block types to determine handling — code blocks go to execution, structured data blocks validate against schemas, tool call blocks trigger invocation handlers. The `renderHints` enable adaptive display: `collapsed` keeps long stack traces accessible but unobtrusive; `hidden` supports internal reasoning that should not clutter the main view. The `editable` flag enables collaborative patterns where one agent proposes code and another modifies it in-place.

#### 4.2.2 Attachment

An Attachment is a binary or structured file referenced by messages, stored separately and accessed via capability-based URLs. Multiple messages within or across threads can reference the same attachment without duplication. The attachment carries full metadata for access control, preview generation, and format detection.

```typescript
interface Attachment {
  id: UUID;
  name: string;
  mimeType: string;
  sizeBytes: number;
  hash: string;
  uploadedBy: UUID;
  originatingThreadId: UUID;
  accessUrl: string;
  previewUrl?: string;
  previewStatus: "pending" | "ready" | "failed" | "not_applicable";
  storageRef: string;
  indexed: boolean;
  uploadedAt: Timestamp;
  metadata: Record<string, unknown>;
}
```

**Key design notes.** The `hash` field enables content-addressed deduplication — if three agents upload the same dependency lockfile, only one copy is stored. The capability-based `accessUrl` encodes authorization directly in the URL, eliminating permission service round-trips. The `indexed` flag tracks whether the attachment has been processed into the semantic search index; large attachments may be indexed asynchronously. The `originatingThreadId` establishes provenance while cross-thread references create knowledge linkages.

#### 4.2.3 CodeBlock

The CodeBlock is a specialized content block for software source code. It extends the base block with language metadata, diff annotations, execution result capture, and bidirectional references to workspace files. In an agentic IDE, code blocks are living artifacts that can be executed, applied to the workspace, compared against files, and validated against tests.

```typescript
interface CodeBlock {
  id: UUID;
  parentBlockId?: UUID;
  code: string;
  language: string;
  lineNumbers: boolean;
  startLine?: number;
  diffMode: "none" | "add" | "remove" | "modify";
  diffBaseVersion?: string;
  executionResult?: CodeExecutionResult;
  workspaceFileRef?: WorkspaceFileRef;
  completeness: "complete_file" | "snippet" | "inline";
  suggestedFilePath?: string;
  metadata: Record<string, unknown>;
}

interface CodeExecutionResult {
  status: "success" | "error" | "timeout" | "killed";
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
  executedAt: Timestamp;
  environmentId: UUID;
}

interface WorkspaceFileRef {
  path: string;
  version?: string;
  lineRange?: { start: number; end: number };
  projectId: UUID;
}
```

**Key design notes.** The `diffMode` field enables code review workflows: an agent emits a block annotated as `add` or `modify`, and the recipient applies it as a patch. The `workspaceFileRef` creates a bidirectional link between discourse and the workspace file tree — clicking a code block navigates to the referenced file. The `executionResult` captures sandboxed execution outcomes, enabling agents to verify code before proposing workspace integration. The `completeness` field distinguishes complete files from snippets, preventing agents from accidentally overwriting entire files with partial solutions.

### 4.3 Conversation Flow Control & Discourse Protocols

#### 4.3.1 ConversationState

ConversationState is a continuously updated aggregate capturing the runtime condition of a thread. It tracks active turns, pending questions, decision points, and blocking conditions. Agents consult this state to determine who should act next, whether the conversation has achieved its purpose, and what interventions are needed to unblock stalled threads.

```typescript
interface ConversationState {
  id: UUID;
  threadId: UUID;
  completedTurnCount: number;
  activeTurnIds: UUID[];
  currentActorId?: UUID;
  pendingQuestions: PendingQuestion[];
  decisionPoints: DecisionPoint[];
  blockingConditions: BlockingCondition[];
  currentPhaseId?: UUID;
  lastActivityAt: Timestamp;
  computedAt: Timestamp;
  metadata: Record<string, unknown>;
}

interface PendingQuestion {
  messageId: UUID;
  askedBy: UUID;
  directedAt: UUID[];
  askedAt: Timestamp;
  priority: "blocking" | "high" | "normal" | "low";
}

interface DecisionPoint {
  id: UUID;
  description: string;
  status: "open" | "proposed" | "accepted" | "rejected" | "deferred";
  proposalMessageId?: UUID;
  responderIds: UUID[];
  requiredResponderIds: UUID[];
  deadline?: Timestamp;
}

interface BlockingCondition {
  id: UUID;
  description: string;
  type: "human_approval" | "external_dependency" | "resource_unavailable" | "protocol_violation" | "timeout";
  resolvableBy: UUID[];
  createdAt: Timestamp;
  estimatedResolution?: Timestamp;
}
```

**Key design notes.** This shape is a read-only aggregate derived from messages and flow controls — agents emit messages and directives that the system translates into state updates. The `pendingQuestions` array drives notification routing: blocking questions trigger priority notifications to targeted actors. The `decisionPoints` structure enables structured decision-making with quorum requirements. The `blockingConditions` array is the critical coordination surface: when an agent encounters a condition requiring human judgment, it emits a flow control (Section 4.3.2) that creates a blocking condition, pausing dependent work until resolution.

#### 4.3.2 FlowControl

FlowControl provides explicit directives for conversation progression. Agents and humans emit flow controls to pause, resume, fork, or terminate conversations. Without them, conversations drift indefinitely; with them, agents orchestrate coordination patterns like "pause for human approval" or "fork into parallel explorations and merge the best result." Flow controls are themselves messages in the conversation tree, providing an audit trail of coordination decisions.

```typescript
interface FlowControl {
  id: UUID;
  threadId: UUID;
  issuedBy: UUID;
  directive: FlowDirective;
  triggerMessageId?: UUID;
  rationale: string;
  forkedThreadIds?: UUID[];
  mergeSourceThreadId?: UUID;
  targetThreadId?: UUID;
  resumeConditions?: ResumeCondition[];
  executed: boolean;
  issuedAt: Timestamp;
  executedAt?: Timestamp;
  metadata: Record<string, unknown>;
}

type FlowDirective = "pause" | "resume" | "fork" | "merge" | "terminate" | "escalate" | "reassign";

interface ResumeCondition {
  type: "time_elapsed" | "actor_response" | "external_event" | "dependency_met";
  params: Record<string, unknown>;
  required: boolean;
}
```

**Key design notes.** The `fork` directive is the essential primitive for parallel multi-agent exploration. When an agent encounters a decision with multiple paths, it emits a fork control creating child threads — each with a subset of participants and a specific exploration mandate. The `merge` directive reverses this, pulling final messages from child threads into the parent as a combined summary. The `escalate` and `reassign` directives support hierarchical delegation. The `resumeConditions` enable autonomous continuation — a paused conversation can resume automatically when a CI check completes, reducing human wait time.

#### 4.3.3 DiscourseProtocol

A DiscourseProtocol defines a structured interaction pattern for predictable conversation sequences — design reviews, sprint planning, architecture decisions, incident post-mortems. Each protocol specifies phases, participant roles, entry conditions, and exit conditions. Protocols transform conversation from open-ended chat into purposeful collaborative workflows with clear expectations and measurable outcomes.

```typescript
interface DiscourseProtocol {
  id: UUID;
  name: string;
  description: string;
  version: string;
  phases: ProtocolPhase[];
  roles: ProtocolRole[];
  entryConditions: ProtocolCondition[];
  exitConditions: ProtocolCondition[];
  turnEnforcement: "free" | "strict" | "phase_dependent";
  maxDuration?: number;
  reusable: boolean;
  createdAt: Timestamp;
  createdBy: UUID;
  metadata: Record<string, unknown>;
}

interface ProtocolPhase {
  id: UUID;
  sequenceIndex: number;
  name: string;
  description: string;
  allowedRoleIds: UUID[];
  minParticipants: number;
  entryConditions: ProtocolCondition[];
  exitConditions: ProtocolCondition[];
  maxDuration?: number;
  requireIntent: boolean;
}

interface ProtocolRole {
  id: UUID;
  name: string;
  description: string;
  required: boolean;
  maxAssignees: number;
  defaultAssigneeId?: UUID;
  permissions: RolePermission[];
}

interface ProtocolCondition {
  id: UUID;
  description: string;
  type: "message_count" | "actor_response" | "consensus_reached" | "time_elapsed" | "manual_trigger" | "external_event";
  params: Record<string, unknown>;
  required: boolean;
}

type RolePermission =
  | "advance_phase" | "regress_phase" | "add_participant"
  | "remove_participant" | "terminate_protocol" | "override_blocking";
```

**Key design notes.** The `phases` array defines directed progression through protocol stages. A Design Review protocol might sequence through: context-setting → proposal → critique → revision → approval. The `turnEnforcement` field provides flexibility: `"strict"` enforces sequential turns for formal reviews, `"free"` allows natural conversation for brainstorming, and `"phase_dependent"` varies rules per phase. The `entryConditions` enable automatic protocol triggers — a thread containing an architecture proposal with low confidence might suggest activating an Architecture Decision protocol. Protocol execution produces structured artifacts — accepted decisions, consensus summaries — that feed into episodic and semantic memory (Chapter 2) as learnings from structured collaboration.


## 5. Planning, Task Graphs & Goal Management

The planning domain bridges the gap between high-level human intent and the concrete, parallelizable work that agents execute. In a multi-agent workspace, a single user request — "refactor the authentication module" — must be decomposed into a hierarchy of outcomes (Goals), measurable targets (Objectives), and atomic assignable units (Tasks) that can be distributed across agents running in parallel. The shapes in this chapter define that decomposition hierarchy, the dependency graphs that constrain execution order, and the runtime mechanisms that enable plans to adapt when agents fail, discover new requirements, or complete work faster than expected. Planning data shapes are the nervous system of the agentic workspace: they determine what gets done, in what order, by whom, and with what recourse when reality diverges from the initial plan.

### 5.1 Goal & Objective Model

#### 5.1.1 Goal

A Goal represents a strategic, outcome-oriented statement that defines *what* a collaboration session aims to achieve without prescribing *how*. Goals are the apex of the planning hierarchy; they are not directly executable but serve as anchors for decomposition into Objectives and Tasks. The Goal shape captures acceptance criteria, priority, and a state machine that tracks progress from definition through completion. It connects to the Project shape (Chapter 3) to establish scope boundaries and to Milestones to provide temporal synchronization points for parallel workstreams.

```typescript
interface Goal {
  /** Unique identifier for the goal. */
  id: UUID;
  /** Human-readable title summarizing the desired outcome. */
  title: string;
  /** Detailed description of the outcome to be achieved. */
  description: string;
  /** Reference to the Project within which this goal resides. */
  projectId: UUID;
  /** Parent goal reference for hierarchical nesting; null if top-level. */
  parentGoalId?: UUID;
  /** Ordered list of child objective references. */
  objectiveIds: UUID[];
  /** Current lifecycle state of the goal. */
  state: "draft" | "proposed" | "approved" | "active" | "at-risk" | "completed" | "abandoned";
  /** Priority level relative to sibling goals in the same project. */
  priority: "critical" | "high" | "medium" | "low" | "deferred";
  /** Enumerated conditions that, when satisfied, signal goal completion. */
  acceptanceCriteria: string[];
  /** Current completion ratio derived from child objectives (0.0 to 1.0). */
  progressPct: number;
  /** Timestamp when the goal was created. */
  createdAt: Timestamp;
  /** Timestamp of the most recent state or content change. */
  updatedAt: Timestamp;
  /** Timestamp by which the goal should be completed; null if unscheduled. */
  targetDate?: Timestamp;
  /** Timestamp when the goal was actually completed; null if not yet done. */
  completedAt?: Timestamp;
  /** Identity that created this goal (human user, agent, or system). */
  authoredBy: UUID;
  /** Metadata block for extensibility. */
  metadata: Record<string, unknown>;
}
```

**Key design notes.** The `state` field includes an `at-risk` value specifically for agentic contexts where a goal's child objectives are stalled, blocked, or failing — this state triggers escalation logic in the orchestration layer. The `progressPct` field is derived from weighted completion of child Objectives rather than child Goals; this prevents double-counting progress in nested hierarchies. Goals never contain Tasks directly — the Goal → Objective → Task decomposition is strict, ensuring that every Task traces lineage back to a verifiable outcome. The `acceptanceCriteria` array stores human-evaluable strings because goal completion often requires human judgment; agents may propose completion but cannot unilaterally mark a goal as done.

#### 5.1.2 Objective

An Objective is a concrete, measurable sub-component of a Goal that defines *how success will be verified*. Where Goals are aspirational, Objectives are falsifiable — they carry a verification method and a binary completion status. Objectives serve as the bridge between strategic intent and tactical execution: each Objective decomposes into one or more Tasks that agents execute. The verification method is critical in agentic systems because agents need to know when their work satisfies the requirement without human intervention.

```typescript
interface Objective {
  /** Unique identifier for the objective. */
  id: UUID;
  /** Concise title describing the measurable target. */
  title: string;
  /** Detailed description of what this objective entails. */
  description: string;
  /** Reference to the parent Goal this objective belongs to. */
  goalId: UUID;
  /** Ordered list of Task references that execute this objective. */
  taskIds: UUID[];
  /** Binary completion status of the objective. */
  status: "pending" | "in-progress" | "completed" | "failed";
  /** Weight of this objective relative to siblings within the same goal (0.0 to 1.0). */
  weight: number;
  /** Method used to verify completion (test-pass, human-review, lint-clean, benchmark-met, etc.). */
  verificationMethod: string;
  /** Specific threshold or condition that constitutes passing the verification method. */
  verificationThreshold?: string;
  /** Timestamp when the objective was created. */
  createdAt: Timestamp;
  /** Timestamp when the objective was marked completed or failed. */
  completedAt?: Timestamp;
  /** Timestamp by which this objective should be completed. */
  targetDate?: Timestamp;
  /** Identity that authored this objective. */
  authoredBy: UUID;
  /** Metadata block for extensibility. */
  metadata: Record<string, unknown>;
}
```

**Key design notes.** The `verificationMethod` field is typed as a string rather than an enum to accommodate domain-specific verification strategies that emerge from plugin integrations — a security objective might verify via penetration test score, while a performance objective verifies via latency benchmark. The `weight` field enables accurate progress rollup to parent Goals: an Objective with weight 0.5 contributes half as much to goal progress as one with weight 1.0. Objectives can share Tasks across them when a single piece of work satisfies multiple measurable targets; this many-to-many relationship is stored via the `taskIds` array on each Objective, and a separate join table at the persistence layer maintains referential integrity.

#### 5.1.3 Milestone

A Milestone is a temporal checkpoint that groups Objectives from potentially different Goals, serving as a synchronization point for parallel workstreams. In a multi-agent workspace where dozens of agents may be working concurrently across different objectives, Milestones provide rhythm and coordination: they represent agreed-upon moments when the system evaluates collective progress and makes routing decisions. Milestones are particularly important for the Parallelism domain (Chapter 8) because they define barrier points where fast workstreams wait for slow ones before proceeding.

```typescript
interface Milestone {
  /** Unique identifier for the milestone. */
  id: UUID;
  /** Human-readable name for the milestone. */
  name: string;
  /** Description of what this milestone represents. */
  description: string;
  /** Reference to the Project this milestone belongs to. */
  projectId: UUID;
  /** References to the Objectives that must be completed to reach this milestone. */
  objectiveIds: UUID[];
  /** References to Goals this milestone spans. */
  goalIds: UUID[];
  /** Current state of the milestone. */
  state: "upcoming" | "in-progress" | "achieved" | "missed" | "reached-with-exceptions";
  /** Target date when this milestone should be reached. */
  targetDate: Timestamp;
  /** Actual date when the milestone was reached; null if not yet achieved. */
  reachedAt?: Timestamp;
  /** Whether this milestone acts as a hard barrier — no downstream work proceeds until all objectives are met. */
  isBlocking: boolean;
  /** Grace period after targetDate before the milestone is considered missed (in milliseconds). */
  gracePeriodMs: number;
  /** Timestamp when the milestone was created. */
  createdAt: Timestamp;
  /** Identity that created this milestone. */
  authoredBy: UUID;
  /** Metadata block for extensibility. */
  metadata: Record<string, unknown>;
}
```

**Key design notes.** The `reached-with-exceptions` state acknowledges the reality of agentic execution: a milestone may be sufficiently achieved even when some objectives fail, if those failures are outside the critical path. The `isBlocking` boolean distinguishes hard synchronization barriers from soft advisory checkpoints — blocking milestones trigger the wait logic in parallel schedulers, while non-blocking milestones simply emit telemetry. The `gracePeriodMs` field prevents premature failure classification in systems where verification runs asynchronously after objective completion. Milestones are not hierarchical; they are flat coordination constructs that cut across the Goal-Objective-Task hierarchy, enabling cross-functional synchronization that pure tree structures cannot express.

### 5.2 Task Decomposition & Dependency Graphs

#### 5.2.1 Task

The Task is the atomic work unit — the fundamental entity that gets assigned to an agent for execution. Every Task traces its lineage back through an Objective to a Goal, ensuring that no agent ever performs work without a defined purpose. The Task shape carries a rich status lifecycle that models the full execution journey from proposal through completion, failure, or deferral, along with dependency bindings, effort estimates, and auto-assignment criteria that enable LLM-driven agent matching.

```typescript
interface Task {
  /** Unique identifier for the task. */
  id: UUID;
  /** Concise title describing the work to be performed. */
  title: string;
  /** Detailed description including expected inputs, outputs, and constraints. */
  description: string;
  /** Reference to the Objective this task contributes to. */
  objectiveId: UUID;
  /** Current execution status in the task lifecycle. */
  status: "proposed" | "ready" | "assigned" | "in-progress" | "blocked" | "reviewing" | "completed" | "failed" | "skipped" | "deferred";
  /** Identity of the agent currently assigned to this task; null if unassigned. */
  assigneeId?: UUID;
  /** Criteria for auto-matching this task to an agent (skill requirements, context needs, etc.). */
  assignmentCriteria?: string;
  /** Estimated effort in abstract units; interpretation depends on the project's estimation convention. */
  estimatedEffort: number;
  /** Actual effort expended in the same units as estimatedEffort. */
  actualEffort?: number;
  /** Identifiers of tasks that must satisfy their dependency constraints before this task can proceed. */
  dependencyIds: UUID[];
  /** Identifiers of tasks that are blocked by this task's completion. */
  dependentIds: UUID[];
  /** Identifiers of sibling tasks that can execute in parallel with this one. */
  parallelGroupId?: UUID;
  /** Timestamp when the task was created. */
  createdAt: Timestamp;
  /** Timestamp of the most recent status change. */
  updatedAt: Timestamp;
  /** Timestamp when the task was or should be started. */
  startedAt?: Timestamp;
  /** Timestamp when the task was completed, failed, or skipped. */
  completedAt?: Timestamp;
  /** Timestamp by which the task should be completed. */
  dueDate?: Timestamp;
  /** The conversation thread where execution details, questions, and outputs are logged. */
  executionThreadId?: UUID;
  /** Priority override relative to sibling tasks; inherits from parent objective if unset. */
  priority?: "critical" | "high" | "medium" | "low";
  /** References to workspace files, URLs, or memory entries required as inputs. */
  inputArtifacts: UUID[];
  /** References to workspace files or memory entries produced as outputs. */
  outputArtifacts: UUID[];
  /** Metadata block for extensibility. */
  metadata: Record<string, unknown>;
}
```

**Key design notes.** The status lifecycle is deliberately rich: `proposed` tasks are generated by planning agents but await validation, `ready` tasks have satisfied dependencies and are eligible for assignment, `blocked` tasks have unsatisfied dependencies or resource conflicts, and `deferred` tasks are intentionally paused pending external events. The `assignmentCriteria` field is a natural-language string evaluable by an LLM or embedding-based matcher to determine which agent profile best fits the task — it supplements explicit `assigneeId` assignment and enables dynamic routing in pools of interchangeable agents. The `parallelGroupId` links tasks that can execute concurrently without conflict, enabling the scheduler to batch-assign them to available agents. The `executionThreadId` connects each Task to the Conversation domain (Chapter 4), ensuring that all execution context — agent reasoning, file changes, human feedback — is preserved and linked to the planning structure.

#### 5.2.2 TaskDependency

A TaskDependency defines a directed relationship between two Tasks, constraining the order in which they may execute. While the Task shape stores dependency references as arrays for convenience, the TaskDependency shape captures the full semantics of each relationship — including the dependency type, any conditional predicate that gates satisfaction, and metadata about why the dependency exists. This shape transforms a simple adjacency list into a semantically rich execution graph capable of expressing complex agentic workflows.

```typescript
interface TaskDependency {
  /** Unique identifier for the dependency relationship. */
  id: UUID;
  /** The task that must satisfy a condition for the downstream task to proceed. */
  sourceTaskId: UUID;
  /** The task that is constrained by the source task. */
  targetTaskId: UUID;
  /** The type of dependency relationship governing execution order. */
  dependencyType: "finish-to-start" | "start-to-start" | "finish-to-finish" | "conditional";
  /** For conditional dependencies, the predicate that must evaluate true for the dependency to be satisfied. */
  condition?: string;
  /** Human-readable explanation of why this dependency exists. */
  rationale: string;
  /** Whether the dependency is currently satisfied. */
  isSatisfied: boolean;
  /** Timestamp when the dependency was created. */
  createdAt: Timestamp;
  /** Identity that defined this dependency. */
  authoredBy: UUID;
  /** Metadata block for extensibility. */
  metadata: Record<string, unknown>;
}
```

**Key design notes.** The `conditional` dependency type is the most critical innovation for agentic workflows: it enables relationships of the form "Task B may start when Task X reaches state `reviewing`" or "Task B may start when Task X produces output artifact with quality score above threshold." The `condition` field stores a predicate string that the execution engine evaluates against the source task's state. The three classical dependency types (finish-to-start, start-to-start, finish-to-finish) map directly to project management semantics and support critical path analysis. The `rationale` field is not decorative — it enables automated dependency refactoring when tasks are split, merged, or reassigned, because agents can read the intent behind the constraint and adapt it appropriately.

#### 5.2.3 TaskGraph

The TaskGraph is the complete directed acyclic graph formed by Tasks and their TaskDependency relationships. It is the executable artifact of the planning process — a data structure that supports topological traversal, critical path analysis, parallelization scheduling, and bottleneck detection. The TaskGraph shape stores the graph topology along with precomputed analytics that enable the scheduler to make rapid dispatch decisions without recomputing graph properties on every cycle.

```typescript
interface TaskGraph {
  /** Unique identifier for the task graph. */
  id: UUID;
  /** Human-readable name describing what this graph accomplishes. */
  name: string;
  /** Reference to the Objective this graph serves; null if the graph spans multiple objectives. */
  objectiveId?: UUID;
  /** All tasks that are members of this graph. */
  tasks: UUID[];
  /** All dependency relationships between tasks in this graph. */
  dependencies: UUID[];
  /** Cached topological ordering of task identifiers for sequential traversal. */
  topologicalOrder: UUID[];
  /** Tasks on the critical path — any delay here delays the entire graph. */
  criticalPath: UUID[];
  /** Estimated total duration of the graph along the critical path, in effort units. */
  estimatedDuration: number;
  /** Maximum number of tasks that can execute in parallel at any point. */
  maxParallelism: number;
  /** Tasks that are currently blocking the most downstream work; recalculated after each state change. */
  bottleneckTasks: UUID[];
  /** Current state of the graph as a whole. */
  state: "draft" | "validating" | "ready" | "executing" | "completed" | "failed" | "stale";
  /** Timestamp when the graph was created. */
  createdAt: Timestamp;
  /** Timestamp when the graph was last modified (tasks added, dependencies changed). */
  updatedAt: Timestamp;
  /** Timestamp when graph execution completed or failed. */
  completedAt?: Timestamp;
  /** Identity that created this task graph. */
  authoredBy: UUID;
  /** Metadata block for extensibility. */
  metadata: Record<string, unknown>;
}
```

**Key design notes.** The `stale` state indicates that the graph's topology no longer matches the current state of its constituent tasks — this occurs when tasks are added, removed, or reconnected outside the normal graph mutation flow, and triggers a revalidation pass before further scheduling. The cached `topologicalOrder` and `criticalPath` fields are denormalized intentionally: in a multi-agent workspace where the scheduler runs on every task state transition, recomputing these properties from scratch would be prohibitively expensive. The `bottleneckTasks` array is recomputed after each task completion and identifies where the orchestrator should consider injecting additional resources or escalating stalled work. The graph enforces acyclicity at validation time; any mutation that would create a cycle is rejected with a diagnostic explaining the offending path.

### 5.3 Plan Execution & Adaptation

#### 5.3.1 ExecutionPlan

An ExecutionPlan is the scheduled, resource-bound instantiation of a TaskGraph — it transforms the abstract dependency structure into a concrete operational commitment with assigned agents, allocated resources, target timelines, and an execution strategy. While a TaskGraph describes *what depends on what*, the ExecutionPlan describes *who will do what, when, and how*. Multiple ExecutionPlans can reference the same TaskGraph, enabling comparison of different scheduling strategies or replay of historical plans.

```typescript
interface ExecutionPlan {
  /** Unique identifier for the execution plan. */
  id: UUID;
  /** Human-readable name for this plan instance. */
  name: string;
  /** Reference to the TaskGraph being executed. */
  taskGraphId: UUID;
  /** Mapping from each task to its assigned agent identity. */
  assignments: Record<UUID, UUID>;
  /** Strategy governing how tasks are dispatched to agents. */
  executionStrategy: "sequential" | "parallel" | "race" | "adaptive";
  /** Timestamp when plan execution is scheduled to begin. */
  scheduledStart: Timestamp;
  /** Timestamp when plan execution actually began; null if not started. */
  actualStart?: Timestamp;
  /** Target completion timestamp based on estimates and strategy. */
  scheduledEnd: Timestamp;
  /** Actual completion timestamp; null if not completed. */
  actualEnd?: Timestamp;
  /** Current state of plan execution. */
  state: "draft" | "ready" | "running" | "paused" | "completed" | "failed" | "cancelled";
  /** Stack of checkpoint references representing saved execution states, ordered by recency. */
  checkpoints: UUID[];
  /** Stack of revision references representing plan mutations, ordered by recency. */
  revisions: UUID[];
  /** Percentage of tasks completed (0.0 to 1.0). */
  progressPct: number;
  /** Timestamp when the plan was created. */
  createdAt: Timestamp;
  /** Timestamp of the most recent plan update. */
  updatedAt: Timestamp;
  /** Identity that created this plan. */
  authoredBy: UUID;
  /** Metadata block for extensibility. */
  metadata: Record<string, unknown>;
}
```

**Key design notes.** The `executionStrategy` field selects among four scheduling paradigms: `sequential` runs one task at a time respecting dependencies; `parallel` maximizes concurrency within dependency constraints; `race` assigns the same task to multiple agents and takes the first result (useful for exploratory work); and `adaptive` continuously rebalances assignments based on agent availability and task progress. The `assignments` record maps each task to exactly one agent — when a task is reassigned, a PlanRevision is created to track the change. The `checkpoints` and `revisions` arrays maintain ordered stacks of references, enabling the execution engine to traverse history and restore previous states. The `race` strategy specifically requires that the Task shape's `parallelGroupId` be populated so the scheduler knows which tasks are safe to duplicate across agents.

#### 5.3.2 PlanRevision

A PlanRevision records a tracked modification to an active ExecutionPlan. In agentic workspaces, plans change constantly — new tasks are discovered during execution, agents fail and require reassignment, effort estimates prove wrong, and humans interject with new priorities. The PlanRevision shape captures the delta between plan states, the rationale for the change, an impact assessment, and author attribution so that plan evolution remains auditable and reversible.

```typescript
interface PlanRevision {
  /** Unique identifier for the plan revision. */
  id: UUID;
  /** Reference to the ExecutionPlan being modified. */
  planId: UUID;
  /** Monotonically increasing sequence number within the plan's revision history. */
  sequenceNumber: number;
  /** Categorization of the type of change being applied. */
  changeType: "add-tasks" | "remove-tasks" | "reassign" | "reorder" | "update-estimates" | "change-strategy" | "manual-override" | "auto-recovery";
  /** Structured description of what changed — added/removed task IDs, reassignment mappings, etc. */
  delta: Record<string, unknown>;
  /** Human-readable explanation of why this revision was made. */
  rationale: string;
  /** Assessment of how this change affects schedule, risk, and resource load. */
  impactAssessment: {
    /** Estimated change to total plan duration (positive or negative). */
    scheduleImpact: number;
    /** Description of risks introduced or mitigated by this change. */
    riskImpact: string;
    /** Changes to agent workload distribution. */
    resourceImpact: string;
  };
  /** The execution state of the plan immediately before this revision was applied. */
  preStateSnapshot: Record<string, unknown>;
  /** Identity that authored this revision. */
  authoredBy: UUID;
  /** Timestamp when the revision was created. */
  createdAt: Timestamp;
  /** Whether this revision was generated automatically by the system or manually by a user/agent. */
  isAutomatic: boolean;
  /** Metadata block for extensibility. */
  metadata: Record<string, unknown>;
}
```

**Key design notes.** The `sequenceNumber` ensures total ordering of revisions within a plan, which is critical for deterministic rollback — applying revisions in sequence order must reconstruct the plan state exactly. The `preStateSnapshot` stores a JSON-serialized representation of the plan's assignments, strategy, and task set before the revision was applied, enabling atomic rollback to any prior revision point without storing full plan copies. The `auto-recovery` change type captures revisions generated by the system's resilience logic when it detects agent failures or dependency violations and automatically replans affected tasks. The `impactAssessment` block provides structured data for plan analytics — aggregating schedule impacts across revisions reveals systemic estimation bias, while resource impact patterns identify overloaded agents.

#### 5.3.3 PlanCheckpoint

A PlanCheckpoint is a saved execution state of an ExecutionPlan that enables resumption, branching, and rollback. In long-running agentic collaborations, plans may span hours or days; checkpoints provide durability against crashes, explicit save points before risky operations, and the foundation for temporal features like branching plan variants or comparing execution paths. This shape connects directly to the Temporal Model (Chapter 10) and is the planning domain's contribution to the workspace's time-travel capabilities.

```typescript
interface PlanCheckpoint {
  /** Unique identifier for the checkpoint. */
  id: UUID;
  /** Reference to the ExecutionPlan whose state is captured. */
  planId: UUID;
  /** Human-readable label describing why this checkpoint was created. */
  label: string;
  /** Detailed description of the checkpoint context. */
  description: string;
  /** Complete serialized state of the plan at the moment of checkpointing. */
  planState: Record<string, unknown>;
  /** Status values of all tasks at checkpoint time (taskId -> status mapping). */
  taskStates: Record<UUID, string>;
  /** Artifact references captured at checkpoint time (taskId -> artifact IDs mapping). */
  capturedArtifacts: Record<UUID, UUID[]>;
  /** The type of checkpoint, determining its lifecycle and usage pattern. */
  checkpointType: "automatic" | "manual" | "pre-revision" | "recovery-point" | "branch-point";
  /** For branch-point checkpoints, references to child plans that were spawned from this state. */
  branchPlanIds?: UUID[];
  /** Reference to the parent checkpoint this checkpoint was derived from, if any. */
  parentCheckpointId?: UUID;
  /** Whether the checkpoint is eligible for rollback operations. */
  isRestorable: boolean;
  /** Timestamp when the checkpoint was created. */
  createdAt: Timestamp;
  /** Identity that created this checkpoint. */
  authoredBy: UUID;
  /** Metadata block for extensibility. */
  metadata: Record<string, unknown>;
}
```

**Key design notes.** The `planState` field stores a complete JSON snapshot of the ExecutionPlan, including its current assignments, strategy, revision history pointer, and progress — this enables full restoration without recomputing state from the revision log. The `taskStates` and `capturedArtifacts` fields provide fine-grained restore points: when rolling back to a checkpoint, the system can restore not just the plan structure but the exact execution status and output artifacts of each task. The `branch-point` checkpoint type enables plan forking — from a single checkpoint, multiple variant plans can be spawned to explore different strategies (e.g., "what if we assign the critical path to our fastest agent?"). The `isRestorable` flag allows checkpoints to be marked non-restorable after they are superseded by irreversible operations (such as external side effects), preventing dangerous rollbacks without deleting the checkpoint's audit trail. Checkpoints form a tree via `parentCheckpointId` and `branchPlanIds`, enabling visualization of plan evolution as a branching timeline rather than a linear sequence.


## 6. Research, Discovery & Knowledge Acquisition

Research in an agentic workspace is not a one-off search operation — it is a structured, traceable activity spanning multiple queries, sources, and synthesis passes. An agent may spend hours or days assembling evidence from internal codebases, external documentation, academic literature, and domain experts before arriving at actionable conclusions. The data shapes in this chapter model that entire lifecycle: from the initiation of a research session with a well-defined question, through systematic exploration guided by explicit strategies, to the consolidation of findings and honest documentation of what remains unknown. Every shape is designed to support reproducibility — another agent, or a human colleague, must be able to retrace the research path and evaluate its rigor.

### 6.1 Research Sessions & Query Strategies

A research activity begins with a scoped question and a plan for how to answer it. The shapes in this section capture the session container, the strategic approach to exploration, and the individual queries that progressively refine the agent's understanding.

#### 6.1.1 ResearchSession

A ResearchSession represents a first-class, trackable unit of knowledge acquisition within the workspace. Unlike an ad-hoc web search, it is scoped to a specific question, assigned to one or more agents, tracked through a lifecycle status, and evaluated against coverage and confidence metrics. Research sessions can appear in project plans, be referenced from conversation threads, and persist their outputs as structured artifacts for future agents to consume. The session accumulates queries, sources, findings, and identified gaps over its lifetime, producing a transparent audit trail of how knowledge was acquired.

```typescript
interface ResearchSession {
  /** Unique identifier for the research session. */
  id: UUID;
  /** Human-readable title summarizing the research objective. */
  title: string;
  /** The core question or problem this session seeks to answer. */
  researchQuestion: string;
  /** Scope boundaries — what is in scope and what is explicitly out of scope. */
  scope: { inScope: string[]; outOfScope: string[] };
  /** Current lifecycle status of the session. */
  status: "draft" | "active" | "paused" | "completed" | "abandoned";
  /** Agent(s) assigned to conduct this research. */
  assignedAgents: UUID[];
  /** The plan or task this session was initiated from, if any. */
  parentTaskId?: UUID;
  /** Conversation thread used for coordination about this research. */
  conversationThreadId?: UUID;
  /** Strategies employed to explore the question. */
  strategies: UUID[];
  /** Aggregate coverage metric: 0.0 to 1.0 indicating breadth of source exploration. */
  coverageScore: number;
  /** Aggregate confidence metric: 0.0 to 1.0 indicating reliability of findings. */
  confidenceScore: number;
  /** Maximum time budget in minutes; 0 means unlimited. */
  timeBudgetMinutes: number;
  /** When the session was created. */
  createdAt: Timestamp;
  /** When the session was last updated. */
  updatedAt: Timestamp;
  /** When the session was completed or abandoned. */
  completedAt?: Timestamp;
  /** Workspace-scoped metadata for extensibility. */
  metadata: Record<string, unknown>;
}
```

**Design notes.** ResearchSession is intentionally modeled as a first-class entity rather than a sub-field of Task because research can outlive its originating task, be shared across multiple plans, and produce reusable artifacts. The `coverageScore` and `confidenceScore` fields provide machine-readable indicators for an orchestrator deciding whether a research question has been adequately addressed or requires additional agent cycles. The `scope` field prevents research from sprawling — both human users and agent planners can enforce discipline by explicitly listing out-of-scope areas.

#### 6.1.2 SearchStrategy

A SearchStrategy defines how an agent will explore the information landscape to answer a research question. Different questions demand different exploration topologies: a codebase migration requires depth-first traversal of internal modules, while evaluating a new framework calls for breadth-first surveying of community documentation, benchmarks, and comparative analyses. Each strategy records its stop conditions — explicit criteria for when the agent should cease exploring and move on — preventing unbounded search spirals that consume time budgets without yielding value.

```typescript
interface SearchStrategy {
  /** Unique identifier for the strategy. */
  id: UUID;
  /** Human-readable name describing the approach. */
  name: string;
  /** The research session this strategy belongs to. */
  sessionId: UUID;
  /** Exploration topology: how the agent traverses the information space. */
  explorationType: "depth_first_codebase" | "breadth_first_web" | "citation_chaining" | "expert_interview" | "systematic_review" | "hybrid";
  /** Description of the approach and rationale for selecting it. */
  description: string;
  /** Ordered list of source types to prioritize. */
  sourcePriority: ("internal_code" | "documentation" | "web" | "academic" | "community" | "expert")[];
  /** Stop conditions that terminate this strategy. */
  stopConditions: {
    /** Maximum number of sources to examine. */
    maxSources?: number;
    /** Maximum depth of citation chaining or code traversal. */
    maxDepth?: number;
    /** Minimum cumulative relevance score across examined sources. */
    minCumulativeRelevance?: number;
    /** Maximum time to spend on this strategy in minutes. */
    maxTimeMinutes?: number;
    /** Stop if no new relevant information is found within this many consecutive queries. */
    staleQueryThreshold?: number;
    /** Custom predicate evaluated to determine termination. */
    customPredicate?: string;
  };
  /** Whether this strategy has been fully executed. */
  isCompleted: boolean;
  /** Metrics captured during execution. */
  executionMetrics: {
    sourcesExamined: number;
    queriesIssued: number;
    timeSpentMinutes: number;
    deepestDepthReached: number;
  };
  /** When the strategy was created. */
  createdAt: Timestamp;
  /** When execution completed, if applicable. */
  completedAt?: Timestamp;
}
```

**Design notes.** The `stopConditions` struct is the critical anti-spiral mechanism. In multi-agent parallelism, one agent's search strategy may be halted by a global orchestrator when `maxTimeMinutes` is reached, even if the agent itself would continue — this enables safe preemptive scheduling. The `explorationType` enum captures the most common research patterns while remaining open to hybrid combinations. Execution metrics feed back into the ResearchSession's aggregate coverage score, allowing the orchestrator to compare strategy effectiveness across sessions.

#### 6.1.3 ResearchQuery

A ResearchQuery captures a single information-seeking action within a broader research session. Queries are not static — they evolve iteratively as the agent learns what vocabulary, constraints, and source types yield useful results. Each query records its full refinement history, the sources it targeted, its execution status, and the result set it produced, enabling another agent to replay or critique the query sequence. The iterative refinement log is particularly valuable for training: it reveals how an agent transforms an ambiguous initial question into precise, high-yield queries.

```typescript
interface ResearchQuery {
  /** Unique identifier for the query. */
  id: UUID;
  /** The research session this query belongs to. */
  sessionId: UUID;
  /** The search strategy under which this query was issued. */
  strategyId: UUID;
  /** The agent that issued this query. */
  agentId: UUID;
  /** Sequence number within the session for ordering. */
  sequenceNumber: number;
  /** The query text as issued. */
  queryText: string;
  /** Iterative refinement history: previous versions of this query. */
  refinementHistory: { queryText: string; reasonForChange: string; changedAt: Timestamp }[];
  /** Target source types for this query. */
  targetSources: ("codebase" | "documentation" | "web_search" | "academic_db" | "internal_wiki" | "package_registry")[];
  /** Specific filters or constraints applied. */
  filters?: { dateRange?: { from?: Timestamp; to?: Timestamp }; language?: string; fileTypes?: string[] };
  /** Execution status. */
  status: "pending" | "executing" | "completed" | "failed" | "cancelled";
  /** Sources discovered by this query. */
  resultSources: UUID[];
  /** Summary of results for quick triage without loading full sources. */
  resultSummary: { sourceCount: number; topRelevanceScore: number; dominantThemes: string[] };
  /** Whether the results were deemed useful and should influence downstream queries. */
  wasUseful: boolean;
  /** Agent notes on result quality and next steps. */
  agentNotes?: string;
  /** When the query was created. */
  createdAt: Timestamp;
  /** When execution completed or failed. */
  executedAt?: Timestamp;
}
```

**Design notes.** The `refinementHistory` field transforms each query from a point-in-time string into a trajectory of learning. In long-running research sessions where multiple agents contribute, a later agent can read the refinement history to understand what approaches have already failed, avoiding redundant exploration. The `wasUseful` boolean functions as a quick filter for downstream synthesis — only queries yielding useful results contribute evidence to Findings. The `resultSummary` enables fast triage by an orchestrator deciding whether to allocate additional query budget.

### 6.2 Sources, Evidence & Findings

Queries produce sources; sources yield evidence; evidence supports findings. This section models the progressive refinement of raw information into structured, cited conclusions that can be trusted and acted upon.

#### 6.2.1 Source

A Source represents any discovered information-bearing artifact — a code file, a documentation page, a research paper, a forum thread, a conversation transcript. The Source shape captures not only where and when the artifact was found but also a credibility assessment that reflects the agent's evaluation of the source's reliability, recency, and relevance to the research question. Not all sources carry equal weight: an internal module the team authored last week rates higher than an unanswered Stack Overflow post from five years ago. The credibility score propagates into downstream findings, ensuring that conclusions rest on a weighted foundation.

```typescript
interface Source {
  /** Unique identifier for the source. */
  id: UUID;
  /** Human-readable title or description of the source. */
  title: string;
  /** Canonical URI or file path to the source. */
  url: string;
  /** The type of source, determining credibility heuristics. */
  sourceType: "code_file" | "documentation" | "web_page" | "academic_paper" | "forum_post" | "chat_transcript" | "package_readme" | "api_spec";
  /** The query that discovered this source. */
  discoveredByQueryId: UUID;
  /** Credibility assessment produced by the researching agent. */
  credibility: {
    /** Overall credibility score: 0.0 (unreliable) to 1.0 (highly credible). */
    score: number;
    /** Factors contributing to the score. */
    rationale: string;
    /** When the source was originally authored or last updated. */
    sourceDate?: Timestamp;
    /** Whether the source has been verified by a second agent. */
    crossVerified: boolean;
    /** Verifying agent, if cross-verified. */
    verifiedBy?: UUID;
  };
  /** Brief summary of the source's content and relevance. */
  relevanceSummary: string;
  /** Relevance score specific to the research question: 0.0 to 1.0. */
  relevanceScore: number;
  /** When the source was indexed into the workspace. */
  extractedAt: Timestamp;
  /** Full content or cached snapshot of the source at time of discovery. */
  cachedContent?: string;
  /** When the cached content expires and should be refreshed. */
  cacheExpiresAt?: Timestamp;
  /** Workspace-scoped metadata. */
  metadata: Record<string, unknown>;
}
```

**Design notes.** The `credibility` struct separates the score from its rationale, enabling transparency — a low-scored source can still be useful if its limitations are understood. The `cachedContent` field is essential for web sources that may change or disappear; it ensures reproducibility by freezing the source at the moment of discovery. In parallel research scenarios where multiple agents independently discover the same source, deduplication logic should merge entries while preserving the highest credibility assessment and all discovering query references.

#### 6.2.2 Evidence

Evidence is a specific excerpt extracted from a Source, pinned to an exact location with a relevance score and optional researcher annotations. While a Source is the entire artifact, Evidence is the precise paragraph, function signature, benchmark result, or quote that directly supports (or contradicts) some aspect of the research question. This distinction is critical: it enables fine-grained citation in findings and allows other agents to verify claims by re-examining the exact passage without re-reading entire documents. Each evidence item maintains a bidirectional link to its parent source and to the findings that cite it.

```typescript
interface Evidence {
  /** Unique identifier for the evidence item. */
  id: UUID;
  /** The source this evidence was extracted from. */
  sourceId: UUID;
  /** The research session this evidence belongs to. */
  sessionId: UUID;
  /** The agent that extracted this evidence. */
  extractedBy: UUID;
  /** Exact location within the source: line numbers, section anchors, page numbers, timestamps. */
  location: {
    /** Location type indicating how to interpret the locator. */
    type: "line_range" | "section" | "page" | "timestamp" | "character_range" | "function" | "heading";
    /** Primary locator value. */
    value: string;
    /** Secondary locator for nested structures. */
    subLocator?: string;
  };
  /** The exact excerpted text or content. */
  excerpt: string;
  /** Relevance score for this specific excerpt: 0.0 to 1.0. */
  relevanceScore: number;
  /** Whether this evidence supports or contradicts the research question. */
  polarity: "supporting" | "contradicting" | "neutral";
  /** Free-form annotations by the extracting agent. */
  annotations: { text: string; createdAt: Timestamp }[];
  /** Findings that cite this evidence. */
  citedByFindings: UUID[];
  /** When the evidence was extracted. */
  extractedAt: Timestamp;
  /** Workspace-scoped metadata. */
  metadata: Record<string, unknown>;
}
```

**Design notes.** The `polarity` field prevents confirmation bias by requiring agents to flag contradictory evidence explicitly. A finding built only on supporting evidence without addressing contradictions should trigger a lower confidence score. The `annotations` array captures an agent's evolving interpretation of a passage — initial extraction may be tentative, and later review may revise its significance. In multi-agent research, annotations from different agents on the same evidence item reveal interpretive divergence that should be surfaced in the final synthesis.

#### 6.2.3 Finding

A Finding is a conclusion drawn from one or more Evidence items, representing a discrete unit of knowledge produced by the research session. Findings are the primary currency exchanged between research and action: a planning agent consumes findings to make design decisions; a coding agent consumes them to select libraries or patterns. Each finding carries an explicit confidence level, acknowledges uncertainty through dedicated notes, and cites all supporting evidence — enabling any consumer to evaluate its strength and retrace its basis. Findings are intentionally scoped narrowly: a single finding addresses one specific aspect of the research question rather than attempting comprehensive synthesis.

```typescript
interface Finding {
  /** Unique identifier for the finding. */
  id: UUID;
  /** The research session that produced this finding. */
  sessionId: UUID;
  /** The agent that authored this finding. */
  authoredBy: UUID;
  /** Human-readable statement of the conclusion. */
  statement: string;
  /** The aspect of the research question this finding addresses. */
  addressesQuestion: string;
  /** Confidence level in this finding: 0.0 (speculative) to 1.0 (certain). */
  confidence: number;
  /** Evidence items that support this finding. */
  supportingEvidence: UUID[];
  /** Evidence items that contradict or qualify this finding. */
  contradictingEvidence: UUID[];
  /** Honest accounting of what remains uncertain. */
  uncertaintyNotes: string;
  /** Conditions under which this finding would need revision. */
  revisionTriggers: string[];
  /** Whether this finding has been reviewed by a second agent. */
  peerReviewed: boolean;
  /** Reviewing agent and their assessment, if peer reviewed. */
  peerReview?: { reviewerId: UUID; assessment: string; reviewedAt: Timestamp };
  /** When the finding was created. */
  createdAt: Timestamp;
  /** When the finding was last revised. */
  updatedAt: Timestamp;
  /** Workspace-scoped metadata. */
  metadata: Record<string, unknown>;
}
```

**Design notes.** The `revisionTriggers` field operationalizes epistemic humility — by listing conditions that would invalidate the finding (e.g., "if the framework releases v3.0 with a breaking API change"), the finding becomes self-maintaining. An automated monitor can watch for these triggers and flag findings for re-evaluation. The separation of `supportingEvidence` and `contradictingEvidence` ensures that findings cannot present a one-sided picture without explicit acknowledgment. Peer review gates finding promotion: a finding with confidence above 0.8 must be peer-reviewed before it can be consumed by downstream planning agents.

### 6.3 Knowledge Synthesis & Gap Analysis

Individual findings, however rigorous, do not automatically produce actionable knowledge. This section shapes model the consolidation of findings into coherent outputs and the honest documentation of what remains unknown.

#### 6.3.1 KnowledgeSynthesis

KnowledgeSynthesis is the consolidated, consumer-ready output of a research session — the document that transforms scattered findings and cited sources into a coherent narrative a human or another agent can act upon. It organizes findings by thematic area rather than by discovery order, provides an executive summary for time-constrained consumers, enumerates all cited sources with their credibility assessments, and offers explicit recommendations for action or further research. A synthesis is a product artifact: it is what persists in the workspace after the research session concludes, and it is what future agents query when facing related questions.

```typescript
interface KnowledgeSynthesis {
  /** Unique identifier for the synthesis. */
  id: UUID;
  /** The research session this synthesis summarizes. */
  sessionId: UUID;
  /** The agent that authored this synthesis. */
  authoredBy: UUID;
  /** One-paragraph executive summary for rapid consumption. */
  executiveSummary: string;
  /** Findings organized by thematic area. */
  themedFindings: { theme: string; findingIds: UUID[]; themeSummary: string }[];
  /** Complete list of sources cited across all findings. */
  citedSources: { sourceId: UUID; credibilityScore: number; relevanceScore: number }[];
  /** Recommendations derived from the findings. */
  recommendations: { action: string; rationale: string; priority: "high" | "medium" | "low"; dependsOnFindingIds: UUID[] }[];
  /** Known limitations of this synthesis. */
  limitations: string[];
  /** Research gaps that prevented a complete answer. */
  identifiedGaps: UUID[];
  /** Overall confidence in the synthesis: 0.0 to 1.0. */
  overallConfidence: number;
  /** Version of this synthesis; incremented on revision. */
  version: number;
  /** Previous version IDs, if any. */
  previousVersionIds: UUID[];
  /** When the synthesis was created. */
  createdAt: Timestamp;
  /** When the synthesis was last updated. */
  updatedAt: Timestamp;
  /** Workspace-scoped metadata. */
  metadata: Record<string, unknown>;
}
```

**Design notes.** The `themedFindings` structure decouples the presentation of knowledge from its discovery order, allowing consumers to navigate by topic rather than chronology. The `recommendations` array is the bridge from research to action: each recommendation explicitly links to the findings that justify it, enabling an agent receiving the synthesis to understand not just what to do but why. Versioning is critical because syntheses evolve as gaps are resolved or new sources emerge; `previousVersionIds` creates an auditable chain. In parallel agent systems, multiple agents may produce competing syntheses from the same session — the orchestrator selects or merges them based on `overallConfidence` and `limitations`.

#### 6.3.2 ResearchGap

A ResearchGap documents a specific unknown that the research session failed to resolve — an identified question for which no adequate evidence was found despite systematic exploration. Gaps prevent the workspace from suffering overconfident conclusions by creating an explicit record of ignorance. Each gap lists the sources that were checked but found insufficient, estimates the difficulty of resolving the gap, and suggests alternative approaches that might succeed where the current session failed. Gaps can spawn new research sessions, trigger human escalation, or be accepted as bounded uncertainty.

```typescript
interface ResearchGap {
  /** Unique identifier for the gap. */
  id: UUID;
  /** The research session in which this gap was identified. */
  sessionId: UUID;
  /** The specific question that remains unanswered. */
  unansweredQuestion: string;
  /** Description of why this gap matters to the research objective. */
  significance: string;
  /** Sources that were consulted but failed to answer the question. */
  checkedSources: { sourceId: UUID; reasonInsufficient: string }[];
  /** Estimated difficulty of resolving this gap. */
  estimatedDifficulty: "trivial" | "easy" | "moderate" | "hard" | "unknown";
  /** Estimated time to resolve, in minutes; null if unknown. */
  estimatedResolutionTimeMinutes?: number;
  /** Alternative approaches suggested for resolving the gap. */
  suggestedApproaches: { approach: string; rationale: string; estimatedSuccessProbability: number }[];
  /** Whether this gap blocks downstream work. */
  isBlocking: boolean;
  /** How the gap should be handled. */
  resolutionPlan: "defer" | "new_research_session" | "human_escalation" | "accept_uncertainty" | "architectural_decision";
  /** The agent that identified this gap. */
  identifiedBy: UUID;
  /** Whether the gap has been resolved since identification. */
  isResolved: boolean;
  /** Resolution details, if resolved. */
  resolution?: { resolvedAt: Timestamp; resolutionMethod: string; resolvedBy?: UUID; resultingFindingId?: UUID };
  /** When the gap was identified. */
  identifiedAt: Timestamp;
  /** Workspace-scoped metadata. */
  metadata: Record<string, unknown>;
}
```

**Design notes.** The `checkedSources` field is an anti-repetition mechanism — it prevents future agents from exploring the same dead ends. The `resolutionPlan` enum provides a decision vocabulary: some gaps merit a new dedicated research session, others should be escalated to a human expert, and still others can be accepted as uncertainty and addressed through an architectural decision record. The `isBlocking` flag enables critical-path analysis — a planning agent can determine whether a research session's gaps prevent task commencement or merely introduce managed risk.

#### 6.3.3 LiteratureMap

A LiteratureMap provides a structured visualization of the source landscape discovered during a research session. It clusters sources by thematic similarity, identifies authoritative sources that are heavily cited within the corpus, surfaces coverage holes where the map is sparse, and suggests specific sources or queries that would fill those holes. The literature map serves as both a navigation aid for humans reviewing the research and as a planning input for agents deciding where to explore next. It transforms a flat list of sources into a topographic understanding of the knowledge terrain.

```typescript
interface LiteratureMap {
  /** Unique identifier for the literature map. */
  id: UUID;
  /** The research session this map describes. */
  sessionId: UUID;
  /** The agent that constructed this map. */
  constructedBy: UUID;
  /** Thematic clusters of sources. */
  clusters: {
    clusterId: UUID;
    label: string;
    description: string;
    sourceIds: UUID[];
    /** Representative centroid vector for semantic similarity. */
    centroid?: Vector;
    /** Coherence score indicating how tightly related the sources are: 0.0 to 1.0. */
    coherenceScore: number;
  }[];
  /** Sources identified as authoritative (heavily referenced within the corpus). */
  authoritativeSources: { sourceId: UUID; citationCount: number; authorityScore: number }[];
  /** Identified coverage holes — thematic areas with sparse or no sources. */
  coverageHoles: {
    holeId: UUID;
    description: string;
    relatedClusters: UUID[];
    /** Suggested queries that might fill this hole. */
    suggestedQueries: string[];
    /** Suggested source types that might fill this hole. */
    suggestedSourceTypes: string[];
  }[];
  /** Cross-cluster relationship edges. */
  crossReferences: { fromClusterId: UUID; toClusterId: UUID; strength: number; basis: string }[];
  /** When the map was constructed. */
  constructedAt: Timestamp;
  /** When the map was last updated with new sources. */
  updatedAt: Timestamp;
  /** Workspace-scoped metadata. */
  metadata: Record<string, unknown>;
}
```

**Design notes.** The `clusters` field uses semantic vectors to group related sources, enabling automatic cluster formation without manual tagging. `coverageHoles` directly drives research prioritization: an agent with remaining query budget should address the largest holes first. The `crossReferences` edges reveal unexpected connections between thematic areas — these often produce the most novel findings. LiteratureMaps can be persisted across sessions: when a new research session begins on a related topic, the previous session's map provides a starting topology, preventing redundant exploration of well-mapped terrain.


## 7. Design, Visualization & Creative Work

Agentic workspaces are not confined to code generation — they are environments where software is conceived, argued over, visually explored, and iteratively refined. This chapter defines the data shapes that elevate design to a first-class activity, on par with implementation. Design documents become living artifacts that agents can author, critique, and update. Visual representations carry semantic links back to the workspace entities they describe. Review cycles follow structured protocols rather than ad-hoc commentary. Together these shapes capture the full arc of creative work: from problem framing through visual exploration to approved specification.

### 7.1 Design Documents & Decision Records

Structured design documentation prevents knowledge loss when agents or human participants transition between tasks. Each document captures not only what was decided but what was considered and rejected, creating an audit trail that future agents can query when assumptions change.

#### 7.1.1 DesignDoc

The DesignDoc is the centerpiece of this domain — a structured document modeled after RFCs and Architecture Decision Records (ADRs) that captures the full reasoning behind a significant technical or product choice. Unlike an ephemeral conversation, a DesignDoc persists as a workspace artifact that agents can reference, update, and link to implementation tasks. Its problem statement anchors all subsequent discussion; its options matrix forces explicit comparison; its implementation implications section bridges design and execution. A DesignDoc may be authored by a human, drafted by an agent from conversation notes, or co-authored through iterative refinement.

```typescript
interface DesignDoc {
  /** Unique identifier for the design document. */
  id: UUID;
  /** Human-readable title (e.g., "API Gateway Rewrite — RFC 042"). */
  title: string;
  /** Workspace this document belongs to. */
  workspaceId: UUID;
  /** Project within the workspace that this document serves. */
  projectId?: UUID;
  /** Short identifier for cross-referencing (e.g., "RFC-042", "ADR-17"). */
  docNumber: string;
  /** Current lifecycle state — linked to ApprovalStatus. */
  statusId: UUID;
  /** Single-paragraph summary of the problem being solved. */
  problemStatement: string;
  /** Measurable goals this design aims to achieve. */
  goals: string[];
  /** Explicitly out-of-scope items to prevent scope creep. */
  nonGoals: string[];
  /** References to constraints that bound this design (foreign keys to DesignConstraint). */
  constraintIds: UUID[];
  /** Options considered with pros, cons, and trade-offs. */
  optionsConsidered: DesignOption[];
  /** The recommended approach — may be one of the options or a hybrid. */
  recommendation: string;
  /** Consequences for implementation, operations, and maintenance. */
  implementationImplications: string[];
  /** Open questions that need resolution before approval. */
  openQuestions: string[];
  /** Related documents — other DesignDocs, research findings, or conversation threads. */
  relatedDocIds: UUID[];
  /** Conversation thread where this document was discussed. */
  conversationThreadId?: UUID;
  /** Primary author — human or agent. */
  authorId: UUID;
  /** Current revision — foreign key to DesignRevision. */
  currentRevisionId: UUID;
  /** Visibility within the workspace. */
  visibility: "public" | "team" | "restricted";
  /** When the document was created. */
  createdAt: Timestamp;
  /** When the document was last updated. */
  updatedAt: Timestamp;
}

interface DesignOption {
  /** Name of the option (e.g., "Option A: GraphQL Federation"). */
  name: string;
  /** Detailed description of the approach. */
  description: string;
  /** Strengths of this option. */
  pros: string[];
  /** Weaknesses and risks. */
  cons: string[];
  /** Estimated effort, complexity, or cost indicators. */
  effortEstimate?: string;
}
```

**Key design notes.** The `optionsConsidered` array is intentionally embedded rather than referenced, preserving the full decision context in a single retrievable unit. The `docNumber` field enables stable cross-referencing across conversations and implementation tasks — agents can cite "RFC-042" without fragile URL dependencies. The relationship to `ConversationThread` captures the social process of design: arguments made, concerns raised, and consensus built. When a DesignDoc is updated, a new `DesignRevision` is created automatically, ensuring that agents querying historical state see the document as it existed at any point in time.

#### 7.1.2 DesignConstraint

Constraints are the boundaries within which design operates — technical ceilings, business deadlines, regulatory mandates, and resource limits. Capturing them as first-class entities rather than prose buried in documents enables agents to reason about feasibility, flag conflicts, and verify compliance. A constraint carries both severity (hard vs. soft) and a verification method, making it actionable rather than aspirational.

```typescript
interface DesignConstraint {
  /** Unique identifier for the constraint. */
  id: UUID;
  /** Human-readable label (e.g., "GDPR Data Residency Requirement"). */
  label: string;
  /** Detailed description of the limitation or requirement. */
  description: string;
  /** Category of the constraint. */
  category: "technical" | "business" | "regulatory" | "resource" | "architectural" | "security";
  /** Severity determines whether violation blocks approval. */
  severity: "hard" | "soft";
  /** How to verify that the final design satisfies this constraint. */
  verificationMethod: string;
  /** Whether the constraint has been verified against the current design. */
  verified: boolean;
  /** When verification was performed, if applicable. */
  verifiedAt?: Timestamp;
  /** Who verified the constraint — human or agent. */
  verifiedBy?: UUID;
  /** Design documents that reference this constraint. */
  designDocIds: UUID[];
  /** Workspace where this constraint applies. */
  workspaceId: UUID;
  /** Source of the constraint — who or what imposed it. */
  source: string;
  /** Whether this constraint is still active or has been lifted. */
  isActive: boolean;
  /** When the constraint was recorded. */
  createdAt: Timestamp;
}
```

**Key design notes.** The `severity` field distinguishes inviolable boundaries (hard constraints like "must be GDPR compliant") from guidance (soft constraints like "prefer open-source dependencies"). Agents use this distinction during option generation: hard constraints eliminate invalid options early, while soft constraints inform ranking. The `verificationMethod` field is critical for agentic workflows — it tells an agent how to check compliance, whether through automated test, manual review, or reference to an external standard. When a constraint changes (for example, a deadline moves), all linked DesignDocs can be flagged for re-evaluation.

#### 7.1.3 DesignDecision

Every significant design choice should be traceable: who decided, when, what alternatives were rejected, and what consequences were expected. The DesignDecision shape captures this provenance, creating an audit trail that agents and humans can revisit when assumptions change. Unlike the recommendation embedded in a DesignDoc, a DesignDecision is a standalone record that can be referenced independently and updated with observed outcomes long after implementation.

```typescript
interface DesignDecision {
  /** Unique identifier for the decision. */
  id: UUID;
  /** Short, memorable name for the decision. */
  title: string;
  /** The decision in a single sentence. */
  decision: string;
  /** Context that made this decision necessary. */
  context: string;
  /** The design document this decision is part of, if any. */
  designDocId?: UUID;
  /** Alternatives considered with structured pros and cons. */
  alternatives: DecisionAlternative[];
  /** The chosen alternative — index into alternatives array or free text. */
  chosenAlternative: string;
  /** Who or what made this decision. */
  decisionMakerId: UUID;
  /** When the decision was recorded. */
  decidedAt: Timestamp;
  /** Expected consequences at the time of decision. */
  expectedConsequences: string[];
  /** Actual consequences observed after implementation — updated retrospectively. */
  actualConsequences?: string[];
  /** Whether this decision is reversible. */
  reversible: boolean;
  /** Conditions under which this decision should be revisited. */
  revisitConditions?: string[];
  /** Whether the decision is still active, superseded, or under review. */
  state: "active" | "superseded" | "under-review";
  /** If superseded, reference to the decision that replaced this one. */
  supersededBy?: UUID;
  /** Related decisions that should be considered together. */
  relatedDecisionIds: UUID[];
  /** Workspace where this decision was made. */
  workspaceId: UUID;
  /** When the record was created. */
  createdAt: Timestamp;
  /** When the record was last updated. */
  updatedAt: Timestamp;
}

interface DecisionAlternative {
  /** Name of the alternative. */
  name: string;
  /** Description of the approach. */
  description: string;
  /** Arguments in favor. */
  pros: string[];
  /** Arguments against. */
  cons: string[];
}
```

**Key design notes.** The separation of `expectedConsequences` and `actualConsequences` creates a feedback loop for organizational learning. Agents can analyze decisions where expectations diverged from reality, identifying flawed assumptions or changed conditions. The `revisitConditions` field is especially valuable in agentic systems — it gives agents explicit triggers for re-evaluating decisions when new information arrives. A decision may be superseded by a later decision without modifying the original record, preserving historical accuracy while maintaining current relevance through the `supersededBy` pointer.

### 7.2 Visual & Diagrammatic Representations

Visual artifacts bridge the gap between abstract design and concrete implementation. Unlike static images, the shapes in this section encode visual representations as structured data with semantic links to workspace entities, enabling interactive exploration where clicking a diagram element navigates to its underlying definition.

#### 7.2.1 Diagram

Diagrams in an agentic workspace are not static exports — they are live, semantically annotated visualizations that connect shapes on a canvas to underlying workspace entities. An architecture diagram links each box to the corresponding component definition; a flowchart links decision nodes to the DesignDecisions they represent. The Diagram shape stores both the source DSL (for regeneration) and the rendered output, while semantic annotations enable bidirectional navigation between visual and textual representations.

```typescript
interface Diagram {
  /** Unique identifier for the diagram. */
  id: UUID;
  /** Human-readable title. */
  title: string;
  /** Type of diagram. */
  diagramType: "architecture" | "flowchart" | "er" | "sequence" | "state-machine" | "class" | "custom";
  /** Workspace this diagram belongs to. */
  workspaceId: UUID;
  /** Source DSL (e.g., Mermaid, D2, PlantUML, Graphviz) for regeneration. */
  sourceDsl: string;
  /** DSL language identifier. */
  dslLanguage: string;
  /** Rendered output — URL to PNG/SVG or embedded vector data. */
  renderedOutput: string;
  /** Semantic annotations linking visual elements to workspace entities. */
  semanticAnnotations: SemanticAnnotation[];
  /** Bounding box or position data for each annotated element. */
  elementPositions: ElementPosition[];
  /** Whether the diagram is auto-generated from workspace state or manually authored. */
  generationMode: "auto" | "manual";
  /** If auto-generated, the agent or process that generated it. */
  generatedBy?: UUID;
  /** Related design document, if this diagram illustrates a design. */
  designDocId?: UUID;
  /** Version of the diagram — foreign key to DesignRevision. */
  revisionId: UUID;
  /** When the diagram was created. */
  createdAt: Timestamp;
  /** When the diagram was last updated. */
  updatedAt: Timestamp;
}

interface SemanticAnnotation {
  /** Identifier of the visual element in the source DSL. */
  elementId: string;
  /** Type of workspace entity being linked. */
  targetType: "designDoc" | "task" | "component" | "actor" | "conversation" | "research" | "decision";
  /** UUID of the target entity. */
  targetId: UUID;
  /** Human-readable label for the link. */
  label: string;
}

interface ElementPosition {
  /** Element identifier matching the source DSL. */
  elementId: string;
  /** Normalized x-coordinate (0-1) within the diagram canvas. */
  x: number;
  /** Normalized y-coordinate (0-1) within the diagram canvas. */
  y: number;
  /** Normalized width (0-1). */
  width: number;
  /** Normalized height (0-1). */
  height: number;
}
```

**Key design notes.** The `semanticAnnotations` array is what elevates Diagram from a static image to an interactive workspace artifact. Each annotation creates a bidirectional link: the diagram knows what entity each element represents, and the entity can be queried for all diagrams that reference it. The `sourceDsl` field ensures diagrams remain editable and regenerable — when underlying entities change, agents can re-render diagrams automatically. Normalized coordinates in `elementPositions` allow the same annotation data to work across different render sizes and zoom levels.

#### 7.2.2 Wireframe

Wireframes capture structural intent at low fidelity — content placement, navigation flows, and interaction hotspots without committing to visual styling. They serve as the bridge between problem understanding and detailed visual design, allowing rapid iteration on layout and flow before investment in pixel-perfect specification. In an agentic workspace, wireframes can be generated from conversation descriptions, annotated by agents with accessibility notes, and linked to the tasks that will implement each screen.

```typescript
interface Wireframe {
  /** Unique identifier for the wireframe. */
  id: UUID;
  /** Human-readable title (e.g., "Checkout Flow — Payment Screen"). */
  title: string;
  /** Workspace this wireframe belongs to. */
  workspaceId: UUID;
  /** Screen or view this wireframe represents. */
  screenName: string;
  /** User flow this wireframe is part of. */
  flowId?: UUID;
  /** Positioned elements on the wireframe canvas. */
  elements: WireframeElement[];
  /** Navigation connections between screens. */
  navigationFlows: NavigationFlow[];
  /** Interactive hotspots linking regions to actions or destinations. */
  hotspots: Hotspot[];
  /** Linked design document defining the requirements for this screen. */
  designDocId?: UUID;
  /** Fidelity level — wireframes are always low-fidelity by definition. */
  fidelity: "low";
  /** Annotations from reviewers or agents (accessibility notes, questions). */
  annotations: WireframeAnnotation[];
  /** Current revision — foreign key to DesignRevision. */
  revisionId: UUID;
  /** Who created the wireframe. */
  authorId: UUID;
  /** When the wireframe was created. */
  createdAt: Timestamp;
  /** When the wireframe was last updated. */
  updatedAt: Timestamp;
}

interface WireframeElement {
  /** Unique identifier within this wireframe. */
  elementId: string;
  /** Type of UI element. */
  type: "container" | "text" | "input" | "button" | "image" | "navigation" | "list" | "modal" | "custom";
  /** Human-readable label describing the element's purpose. */
  label: string;
  /** Normalized position and size on the canvas. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Parent element for hierarchical layout, if any. */
  parentId?: string;
  /** Z-index for layering. */
  zIndex: number;
}

interface NavigationFlow {
  /** Source screen identifier. */
  fromScreen: string;
  /** Destination screen identifier. */
  toScreen: string;
  /** Trigger causing the navigation (e.g., "click", "submit", "timeout"). */
  trigger: string;
  /** Human-readable description of the transition. */
  description: string;
}

interface Hotspot {
  /** Region identifier. */
  regionId: string;
  /** Normalized bounding box. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Action triggered on interaction. */
  action: "navigate" | "modal" | "overlay" | "submit" | "custom";
  /** Target of the action (e.g., destination screen ID). */
  target?: string;
  /** Description of what happens when this hotspot is activated. */
  description: string;
}

interface WireframeAnnotation {
  /** Annotation identifier. */
  id: UUID;
  /** Element being annotated, if specific. */
  targetElementId?: string;
  /** Annotation text. */
  text: string;
  /** Who or what added the annotation. */
  authorId: UUID;
  /** Category of annotation. */
  category: "accessibility" | "question" | "suggestion" | "requirement" | "note";
  /** When the annotation was added. */
  createdAt: Timestamp;
}
```

**Key design notes.** Wireframes deliberately carry a `fidelity` field locked to `"low"` to distinguish them from VisualSpecs. This prevents scope confusion: wireframes answer "what goes where and how do you navigate," not "what color is the button." The `hotspots` array encodes interaction intent at a level that agents can validate against implementation — does the implemented screen have all the required navigation paths? The `annotations` array supports collaborative review where agents flag accessibility concerns or ask clarifying questions directly on specific elements.

#### 7.2.3 VisualSpec

The VisualSpec is the high-fidelity counterpart to the Wireframe — a detailed design specification that captures layout grids, color tokens, typography scales, component hierarchies, interaction behaviors, and responsive breakpoints. It serves as the single source of truth for implementation, eliminating the ambiguity that arises when developers interpret mockups differently. In an agentic workspace, a VisualSpec can be generated from wireframes plus a design system, parsed by agents to generate component code, and validated against implemented output for visual regression detection.

```typescript
interface VisualSpec {
  /** Unique identifier for the visual specification. */
  id: UUID;
  /** Human-readable title. */
  title: string;
  /** Workspace this spec belongs to. */
  workspaceId: UUID;
  /** Screen or component this spec defines. */
  targetName: string;
  /** Type of spec target. */
  targetType: "screen" | "component" | "pattern" | "template";
  /** The wireframe this spec elaborates, if applicable. */
  wireframeId?: UUID;
  /** Layout specification. */
  layout: LayoutSpec;
  /** Color tokens used in this spec. */
  colors: ColorToken[];
  /** Typography specification. */
  typography: TypographySpec[];
  /** Component hierarchy with props and variants. */
  componentTree: ComponentNode[];
  /** Interaction behaviors and state transitions. */
  interactions: InteractionSpec[];
  /** Responsive breakpoints with layout adjustments. */
  responsiveBreakpoints: BreakpointSpec[];
  /** Design tokens reference — links to workspace design system. */
  designTokenRefs: string[];
  /** Accessibility requirements for this spec. */
  accessibility: AccessibilitySpec;
  /** Linked design document. */
  designDocId?: UUID;
  /** Current revision — foreign key to DesignRevision. */
  revisionId: UUID;
  /** Who authored the spec. */
  authorId: UUID;
  /** When the spec was created. */
  createdAt: Timestamp;
  /** When the spec was last updated. */
  updatedAt: Timestamp;
}

interface LayoutSpec {
  /** Grid system definition. */
  gridColumns: number;
  /** Grid gutter width in pixels. */
  gutterWidth: number;
  /** Content max-width, if constrained. */
  maxWidth?: number;
  /** Padding specifications by edge. */
  padding: { top: number; right: number; bottom: number; left: number };
  /** Spacing scale base unit. */
  spacingUnit: number;
}

interface ColorToken {
  /** Token name referencing the design system. */
  tokenName: string;
  /** Hex, RGBA, or HSL value. */
  value: string;
  /** Usage context for this color in the spec. */
  usage: string;
}

interface TypographySpec {
  /** Style name (e.g., "Heading 1", "Body Text"). */
  styleName: string;
  /** Font family. */
  fontFamily: string;
  /** Font size in pixels. */
  fontSize: number;
  /** Font weight. */
  fontWeight: number;
  /** Line height as multiplier. */
  lineHeight: number;
  /** Letter spacing in pixels. */
  letterSpacing?: number;
  /** Text transform, if any. */
  textTransform?: "none" | "uppercase" | "lowercase" | "capitalize";
  /** Usage context. */
  usage: string;
}

interface ComponentNode {
  /** Component identifier. */
  nodeId: string;
  /** Component name from the design system. */
  componentName: string;
  /** Props and their values for this instance. */
  props: Record<string, string | number | boolean>;
  /** Child components. */
  children: ComponentNode[];
  /** Position within the parent layout. */
  layoutPosition?: { x: number; y: number; width: number; height: number };
}

interface InteractionSpec {
  /** Trigger type. */
  trigger: "click" | "hover" | "focus" | "scroll" | "drag" | "gesture" | "load";
  /** Target element identifier. */
  targetElementId: string;
  /** Resulting behavior. */
  behavior: string;
  /** Animation or transition spec, if applicable. */
  animation?: string;
  /** State changes caused by this interaction. */
  stateChanges: string[];
}

interface BreakpointSpec {
  /** Breakpoint name. */
  name: string;
  /** Minimum width in pixels. */
  minWidth: number;
  /** Maximum width in pixels, if bounded. */
  maxWidth?: number;
  /** Layout adjustments at this breakpoint. */
  layoutAdjustments: string[];
  /** Visibility changes for elements. */
  visibilityChanges?: { elementId: string; visible: boolean }[];
}

interface AccessibilitySpec {
  /** Minimum contrast ratios required. */
  contrastRatio: string;
  /** Focus order description. */
  focusOrder: string;
  /** Screen reader annotations. */
  screenReaderNotes: string[];
  /** Keyboard navigation requirements. */
  keyboardNavigation: string[];
  /** Motion preference alternatives. */
  reducedMotionAlternatives?: string[];
}
```

**Key design notes.** The `componentTree` field uses a recursive structure that mirrors the component hierarchy in code, enabling agents to translate VisualSpecs directly into component implementations. Each node references a design system component by name and provides instance-specific props, creating a declarative specification that both humans and agents can interpret consistently. The `responsiveBreakpoints` array captures how the design adapts across viewports — critical information that is often lost when specs are communicated informally. The `accessibility` field ensures that a11y requirements are part of the spec rather than an afterthought, enabling agents to validate contrast ratios, focus order, and screen reader behavior against the specification.

### 7.3 Design Reviews & Iteration Cycles

Design without review is assumption without validation. This section defines the structured processes through which designs are evaluated, approved, and iteratively refined — with full traceability of who requested changes, what was modified, and why.

#### 7.3.1 DesignReview

A DesignReview is a structured evaluation event, not a collection of informal comments. It defines evaluation criteria upfront, collects categorized feedback against those criteria, tracks open questions to resolution, and produces a determinate outcome. In an agentic workspace, agents can participate as reviewers — generating feedback from accessibility guidelines, performance budgets, or consistency checks against the design system — while humans provide judgment on subjective qualities like user experience and brand alignment.

```typescript
interface DesignReview {
  /** Unique identifier for the review. */
  id: UUID;
  /** Human-readable title (e.g., "RFC-042 Design Review Round 1"). */
  title: string;
  /** Workspace where the review takes place. */
  workspaceId: UUID;
  /** The design document, visual spec, or wireframe under review. */
  targetId: UUID;
  /** Type of artifact being reviewed. */
  targetType: "designDoc" | "visualSpec" | "wireframe" | "diagram";
  /** Criteria against which the design is evaluated. */
  criteria: ReviewCriterion[];
  /** Categorized feedback items. */
  feedback: FeedbackItem[];
  /** Open questions that must be resolved. */
  openQuestions: OpenQuestion[];
  /** Participants in the review — humans and agents. */
  participants: ReviewParticipant[];
  /** Current state of the review. */
  state: "in-progress" | "submitted" | "resolved" | "closed";
  /** Overall outcome once the review concludes. */
  outcome?: "approved" | "approved-with-changes" | "rejected" | "needs-revision";
  /** Deadline for feedback submission. */
  deadline?: Timestamp;
  /** When the review was initiated. */
  startedAt: Timestamp;
  /** When the review concluded. */
  closedAt?: Timestamp;
}

interface ReviewCriterion {
  /** Criterion identifier. */
  criterionId: string;
  /** Criterion name (e.g., "Usability", "Performance", "Accessibility"). */
  name: string;
  /** Description of what is being evaluated. */
  description: string;
  /** Weight of this criterion in the overall assessment. */
  weight: number;
}

interface FeedbackItem {
  /** Feedback identifier. */
  id: UUID;
  /** Criterion this feedback addresses. */
  criterionId: string;
  /** The feedback text. */
  text: string;
  /** Category of feedback. */
  category: "usability" | "performance" | "accessibility" | "maintainability" | "security" | "aesthetic" | "consistency" | "other";
  /** Severity of the feedback. */
  severity: "blocking" | "suggestion" | "question" | "praise";
  /** Who provided the feedback. */
  authorId: UUID;
  /** Whether this feedback has been addressed. */
  resolved: boolean;
  /** How the feedback was addressed, if resolved. */
  resolution?: string;
  /** When the feedback was provided. */
  createdAt: Timestamp;
  /** When the feedback was resolved. */
  resolvedAt?: Timestamp;
}

interface OpenQuestion {
  /** Question identifier. */
  id: UUID;
  /** The question text. */
  question: string;
  /** Who asked the question. */
  askedBy: UUID;
  /** When the question was asked. */
  askedAt: Timestamp;
  /** Answer, if resolved. */
  answer?: string;
  /** Who answered, if resolved. */
  answeredBy?: UUID;
  /** When the question was answered. */
  answeredAt?: Timestamp;
}

interface ReviewParticipant {
  /** Actor identifier. */
  actorId: UUID;
  /** Role in this review. */
  role: "author" | "reviewer" | "observer" | "moderator";
  /** Whether the participant has submitted feedback. */
  hasSubmitted: boolean;
  /** When the participant was added. */
  addedAt: Timestamp;
}
```

**Key design notes.** The `criteria` array is established at review creation, ensuring that all feedback addresses predefined dimensions rather than arriving as unstructured commentary. This structure enables agents to generate targeted feedback — an accessibility agent evaluates only the accessibility criterion, while a performance agent focuses on performance implications. The `severity` field on feedback items distinguishes blocking issues (which must be resolved before approval) from suggestions and questions. The separation of `openQuestions` from general feedback ensures that unanswered questions cannot be accidentally overlooked — they remain visible until explicitly resolved with an answer.

#### 7.3.2 ApprovalStatus

ApprovalStatus is a state machine that governs the lifecycle of design artifacts from draft through final disposition. It enforces structured transitions — a document cannot jump from draft to approved without passing through review — and tracks the required approvers for each artifact. In an agentic workspace, agents may hold approval authority for certain dimensions (a security agent approves security-related changes) while humans retain authority over product and design decisions.

```typescript
interface ApprovalStatus {
  /** Unique identifier for the approval record. */
  id: UUID;
  /** The artifact being approved (DesignDoc, VisualSpec, Wireframe, or Diagram). */
  artifactId: UUID;
  /** Type of artifact. */
  artifactType: "designDoc" | "visualSpec" | "wireframe" | "diagram";
  /** Current state in the approval lifecycle. */
  state: "draft" | "under-review" | "changes-requested" | "approved" | "rejected";
  /** Required approvers with their roles. */
  requiredApprovers: RequiredApprover[];
  /** Actual approvals recorded. */
  approvals: ApprovalRecord[];
  /** State transition history — every change captured with reason. */
  transitionHistory: StateTransition[];
  /** Whether all required approvals have been obtained. */
  isFullyApproved: boolean;
  /** Workspace where this approval resides. */
  workspaceId: UUID;
  /** When the approval record was created. */
  createdAt: Timestamp;
  /** When the state was last changed. */
  updatedAt: Timestamp;
}

interface RequiredApprover {
  /** Actor identifier of the required approver. */
  actorId: UUID;
  /** Role dimension this approver covers. */
  approvalDimension: "technical" | "design" | "product" | "security" | "accessibility" | "business";
  /** Whether this approver has approved. */
  hasApproved: boolean;
  /** Whether this approver's sign-off is mandatory or can be overridden. */
  isMandatory: boolean;
}

interface ApprovalRecord {
  /** Actor who gave approval. */
  actorId: UUID;
  /** Dimension being approved. */
  dimension: string;
  /** Approval decision. */
  decision: "approved" | "approved-with-conditions" | "rejected";
  /** Conditions attached to approval, if any. */
  conditions?: string[];
  /** When the approval was recorded. */
  timestamp: Timestamp;
}

interface StateTransition {
  /** Previous state. */
  fromState: string;
  /** New state. */
  toState: string;
  /** Actor or agent that triggered the transition. */
  triggeredBy: UUID;
  /** Reason for the transition. */
  reason: string;
  /** When the transition occurred. */
  timestamp: Timestamp;
}
```

**Key design notes.** The `requiredApprovers` array supports multi-dimensional approval — a DesignDoc might need sign-off from a lead designer (design dimension), a product manager (product dimension), and a security agent (security dimension) before it is fully approved. The `isMandatory` flag allows some approvals to be overrideable in exceptional circumstances while ensuring critical dimensions (like security) cannot be bypassed. Every state transition is captured in `transitionHistory` with a reason, creating an audit trail that agents can analyze to identify patterns in approval bottlenecks. The `changes-requested` state is distinct from `rejected` — it indicates a path forward exists, whereas rejection means the approach must be fundamentally reconsidered.

#### 7.3.3 DesignRevision

Design work is inherently iterative, and DesignRevision captures each version of a design artifact with its change diff, author, rationale, and lineage. Unlike simple version numbering, this shape supports branching — design exploration frequently forks into parallel paths (version A and version B) that are later merged or one is abandoned. The revision graph enables agents to understand the evolution of a design, compare alternatives, and roll back to previous states when a new direction proves inferior.

```typescript
interface DesignRevision {
  /** Unique identifier for the revision. */
  id: UUID;
  /** The artifact this revision belongs to. */
  artifactId: UUID;
  /** Type of artifact being versioned. */
  artifactType: "designDoc" | "visualSpec" | "wireframe" | "diagram";
  /** Monotonically increasing version number within the artifact's branch. */
  versionNumber: number;
  /** Human-readable label for the revision (e.g., "v3 — Addressed feedback from Round 1"). */
  label: string;
  /** Structured description of what changed in this revision. */
  changeDescription: string;
  /** Machine-readable diff representation — format depends on artifact type. */
  diff: string;
  /** Who authored this revision — human or agent. */
  authorId: UUID;
  /** Rationale for the changes made. */
  rationale: string;
  /** Parent revision — null for the initial version. */
  parentRevisionId?: UUID;
  /** Branch name — "main" for the primary line, custom names for explorations. */
  branchName: string;
  /** Whether this revision is on the main branch or an exploration branch. */
  branchType: "main" | "exploration";
  /** If this revision merges changes from another branch, the source branch. */
  mergedFrom?: string;
  /** Whether this revision has been merged into main. */
  mergedToMain: boolean;
  /** Whether this revision is a rollback target — can be restored as the current version. */
  isRollbackTarget: boolean;
  /** Reference to the design review that prompted this revision, if any. */
  promptedByReviewId?: UUID;
  /** Workspace where this revision exists. */
  workspaceId: UUID;
  /** When the revision was created. */
  createdAt: Timestamp;
}
```

**Key design notes.** The `branchName` and `branchType` fields explicitly model design exploration as a branching workflow. When an agent proposes an alternative approach ("let's try a card-based layout instead of a table"), it creates a new exploration branch rather than overwriting the main line. This preserves the original design while the alternative is evaluated. The `promptedByReviewId` field links revisions to the review feedback that drove them, closing the loop between review and iteration. The `isRollbackTarget` flag marks revisions that are stable enough to restore if a subsequent revision proves problematic — agents can automatically suggest rollback when they detect that a new revision introduces blocking issues or fails constraint verification.


## 8. Parallelism, Forking & Concurrent Execution

The defining capability of an agentic workspace is not that a single agent can perform complex work — it is that many agents can perform complex work simultaneously, pursuing divergent paths, competing to find the best solution, and merging their results without chaos. This chapter defines the data architecture that makes such parallelism tractable. Where preceding chapters established the identity of agents (Chapter 1), the memory they draw upon (Chapter 2), the workspace they inhabit (Chapter 3), the conversations they conduct (Chapter 4), the plans they follow (Chapter 5), the research they perform (Chapter 6), and the designs they produce (Chapter 7), this chapter provides the execution mechanics that allow all of that work to proceed in parallel. The shapes here model the fundamental unit of concurrent work (Workstream), the runtime environment that isolates parallel agents (ExecutionSession), the branching points where execution splits (SessionFork, ForkSpec), the competitive patterns that pit multiple approaches against each other (RaceCondition), the speculative machinery that lets agents think ahead without consequences (SpeculativeExecution), the synchronization primitives that rejoin parallel work (Barrier), the conflict resolution system that handles collisions (MergeConflict), and the governance policies that prevent unbounded proliferation (ConcurrencyPolicy). Together these ten shapes form the beating heart of the parallel work model.

### 8.1 Workstreams & Session Model

#### 8.1.1 Workstream

A Workstream is the fundamental unit of parallelism in the agentic workspace — an isolated thread of computation with its own WorkingMemory instance, assigned actor set, fork/merge lineage tracking, and priority-based scheduling weight. When a user asks the workspace to "explore three approaches to this refactoring," each approach becomes a Workstream. The isolation model is strict: workstreams do not share mutable memory, and all communication between them is explicit via the Barrier and MergeConflict mechanisms defined later in this chapter. The fork/merge lineage fields (`parentWorkstreamId`, `childWorkstreamIds`, `forkedAt`) enable the system to reconstruct the branching history of any workstream and to perform lineage-aware merge operations when parallel branches complete.

```typescript
interface Workstream {
  /** Unique identifier for the workstream. */
  id: UUID;
  /** Human-readable label describing the workstream's purpose or approach. */
  name: string;
  /** Detailed description of what this workstream is attempting to achieve. */
  description: string;
  /** Reference to the ExecutionSession that owns this workstream. */
  sessionId: UUID;
  /** Current lifecycle state of the workstream. */
  status: "pending" | "active" | "paused" | "stalled" | "merging" | "merged" | "abandoned";
  /** Priority level for resource contention resolution; higher values receive preference. */
  priority: number;
  /** References to agents assigned to execute work within this workstream. */
  assignedActorIds: UUID[];
  /** Reference to the parent workstream from which this one was forked; null if root. */
  parentWorkstreamId?: UUID;
  /** Ordered list of child workstreams forked from this one. */
  childWorkstreamIds: UUID[];
  /** Timestamp when this workstream was branched from its parent. */
  forkedAt?: Timestamp;
  /** Timestamp when this workstream was created. */
  createdAt: Timestamp;
  /** Timestamp of the most recent state transition or activity. */
  updatedAt: Timestamp;
  /** Timestamp when the workstream completed, merged, or was abandoned. */
  terminatedAt?: Timestamp;
  /** Isolated WorkingMemory instance reference unique to this workstream. */
  workingMemoryId: UUID;
  /** ContextScope defining the information boundary visible to this workstream. */
  contextScopeId: UUID;
  /** TaskGraph or subset thereof assigned to this workstream for execution. */
  assignedTaskGraphId?: UUID;
  /** Ordered list of task IDs currently being executed within this workstream. */
  activeTaskIds: UUID[];
  /** Accumulated resource consumption metrics for this workstream. */
  resourceUsage: ResourceConsumption;
  /** Identity (agent or user) that created this workstream. */
  createdBy: UUID;
  /** Metadata block for extensibility. */
  metadata: Record<string, unknown>;
}

/** Accumulated resource consumption for a workstream's lifetime. */
interface ResourceConsumption {
  /** Total LLM input tokens consumed. */
  inputTokens: number;
  /** Total LLM output tokens consumed. */
  outputTokens: number;
  /** Estimated monetary cost in workspace billing currency. */
  estimatedCost: number;
  /** Wall-clock execution time in milliseconds. */
  wallClockMs: number;
  /** Number of tool invocations made. */
  toolCalls: number;
  /** Number of artifact read/write operations. */
  artifactOperations: number;
}
```

**Key design notes.** The `status` field includes `stalled` to capture the common scenario where a workstream cannot proceed due to an unresolved dependency, exhausted retry budget, or unanswerable question — distinct from `paused` which indicates deliberate external intervention. The `merging` state is a terminal transition that signals the workstream's outputs are being incorporated into a parent or sibling workstream; no new work may begin in this state. The `priority` field is a numeric value rather than an enum to allow fine-grained scheduling heuristics — a priority-aware scheduler can implement weighted fair queuing across competing workstreams. The `ResourceConsumption` embedded object is critical for enforcing ConcurrencyPolicy limits (Section 8.3.3) and for post-hoc cost attribution when multiple workstreams contribute to a single deliverable. Every workstream receives its own WorkingMemory instance (referenced by `workingMemoryId`) to guarantee memory isolation; agents working in different workstreams cannot inadvertently contaminate each other's context windows.

#### 8.1.2 ExecutionSession

An ExecutionSession is the runtime container within which one or more Workstreams execute concurrently. It captures the complete environment — working memory, context scope, artifact workspace, and active conversation bindings — that defines what an agent can see and do at any moment. Sessions are the unit of lifecycle management: they are created when parallel work begins, persist through fork and merge operations, and are destroyed when all contained workstreams complete or are abandoned. A single workspace may host multiple active ExecutionSessions simultaneously, each representing an independent parallel computation with no shared mutable state.

```typescript
interface ExecutionSession {
  /** Unique identifier for the execution session. */
  id: UUID;
  /** Human-readable name describing the session's purpose. */
  name: string;
  /** Reference to the Workspace in which this session runs. */
  workspaceId: UUID;
  /** Reference to the Project that provides scope for this session. */
  projectId: UUID;
  /** Current lifecycle state of the session. */
  status: "initializing" | "active" | "forking" | "pausing" | "paused" | "resuming" | "merging" | "completed" | "failed" | "terminated";
  /** Ordered list of workstreams executing within this session. */
  workstreamIds: UUID[];
  /** The primary or root workstream from which all others in this session descend. */
  rootWorkstreamId: UUID;
  /** SessionContext containing the full environmental parameter set for this session. */
  context: SessionContext;
  /** Reference to the active ContextScope defining information boundaries. */
  contextScopeId: UUID;
  /** Reference to the ConversationThread linked to this session for human coordination. */
  conversationThreadId?: UUID;
  /** Active ExecutionPlan or PlanCheckpoint that guides this session's work. */
  executionPlanId?: UUID;
  /** Timestamp when the session was created. */
  createdAt: Timestamp;
  /** Timestamp of the most recent state change or activity. */
  updatedAt: Timestamp;
  /** Timestamp when the session completed or was terminated; null if still active. */
  terminatedAt?: Timestamp;
  /** Fork lineage: reference to the SessionFork that created this session, if applicable. */
  createdByForkId?: UUID;
  /** Fork lineage: references to SessionForks initiated from this session. */
  initiatedForkIds: UUID[];
  /** Accumulated resource consumption across all contained workstreams. */
  totalResourceUsage: ResourceConsumption;
  /** Identity (agent or user) that initiated this session. */
  initiatedBy: UUID;
  /** Metadata block for extensibility. */
  metadata: Record<string, unknown>;
}
```

**Key design notes.** The `status` field encodes a richer state machine than Workstream because sessions mediate cross-workstream operations like `forking` and `merging` that require atomic transitions across multiple child workstreams. The `forking` state freezes all contained workstreams while the session's state is being snapshotted and distributed to child sessions; similarly, `merging` indicates an in-progress consolidation. The `createdByForkId` and `initiatedForkIds` fields form the session-level lineage graph, enabling traversal from any session back to its ancestral root and forward to its descendants. This is essential for reconstructing the tree of parallel exploration and for attributing resource consumption across an entire fork tree. The `executionPlanId` links the session to the plan checkpoint that defines its current objectives, allowing the session to resume from interruption with full context.

#### 8.1.3 SessionContext

SessionContext captures the complete environmental parameter set that defines an ExecutionSession's runtime conditions. When a session is forked, its SessionContext is deep-copied to each child; when sessions merge, their contexts are reconciled through a three-way merge that preserves divergent configurations where possible and surfaces conflicts where necessary. This shape is the mechanism by which parallel workstreams inherit consistent initial conditions while retaining the freedom to evolve independently. It includes model configuration, tool availability, memory access policies, artifact workspace bindings, and scheduling parameters — everything an agent needs to know "how to work" within its session.

```typescript
interface SessionContext {
  /** Unique identifier for this context instance. */
  id: UUID;
  /** Reference to the ExecutionSession this context belongs to. */
  sessionId: UUID;
  /** LLM model configuration for this session (model name, temperature, max tokens, etc.). */
  modelConfig: ModelConfiguration;
  /** Set of tool identifiers available to agents in this session. */
  availableTools: string[];
  /** Memory access policy defining which memory tiers are readable/writable. */
  memoryPolicy: MemoryAccessPolicy;
  /** Reference to the artifact workspace directory or scope for this session. */
  artifactWorkspaceId: UUID;
  /** Scheduling parameters governing workstream execution within this session. */
  scheduling: SchedulingParameters;
  /** Maximum resource budget allocated to this session. */
  resourceBudget: ResourceBudget;
  /** Environment variables and configuration values visible to agents in this session. */
  environmentVariables: Record<string, string>;
  /** Feature flags and capability toggles active for this session. */
  featureFlags: Record<string, boolean>;
  /** Timestamp when this context was created (typically session creation time). */
  createdAt: Timestamp;
  /** Timestamp when this context was last modified. */
  updatedAt: Timestamp;
  /** Context instance from which this was copied, if forked; null for root sessions. */
  parentContextId?: UUID;
  /** Reconciliation status — tracks whether this context has been modified from its parent. */
  reconciliationStatus: "pristine" | "modified" | "reconciled" | "conflict";
  /** Metadata block for extensibility. */
  metadata: Record<string, unknown>;
}

/** LLM model configuration parameters. */
interface ModelConfiguration {
  /** Model identifier string (e.g., "claude-sonnet-4-20250514"). */
  modelId: string;
  /** Sampling temperature (0.0 to 2.0). */
  temperature: number;
  /** Maximum tokens per response. */
  maxOutputTokens: number;
  /** Top-p sampling parameter. */
  topP?: number;
  /** Frequency penalty parameter. */
  frequencyPenalty?: number;
  /** Presence penalty parameter. */
  presencePenalty?: number;
  /** Reasoning effort level for supported models. */
  reasoningEffort?: "low" | "medium" | "high";
}

/** Memory access policy defining read/write permissions per memory tier. */
interface MemoryAccessPolicy {
  /** Working memory access: "readwrite" | "readonly" | "none". */
  workingMemory: "readwrite" | "readonly" | "none";
  /** Episodic memory access level. */
  episodicMemory: "readwrite" | "readonly" | "none";
  /** Semantic memory access level. */
  semanticMemory: "readwrite" | "readonly" | "none";
  /** Procedural memory access level. */
  proceduralMemory: "readwrite" | "readonly" | "none";
  /** Whether cross-workspace memory is accessible. */
  crossWorkspaceMemory: boolean;
}

/** Scheduling parameters for workstream execution within a session. */
interface SchedulingParameters {
  /** Maximum number of concurrently active workstreams in this session. */
  maxConcurrentWorkstreams: number;
  /** Preemption policy when resource limits are reached. */
  preemptionPolicy: "priority" | "fairshare" | "fifo" | "none";
  /** Whether workstreams can be automatically paused when idle. */
  autoPauseIdle: boolean;
  /** Idle timeout in milliseconds before auto-pause triggers. */
  idleTimeoutMs: number;
  /** Checkpoint interval for automatic state persistence. */
  checkpointIntervalMs: number;
}

/** Resource budget constraining session consumption. */
interface ResourceBudget {
  /** Maximum input tokens allowed for this session. */
  maxInputTokens?: number;
  /** Maximum output tokens allowed for this session. */
  maxOutputTokens?: number;
  /** Maximum estimated cost in workspace billing currency. */
  maxCost?: number;
  /** Maximum wall-clock duration in milliseconds. */
  maxDurationMs?: number;
  /** Action when any budget limit is exceeded: "pause" | "terminate" | "notify". */
  exceedAction: "pause" | "terminate" | "notify";
}
```

**Key design notes.** The `reconciliationStatus` field is central to the merge workflow: `pristine` means the context is identical to its parent's, `modified` means local changes have been made, `reconciled` means a successful three-way merge has been performed, and `conflict` means incompatible changes require resolution. The `ModelConfiguration` sub-interface is extracted as a reusable type because model parameters are frequently adjusted per-session for parallel-approach experiments — one branch might run a fast model for rapid iteration while another runs a capable model for quality-critical work. The `MemoryAccessPolicy` uses per-tier access levels rather than a single blanket permission because agentic workstreams often need read access to semantic and procedural memory while requiring strict write isolation on working memory. The `exceedAction` in `ResourceBudget` defaults to `pause` rather than `terminate` to give human operators the option to extend budgets for promising workstreams.

#### 8.1.4 SessionFork

A SessionFork captures the exact moment of branching — the point in time when an ExecutionSession splits into two or more child sessions, each receiving a copy of the parent's state and proceeding with independent evolution. This shape is the structural record of divergence: it stores the parent session reference, the snapshot of state at fork time, the ForkSpec that motivated the branch, and the child session identifiers that result. Every fork creates a permanent record in the lineage graph, enabling retrospective analysis of which branching decisions produced valuable outcomes and which wasted resources. The fork mechanism is the atomic operation underlying all parallel execution patterns in the workspace.

```typescript
interface SessionFork {
  /** Unique identifier for this fork record. */
  id: UUID;
  /** Human-readable description of why this fork was created. */
  reason: string;
  /** Classification of the fork's strategic purpose. */
  forkType: "speculative" | "parallel-approach" | "ab-test" | "exploration" | "error-recovery" | "decomposition";
  /** Reference to the parent ExecutionSession being forked. */
  parentSessionId: UUID;
  /** Snapshot of the parent session's state at the moment of fork. */
  parentSnapshotId: UUID;
  /** References to the child ExecutionSessions created by this fork. */
  childSessionIds: UUID[];
  /** The ForkSpec that configured this fork's behavior. */
  forkSpecId: UUID;
  /** Current state of the fork lifecycle. */
  status: "pending" | "executing" | "awaiting-resolution" | "merging" | "merged" | "partially-merged" | "abandoned";
  /** Timestamp when the fork was initiated. */
  forkedAt: Timestamp;
  /** Timestamp when the fork completed merging or was abandoned. */
  resolvedAt?: Timestamp;
  /** Workstream-to-session mapping showing which workstream from the parent was routed to which child. */
  workstreamRouting: WorkstreamRoute[];
  /** Results collected from child sessions at merge time. */
  childResults: ChildSessionResult[];
  /** Identity (agent or user) that initiated this fork. */
  initiatedBy: UUID;
  /** Merge strategy specified at fork time; may be overridden during resolution. */
  mergeStrategy: MergeStrategyType;
  /** Metadata block for extensibility. */
  metadata: Record<string, unknown>;
}

/** Mapping of a parent workstream to its destination child session. */
interface WorkstreamRoute {
  /** Workstream ID from the parent session. */
  sourceWorkstreamId: UUID;
  /** Destination child session ID. */
  targetSessionId: UUID;
  /** Whether this workstream was cloned (copied) or moved (transferred exclusively). */
  routingMode: "cloned" | "moved";
}

/** Result summary from a child session at merge time. */
interface ChildSessionResult {
  /** Child session ID. */
  sessionId: UUID;
  /** Outcome classification of this child's execution. */
  outcome: "success" | "partial" | "failure" | "abandoned" | "timeout";
  /** Key deliverables or artifacts produced by this child. */
  deliverableIds: UUID[];
  /** Resource consumption for this child session. */
  resourceUsage: ResourceConsumption;
  /** Quality score assigned by evaluation criteria, if applicable. */
  qualityScore?: number;
  /** Human-readable summary of what this child accomplished. */
  summary: string;
}

/** Merge strategy type determining how child results are combined. */
type MergeStrategyType = "auto-best" | "manual-select" | "agent-mediate" | "append-all" | "union-merge" | "discard-losers";
```

**Key design notes.** The `forkType` field provides the high-level classification that determines default behaviors for merge resolution and resource allocation. A `speculative` fork expects most branches to be discarded; an `ab-test` fork expects explicit comparison; an `error-recovery` fork treats the parent as potentially corrupt and the children as remediation attempts. The `workstreamRouting` array records whether each workstream was `cloned` (both parent and child retain a copy) or `moved` (exclusive transfer to the child), which has significant implications for merge semantics — moved workstreams must be reintegrated, while cloned workstreams may produce divergent results that need conflict resolution. The `partially-merged` status handles the common case where some child sessions succeed and others fail: the system merges successful results while abandoning failed branches without discarding the entire fork. The `MergeStrategyType` is specified at fork time as a default but can be overridden during resolution based on observed outcomes.

### 8.2 Competitive Execution & Speculation

#### 8.2.1 ForkSpec

A ForkSpec is the declarative configuration that defines why and how execution branches. It is the planning document for parallelism: it specifies the branching strategy (speculative exploration, parallel-approach comparison, A-B testing, open-ended exploration, or error-recovery remediation), the resource budget allocated to each branch, the merge strategy that will govern how branches are reintegrated, and the evaluation criteria that determine branch success or failure. The ForkSpec is created before the fork executes, serving as both the instruction set for the forking mechanism and the contract against which the fork's outcomes are judged. It transforms parallel execution from an ad-hoc operation into a structured, auditable, and reproducible pattern.

```typescript
interface ForkSpec {
  /** Unique identifier for this fork specification. */
  id: UUID;
  /** Human-readable name describing the fork's purpose. */
  name: string;
  /** Detailed description of the problem being addressed through branching. */
  description: string;
  /** Classification of the fork's strategic intent. */
  strategy: ForkStrategyType;
  /** Number of child branches to create. */
  branchCount: number;
  /** Per-branch configuration defining the unique approach or parameters of each branch. */
  branchConfigs: BranchConfig[];
  /** Merge strategy for combining child branch results. */
  mergeStrategy: MergeStrategyType;
  /** Evaluation criteria for comparing branch outcomes. */
  evaluationCriteria: EvaluationCriterion[];
  /** Overall resource budget shared across all branches. */
  totalBudget: ResourceBudget;
  /** Per-branch resource budget overrides; branches without overrides share the total budget equally. */
  perBranchBudgets?: Record<UUID, ResourceBudget>;
  /** Timeout after which uncompleted branches are automatically terminated. */
  globalTimeoutMs: number;
  /** Condition that, when satisfied by any branch, terminates all other branches (race mode). */
  earlyTerminationCondition?: string;
  /** Whether branches should be terminated as soon as a clear winner is identified. */
  enableRaceMode: boolean;
  /** Timestamp when this spec was created. */
  createdAt: Timestamp;
  /** Identity that authored this fork specification. */
  authoredBy: UUID;
  /** Reference to the ExecutionPlan or PlanCheckpoint that authorized this fork. */
  authorizedByPlanId?: UUID;
  /** Metadata block for extensibility. */
  metadata: Record<string, unknown>;
}

/** Classification of fork strategic intent. */
type ForkStrategyType = "speculative" | "parallel-approach" | "ab-test" | "exploration" | "error-recovery";

/** Configuration for an individual branch within a fork. */
interface BranchConfig {
  /** Unique identifier for this branch configuration. */
  id: UUID;
  /** Human-readable label for this branch (e.g., "optimize-for-speed", "optimize-for-readability"). */
  label: string;
  /** Detailed description of this branch's unique approach or hypothesis. */
  description: string;
  /** Agent assignment specification for this branch. */
  agentAssignment: AgentAssignmentSpec;
  /** Model configuration override for this branch. */
  modelOverride?: ModelConfiguration;
  /** Context modifications applied to this branch's SessionContext copy. */
  contextModifications: ContextModification[];
  /** Task subset or execution plan variant assigned to this branch. */
  taskAssignment?: UUID;
  /** Priority weight for this branch relative to sibling branches. */
  priorityWeight: number;
}

/** Specification for agent assignment to a branch. */
interface AgentAssignmentSpec {
  /** Specific agent IDs to assign; empty if auto-selected. */
  specificAgentIds: UUID[];
  /** Required capability profile for auto-selected agents. */
  requiredCapabilities?: string[];
  /** Number of agents to assign to this branch. */
  agentCount: number;
}

/** A single context modification applied to a branch's inherited SessionContext. */
interface ContextModification {
  /** JSONPath or dot-notation path to the context field being modified. */
  path: string;
  /** Operation type: "set", "override", "append", or "remove". */
  operation: "set" | "override" | "append" | "remove";
  /** New value for the field (null for "remove"). */
  value: unknown;
  /** Human-readable rationale for this modification. */
  rationale: string;
}

/** A single evaluation criterion for comparing branch outcomes. */
interface EvaluationCriterion {
  /** Human-readable name of the criterion. */
  name: string;
  /** Criterion type determining how it is measured. */
  type: "first-completion" | "quality-score" | "cost-minimum" | "custom-function" | "user-selection";
  /** Weight of this criterion in the overall evaluation (0.0 to 1.0). */
  weight: number;
  /** For "custom-function" type: the function identifier or expression to evaluate. */
  customEvaluator?: string;
  /** For "quality-score" type: the quality dimensions to assess. */
  qualityDimensions?: string[];
  /** Whether this criterion is required (must be satisfied) or merely preferred. */
  required: boolean;
}
```

**Key design notes.** The `branchConfigs` array is the heart of the ForkSpec: each element defines a unique approach by specifying distinct agent assignments, model configurations, context modifications, and task subsets. This enables sophisticated parallel-approach patterns such as "Agent A uses Claude with high temperature for creative exploration while Agent B uses GPT-4 with low temperature for conservative optimization." The `contextModifications` array uses path-based modifications rather than full context replacement to keep branch configurations declarative and diffable — a branch's modifications can be reviewed independently to understand how it diverges from its siblings. The `enableRaceMode` flag activates first-to-win semantics: when enabled and combined with an `earlyTerminationCondition`, the fork transforms into a RaceCondition (Section 8.2.2). The `EvaluationCriterion` array supports multi-objective comparison, allowing forks to be resolved on composite scores rather than single dimensions.

#### 8.2.2 RaceCondition

A RaceCondition is the structured representation of first-to-win parallelism: multiple workstreams compete to solve the same problem or reach the same goal, and the first to satisfy the evaluation criteria terminates the race and claims victory. This pattern is distinct from general forking because the competing workstreams share an identical goal but pursue it through different means — different agents, different models, different strategies — and the race mechanism itself determines how the winner is selected and what happens to the losers. The RaceCondition shape captures the competition parameters, the competing workstream references, the winner determination logic, the disposition policy for non-winning workstreams, and the final result.

```typescript
interface RaceCondition {
  /** Unique identifier for this race condition record. */
  id: UUID;
  /** Human-readable description of the race objective. */
  description: string;
  /** Current state of the race lifecycle. */
  status: "pending" | "active" | "winner-determined" | "resolving" | "resolved" | "abandoned" | "timeout";
  /** References to workstreams competing in this race. */
  competingWorkstreamIds: UUID[];
  /** Reference to the winning workstream; null until a winner is determined. */
  winnerWorkstreamId?: UUID;
  /** Method for determining the winner among competing workstreams. */
  winnerDetermination: WinnerDeterminationMethod;
  /** Disposition policy for workstreams that did not win. */
  loserDisposition: LoserDispositionPolicy;
  /** Evaluation criteria applied to determine the winner. */
  evaluationCriteria: EvaluationCriterion[];
  /** Maximum duration of the race in milliseconds. */
  timeoutMs: number;
  /** Timestamp when the race was initiated. */
  startedAt: Timestamp;
  /** Timestamp when the winner was determined or race ended. */
  completedAt?: Timestamp;
  /** Results collected from all competing workstreams at race end. */
  competitorResults: CompetitorResult[];
  /** Whether partial results from losing workstreams should be preserved. */
  preserveLoserArtifacts: boolean;
  /** Reference to the parent ForkSpec that authorized this race, if any. */
  parentForkSpecId?: UUID;
  /** Identity that initiated this race. */
  initiatedBy: UUID;
  /** Metadata block for extensibility. */
  metadata: Record<string, unknown>;
}

/** Method for determining the race winner. */
interface WinnerDeterminationMethod {
  /** Primary determination mechanism. */
  method: "first-completion" | "best-quality" | "lowest-cost" | "user-selection" | "evaluation-function";
  /** For "evaluation-function": the function identifier or expression. */
  evaluatorFunction?: string;
  /** For "best-quality": the quality dimensions to compare. */
  qualityDimensions?: string[];
  /** For "evaluation-function": scoring direction (higher or lower is better). */
  scoringDirection?: "higher" | "lower";
  /** Minimum threshold that must be met for a winner to be declared. */
  minimumThreshold?: number;
  /** Whether ties are allowed; if false, tiebreaking logic is applied. */
  allowTies: boolean;
  /** Tiebreaking criterion when multiple workstreams satisfy the primary method equally. */
  tiebreaker?: "random" | "lowest-cost" | "fastest" | "priority" | "user-choice";
}

/** Disposition policy for losing workstreams. */
interface LoserDispositionPolicy {
  /** Primary action applied to losing workstreams. */
  action: "discard" | "archive" | "merge-as-alternative" | "promote-to-workstream" | "pause-for-review";
  /** For "archive": the archive category or tag for later retrieval. */
  archiveCategory?: string;
  /** For "merge-as-alternative": merge strategy for incorporating loser results. */
  mergeStrategy?: MergeStrategyType;
  /** Whether losing workstreams should be terminated immediately upon winner determination. */
  immediateTermination: boolean;
  /** Retention period for loser artifacts in milliseconds; null means retain indefinitely. */
  artifactRetentionMs?: number;
  /** Human-readable rationale for this disposition policy. */
  rationale: string;
}

/** Result from a single competing workstream in a race. */
interface CompetitorResult {
  /** Competing workstream ID. */
  workstreamId: UUID;
  /** Outcome classification for this competitor. */
  outcome: "winner" | "runner-up" | "failed" | "abandoned" | "timeout";
  /** Primary deliverable or artifact produced by this workstream. */
  deliverableIds: UUID[];
  /** Scores per evaluation criterion. */
  criterionScores: Record<string, number>;
  /** Overall composite score. */
  compositeScore?: number;
  /** Resource consumption for this competitor. */
  resourceUsage: ResourceConsumption;
  /** Timestamp when this competitor completed or was terminated. */
  completedAt?: Timestamp;
  /** Human-readable summary of this competitor's approach and result. */
  summary: string;
}
```

**Key design notes.** The `WinnerDeterminationMethod` sub-interface is designed for extensibility: the `evaluation-function` option allows arbitrary JavaScript or LLM-evaluated functions to score workstream outputs, enabling domain-specific quality assessment (e.g., "choose the solution with the lowest cyclomatic complexity"). The `minimumThreshold` field prevents races from declaring a winner when all competitors produce poor results — if no workstream meets the threshold, the race enters `timeout` status and triggers escalation. The `LoserDispositionPolicy` is critical for resource efficiency: `discard` immediately frees resources, `archive` preserves results for future retrieval, `merge-as-alternative` incorporates runner-up solutions as additional options, and `promote-to-workstream` converts a losing branch into an independent workstream with its own objectives. The `preserveLoserArtifacts` flag provides a separate control from workstream disposition: even when workstreams are discarded, their artifacts may be retained for forensic analysis or retrospective comparison.

#### 8.2.3 SpeculativeExecution

SpeculativeExecution is the what-if machinery of the agentic workspace — a mechanism by which an agent explores hypothetical changes, alternative implementations, or future scenarios without modifying any shared state. Unlike a standard fork which creates persistent parallel branches, speculation operates on virtual state deltas: all changes are recorded as proposed differences against a base state, evaluated for predicted outcomes, and then either adopted into the mainline or rejected without ever touching the workspace's ground truth. This shape is the foundation of agentic foresight — it is how agents "think ahead" about the consequences of a refactoring, estimate the impact of a dependency upgrade, or preview the effects of a configuration change before committing to it.

```typescript
interface SpeculativeExecution {
  /** Unique identifier for this speculative execution. */
  id: UUID;
  /** Human-readable description of the hypothesis being tested. */
  hypothesis: string;
  /** Detailed description of the speculative scenario. */
  description: string;
  /** Current lifecycle state of the speculation. */
  status: "formulating" | "executing" | "evaluating" | "recommending" | "adopted" | "rejected" | "exploring-further" | "merged-conditionally";
  /** Reference to the ExecutionSession or Workstream that initiated this speculation. */
  initiatedBySessionId: UUID;
  /** Reference to the agent performing the speculative work. */
  executingAgentId: UUID;
  /** Base state snapshot against which the speculation operates. */
  baseSnapshotId: UUID;
  /** Ordered list of virtual state deltas produced by the speculation. */
  virtualDeltas: VirtualDelta[];
  /** Predicted outcomes if this speculation were adopted. */
  predictedOutcomes: PredictedOutcome[];
  /** Final recommendation produced by the speculation evaluator. */
  recommendation: SpeculativeRecommendation;
  /** Evaluation score indicating confidence in the speculation's correctness (0.0 to 1.0). */
  confidenceScore: number;
  /** Resource consumption for executing this speculation. */
  resourceUsage: ResourceConsumption;
  /** Timestamp when speculation was initiated. */
  startedAt: Timestamp;
  /** Timestamp when speculation completed evaluation. */
  completedAt?: Timestamp;
  /** Maximum resource budget allocated to this speculation. */
  budget: ResourceBudget;
  /** Whether the speculation was automatically initiated by the agent or human-triggered. */
  initiationType: "auto" | "human" | "system";
  /** Metadata block for extensibility. */
  metadata: Record<string, unknown>;
}

/** A virtual state delta representing a proposed change within a speculation. */
interface VirtualDelta {
  /** Unique identifier for this delta. */
  id: UUID;
  /** Sequence order of this delta within the speculation. */
  sequenceIndex: number;
  /** Type of entity being modified. */
  entityType: "artifact" | "memory" | "task" | "goal" | "context" | "configuration";
  /** Reference to the entity being modified. */
  entityId: UUID;
  /** Type of change being proposed. */
  operation: "create" | "modify" | "delete" | "replace";
  /** Snapshot of the entity state before the change (null for creates). */
  beforeState?: unknown;
  /** Proposed entity state after the change (null for deletes). */
  afterState?: unknown;
  /** Human-readable description of what this delta changes. */
  description: string;
  /** Estimated impact of this delta on related entities. */
  estimatedImpact: ImpactEstimate;
}

/** Estimated impact of a virtual delta. */
interface ImpactEstimate {
  /** Number of entities directly affected by this change. */
  directlyAffectedCount: number;
  /** Number of entities transitively affected by this change. */
  transitivelyAffectedCount: number;
  /** Risk level of unintended side effects. */
  sideEffectRisk: "low" | "medium" | "high";
  /** Estimated effort to implement this change in the real workspace. */
  estimatedImplementationEffort: "low" | "medium" | "high";
  /** Estimated effort to revert this change if adopted and later found undesirable. */
  estimatedRevertEffort: "low" | "medium" | "high";
}

/** Predicted outcome of adopting a speculation. */
interface PredictedOutcome {
  /** Dimension being predicted (e.g., "performance", "maintainability", "security"). */
  dimension: string;
  /** Direction of predicted change. */
  direction: "improve" | "degrade" | "neutral" | "uncertain";
  /** Magnitude of predicted change on a 0.0 to 1.0 scale. */
  magnitude: number;
  /** Confidence in this prediction (0.0 to 1.0). */
  confidence: number;
  /** Rationale for the prediction. */
  rationale: string;
}

/** Final recommendation from a speculative execution. */
interface SpeculativeRecommendation {
  /** Recommended action. */
  action: "adopt" | "reject" | "explore-further" | "merge-conditionally";
  /** Confidence in this recommendation (0.0 to 1.0). */
  confidence: number;
  /** Human-readable explanation of the recommendation and its reasoning. */
  explanation: string;
  /** For "explore-further": suggested follow-up speculations to run. */
  followUpSuggestions?: string[];
  /** For "merge-conditionally": conditions that must be satisfied before adoption. */
  adoptionConditions?: string[];
  /** For "adopt": ordered sequence of delta IDs to apply. */
  adoptionSequence?: UUID[];
}
```

**Key design notes.** The `virtualDeltas` array is the core isolation mechanism: every proposed change is recorded as a delta with before/after snapshots rather than applied in-place. This enables the speculation system to present a complete "diff view" of the hypothetical world state for human or agent review. The `ImpactEstimate` on each delta provides the data needed for risk assessment — a delta with high `transitivelyAffectedCount` and high `sideEffectRisk` should trigger additional scrutiny even if the primary change appears correct. The `recommendation.action` field supports `explore-further` which creates a follow-up speculation with refined parameters, enabling chains of speculative reasoning that progressively narrow toward an optimal solution. The `merge-conditionally` action is particularly powerful: it allows partial adoption where only low-risk deltas are applied immediately while high-risk deltas are queued for additional validation. Crucially, `SpeculativeExecution` never modifies shared state directly — adoption is always mediated through a separate merge operation that applies deltas through the same conflict resolution pathway used for parallel workstream merges.

### 8.3 Synchronization, Conflict Resolution & Scheduling

#### 8.3.1 Barrier

A Barrier is a synchronization primitive that halts progress across multiple workstreams until a specified condition is satisfied. When a barrier is created, participating workstreams continue execution until each reaches the barrier point; only when all participants have arrived (or a timeout fires) does the barrier release, allowing any workstream to proceed. Barriers are essential for coordinated parallelism: they ensure that all branches of a fork have produced candidate solutions before comparison begins, that all agents have completed their analysis before a synthesis phase starts, and that partial results from parallel workstreams are collected before a merge operation commences. The predicate-based release condition allows sophisticated synchronization logic beyond simple counting.

```typescript
interface Barrier {
  /** Unique identifier for this barrier. */
  id: UUID;
  /** Human-readable description of what this barrier is synchronizing. */
  description: string;
  /** Current state of the barrier lifecycle. */
  status: "forming" | "waiting" | "predicate-evaluating" | "releasing" | "released" | "timed-out" | "abandoned";
  /** References to workstreams registered as participants in this barrier. */
  participantWorkstreamIds: UUID[];
  /** Workstreams that have arrived at the barrier. */
  arrivedWorkstreamIds: UUID[];
  /** Workstreams that have not yet arrived. */
  pendingWorkstreamIds: UUID[];
  /** Release predicate that determines when the barrier opens. */
  releasePredicate: ReleasePredicate;
  /** Maximum time to wait for all participants before timing out. */
  timeoutMs: number;
  /** Timestamp when the barrier was created. */
  createdAt: Timestamp;
  /** Timestamp when the barrier released or timed out. */
  releasedAt?: Timestamp;
  /** Timestamp when the barrier will time out if not yet released. */
  deadlineAt: Timestamp;
  /** Results collected from participants at barrier release time. */
  collectedResults: BarrierParticipantResult[];
  /** Reference to the SessionFork or RaceCondition this barrier was created for, if any. */
  parentForkId?: UUID;
  /** Action to take when barrier times out. */
  timeoutAction: TimeoutAction;
  /** Identity that created this barrier. */
  createdBy: UUID;
  /** Metadata block for extensibility. */
  metadata: Record<string, unknown>;
}

/** Predicate determining when a barrier releases. */
interface ReleasePredicate {
  /** Predicate type defining the release condition semantics. */
  type: "all-arrived" | "count-reached" | "predicate-function" | "any-arrived" | "condition-satisfied";
  /** For "count-reached": minimum number of participants that must arrive. */
  requiredCount?: number;
  /** For "predicate-function": the function or expression to evaluate. */
  predicateExpression?: string;
  /** For "condition-satisfied": the condition that must be met. */
  condition?: string;
  /** Whether the predicate is evaluated continuously or only on participant arrival events. */
  evaluationMode: "event-driven" | "continuous";
}

/** Result contributed by a single participant at barrier release. */
interface BarrierParticipantResult {
  /** Workstream ID of the participant. */
  workstreamId: UUID;
  /** Timestamp when this participant arrived at the barrier. */
  arrivedAt: Timestamp;
  /** Optional payload delivered by the participant (e.g., candidate solution, analysis result). */
  payload?: unknown;
  /** Classification of this participant's contribution. */
  contributionType: "candidate-solution" | "analysis" | "artifact" | "confirmation" | "empty";
  /** Human-readable summary of what this participant contributed. */
  summary: string;
}

/** Action taken when a barrier times out. */
interface TimeoutAction {
  /** Primary action on timeout. */
  action: "release-anyway" | "release-with-partial" | "abandon" | "escalate" | "extend-timeout";
  /** For "extend-timeout": additional time in milliseconds. */
  extensionMs?: number;
  /** For "release-with-partial": minimum results needed to release. */
  minimumResultsRequired?: number;
  /** Identity to notify on timeout escalation. */
  escalateTo?: UUID;
}
```

**Key design notes.** The `releasePredicate.type` field supports patterns beyond the classic "wait for all": `count-reached` allows barriers to release when a quorum is present, `predicate-function` enables LLM-evaluated conditions ("release when at least one candidate solution scores above 0.8 on the quality metric"), and `any-arrived` supports fan-out/fan-in patterns where the first result triggers downstream processing. The `collectedResults` array transforms the barrier from a pure synchronization primitive into a result-aggregation mechanism — each participant deposits a typed payload that becomes available to all participants after release. This is how parallel-approach forks compare their candidate solutions: each workstream delivers its result to the barrier, and upon release, all results are visible for evaluation. The `TimeoutAction` configuration is critical for preventing indefinite stalls when a workstream crashes or enters an unrecoverable state; the `release-with-partial` option ensures that the system can make forward progress even when not all participants arrive.

#### 8.3.2 MergeConflict

A MergeConflict is the structured representation of incompatibility detected when parallel workstreams attempt to modify the same entities, pursue divergent goals, or produce semantically contradictory outputs. Merge conflicts are the hard problem of parallel execution: they occur at the intersection of independent workstreams and shared state, and their resolution determines whether parallelism produces coherent results or chaos. This shape captures the conflict type (artifact-edit collision, goal divergence, memory contradiction, or semantic disagreement), an LLM-generated summary that explains what differs and why, the conflicting values from each workstream, the resolution strategy being applied, and the resolution outcome. Every merge conflict is a first-class entity with its own lifecycle, enabling human oversight, agent-mediated resolution, and retrospective analysis of conflict patterns.

```typescript
interface MergeConflict {
  /** Unique identifier for this merge conflict. */
  id: UUID;
  /** Human-readable description of the conflict. */
  description: string;
  /** Classification of the conflict's nature. */
  conflictType: "artifact-edit" | "goal-divergence" | "memory-contradiction" | "semantic-disagreement";
  /** Current state of the conflict resolution lifecycle. */
  status: "detected" | "analyzing" | "awaiting-resolution" | "agent-mediating" | "resolved" | "escalated" | "overridden";
  /** References to the workstreams whose outputs are in conflict. */
  conflictingWorkstreamIds: UUID[];
  /** Reference to the parent SessionFork that produced this conflict. */
  sourceForkId?: UUID;
  /** Reference to the entity being contested (artifact, goal, memory entry, etc.). */
  contestedEntityId: UUID;
  /** Type of the contested entity. */
  contestedEntityType: "artifact" | "goal" | "memory" | "task" | "configuration" | "context";
  /** LLM-generated summary explaining the nature of the conflict and the differences between versions. */
  conflictSummary: ConflictSummary;
  /** The competing proposals or values from each conflicting workstream. */
  competingProposals: CompetingProposal[];
  /** Resolution strategy applied to this conflict. */
  resolutionStrategy: ConflictResolutionStrategy;
  /** Resolution outcome once resolved. */
  resolutionOutcome?: ConflictResolutionOutcome;
  /** Timestamp when the conflict was detected. */
  detectedAt: Timestamp;
  /** Timestamp when the conflict was resolved. */
  resolvedAt?: Timestamp;
  /** Identity that resolved the conflict (agent, user, or system). */
  resolvedBy?: UUID;
  /** Resource consumption spent on conflict analysis and resolution. */
  resolutionCost: ResourceConsumption;
  /** Metadata block for extensibility. */
  metadata: Record<string, unknown>;
}

/** LLM-generated summary of a merge conflict. */
interface ConflictSummary {
  /** High-level explanation of what the conflict is about. */
  overview: string;
  /** Detailed explanation of how the conflicting versions differ. */
  differenceExplanation: string;
  /** Analysis of why each workstream made the choices that led to the conflict. */
  rationaleAnalysis: string;
  /** Assessment of the risk of choosing one version over the other. */
  riskAssessment: string;
  /** Suggested resolution approach with rationale. */
  suggestedResolution: string;
  /** Confidence in the conflict summary's accuracy (0.0 to 1.0). */
  confidence: number;
  /** Model identifier of the LLM that generated this summary. */
  generatedByModel: string;
  /** Timestamp when the summary was generated. */
  generatedAt: Timestamp;
}

/** A single competing proposal in a merge conflict. */
interface CompetingProposal {
  /** Workstream that produced this proposal. */
  workstreamId: UUID;
  /** The proposed value or state. */
  proposal: unknown;
  /** Human-readable summary of this proposal. */
  summary: string;
  /** Agent rationale for this proposal. */
  agentRationale: string;
  /** Quality score for this proposal if evaluated (0.0 to 1.0). */
  qualityScore?: number;
}

/** Strategy for resolving a merge conflict. */
interface ConflictResolutionStrategy {
  /** Selected resolution approach. */
  strategy: "auto-prefer-best" | "manual-resolve" | "agent-mediate" | "append-all" | "union-merge" | "timestamp-wins" | "priority-wins";
  /** For "auto-prefer-best": the criteria for determining "best." */
  bestCriteria?: string;
  /** For "agent-mediate": the agent assigned to mediate. */
  mediatorAgentId?: UUID;
  /** For "manual-resolve": the identity responsible for resolution. */
  resolverIdentity?: UUID;
  /** Deadline for resolution before automatic escalation. */
  resolutionDeadline?: Timestamp;
  /** Whether resolution can proceed without human approval. */
  autoResolve: boolean;
  /** Escalation path if resolution fails or deadline passes. */
  escalationPath: EscalationStep[];
}

/** Outcome of a resolved merge conflict. */
interface ConflictResolutionOutcome {
  /** Final resolved value or state. */
  resolvedValue?: unknown;
  /** Which proposal(s) contributed to the final resolution. */
  winningProposalWorkstreamIds: UUID[];
  /** Whether the resolution required human intervention. */
  requiredHumanIntervention: boolean;
  /** Time spent on resolution in milliseconds. */
  resolutionTimeMs: number;
  /** Human-readable explanation of how the conflict was resolved. */
  resolutionExplanation: string;
}

/** A single escalation step in a conflict resolution path. */
interface EscalationStep {
  /** Step order in the escalation sequence. */
  stepIndex: number;
  /** Target identity or role for this escalation step. */
  escalateTo: UUID;
  /** Condition that triggers this escalation. */
  triggerCondition: string;
  /** Action to take at this escalation step. */
  action: "notify" | "assign" | "block-merge" | "abort";
}
```

**Key design notes.** The `conflictSummary` field is generated by an LLM prompted with the competing proposals and their context — it transforms raw diff output into human-meaningful explanation, which is essential because merge conflicts in agentic workspaces often involve semantic disagreements ("should we optimize for latency or throughput?") rather than simple text collisions. The `ConflictResolutionStrategy` supports `agent-mediate` where a designated mediator agent (not one of the conflicting parties) reviews both proposals and produces a synthesized resolution — this is particularly effective for semantic-disagreement conflicts where a neutral third party can find common ground. The `append-all` strategy preserves all competing proposals rather than choosing a winner, which is valuable when the conflict represents a genuine design trade-off that should be documented rather than suppressed. The `escalationPath` array defines a ordered sequence of fallback resolution steps, ensuring that no conflict remains unresolved indefinitely — a conflict that cannot be auto-resolved escalates to a human operator before it can block the entire merge operation.

#### 8.3.3 ConcurrencyPolicy

A ConcurrencyPolicy is the workspace-wide governance mechanism that constrains parallel execution to prevent resource exhaustion, cost overruns, and chaotic proliferation of workstreams. It defines hard limits on concurrent workstreams, token consumption rates, cost caps, auto-scaling behaviors, and scheduling algorithms that determine which workstreams receive resources when demand exceeds supply. The policy is the guardrail that keeps parallelism productive rather than destructive: without it, an overeager agent could spawn unlimited speculative branches, exhausting API budgets and overwhelming the workspace with abandoned workstreams. This shape captures all constraint dimensions, enforcement actions, scaling triggers, and scheduling parameters in a single auditable configuration.

```typescript
interface ConcurrencyPolicy {
  /** Unique identifier for this policy. */
  id: UUID;
  /** Human-readable name of the policy. */
  name: string;
  /** Scope of policy application: workspace, project, or session. */
  scope: "workspace" | "project" | "session";
  /** Reference to the entity this policy applies to. */
  scopeTargetId: UUID;
  /** Current enforcement state of the policy. */
  status: "active" | "monitoring-only" | "paused" | "violation-throttled";
  /** Maximum number of concurrently active workstreams allowed. */
  maxConcurrentWorkstreams: number;
  /** Maximum number of workstreams that can be created within a single session. */
  maxWorkstreamsPerSession: number;
  /** Maximum depth of fork trees (parent → child → grandchild). */
  maxForkDepth: number;
  /** Token rate limiting configuration. */
  tokenRateLimit: TokenRateLimit;
  /** Cost cap configuration. */
  costCap: CostCapConfig;
  /** Auto-scaling configuration for dynamic workstream allocation. */
  autoScaling: AutoScalingConfig;
  /** Scheduling algorithm for allocating resources among competing workstreams. */
  schedulingPolicy: SchedulingPolicy;
  /** Preemption configuration for reclaiming resources from low-priority workstreams. */
  preemption: PreemptionConfig;
  /** Violation handling configuration. */
  violationHandling: ViolationHandlingConfig;
  /** Timestamp when this policy was created. */
  createdAt: Timestamp;
  /** Timestamp when this policy was last modified. */
  updatedAt: Timestamp;
  /** Identity that authored this policy. */
  authoredBy: UUID;
  /** Metadata block for extensibility. */
  metadata: Record<string, unknown>;
}

/** Token rate limiting configuration. */
interface TokenRateLimit {
  /** Maximum input tokens per minute across all workstreams in scope. */
  maxInputTokensPerMinute: number;
  /** Maximum output tokens per minute across all workstreams in scope. */
  maxOutputTokensPerMinute: number;
  /** Burst allowance as a multiplier of the base rate (e.g., 2.0 allows double the rate briefly). */
  burstMultiplier: number;
  /** Action when rate limit is exceeded. */
  exceedAction: "throttle" | "queue" | "reject" | "notify";
  /** Time window in milliseconds for rate limit calculation. */
  windowMs: number;
}

/** Cost cap configuration. */
interface CostCapConfig {
  /** Maximum cost per session in workspace billing currency. */
  maxCostPerSession: number;
  /** Maximum cost per hour across all sessions in scope. */
  maxCostPerHour: number;
  /** Maximum cost per day across all sessions in scope. */
  maxCostPerDay: number;
  /** Action when a cost cap is reached. */
  exceedAction: "pause-new" | "terminate-oldest" | "notify-only" | "block-all";
  /** Percentage of cost cap at which a warning notification is sent. */
  warningThresholdPct: number;
}

/** Auto-scaling configuration for dynamic workstream allocation. */
interface AutoScalingConfig {
  /** Whether auto-scaling is enabled. */
  enabled: boolean;
  /** Metric that triggers scaling decisions. */
  scaleMetric: "queue-depth" | "utilization" | "cost-rate" | "latency" | "custom";
  /** Threshold above which new workstreams are spawned. */
  scaleUpThreshold: number;
  /** Threshold below which workstreams are consolidated. */
  scaleDownThreshold: number;
  /** Maximum workstreams that auto-scaling can create. */
  maxAutoScaledWorkstreams: number;
  /** Cooldown period between scaling actions in milliseconds. */
  cooldownMs: number;
  /** Custom scaling function identifier for "custom" metric type. */
  customScaleFunction?: string;
}

/** Scheduling policy for resource allocation among workstreams. */
interface SchedulingPolicy {
  /** Primary scheduling algorithm. */
  algorithm: "fifo" | "priority" | "dependency-aware" | "deadline-driven" | "fair-share" | "weighted-fair-share";
  /** For "priority": whether priority is absolute or relative. */
  priorityMode?: "absolute" | "relative";
  /** For "deadline-driven": deadline proximity weighting factor. */
  deadlineWeight?: number;
  /** For "fair-share": minimum guaranteed share per workstream (0.0 to 1.0). */
  minShare?: number;
  /** Whether the scheduler can preempt running workstreams. */
  preemptive: boolean;
  /** Time slice in milliseconds for workstream execution before rescheduling. */
  timeSliceMs?: number;
}

/** Preemption configuration for reclaiming resources. */
interface PreemptionConfig {
  /** Whether preemption is enabled. */
  enabled: boolean;
  /** Preemption strategy when resources are needed by higher-priority work. */
  strategy: "priority-based" | "oldest-first" | "least-progress" | "cheapest-save";
  /** Grace period in milliseconds before a preempted workstream is paused. */
  gracePeriodMs: number;
  /** Maximum number of preemptions per workstream before it is abandoned. */
  maxPreemptions: number;
  /** Whether preempted workstreams are checkpointed before pause. */
  checkpointOnPreempt: boolean;
  /** Minimum priority delta required to trigger preemption. */
  minPriorityDelta: number;
}

/** Violation handling configuration. */
interface ViolationHandlingConfig {
  /** Response when a policy limit is violated. */
  response: "log" | "notify" | "throttle" | "block" | "terminate-violator";
  /** Number of violations within the window before escalation. */
  escalationThreshold: number;
  /** Time window for violation counting in milliseconds. */
  violationWindowMs: number;
  /** Escalation action when threshold is exceeded. */
  escalationAction: "notify-admin" | "pause-policy-scope" | "reduce-limits" | "require-approval";
  /** Whether repeated violations trigger automatic policy tightening. */
  autoTighten: boolean;
  /** Tightening factor applied on auto-tighten (e.g., 0.9 reduces limits by 10%). */
  tightenFactor?: number;
}
```

**Key design notes.** The `maxForkDepth` field prevents uncontrolled recursive forking — a speculative branch that spawns further speculations that spawn further speculations — which is a common failure mode in unconstrained agentic systems. The `tokenRateLimit` uses a sliding window with burst allowance to accommodate legitimate traffic spikes while preventing sustained overconsumption; the `throttle` action applies backpressure by slowing token consumption rather than rejecting requests outright, preserving in-flight work. The `SchedulingPolicy` algorithm selection has profound effects on workspace behavior: `fifo` is simple and predictable, `priority` ensures critical workstreams make progress, `dependency-aware` schedules workstreams in topological order to minimize blocking, `deadline-driven` optimizes for on-time completion, and `fair-share` prevents starvation when many workstreams compete. The `autoTighten` mechanism in `ViolationHandlingConfig` is a self-protective feature: if workstreams repeatedly violate policy limits, the system automatically reduces those limits further, creating a feedback loop that forces more conservative behavior from agents. This prevents a runaway agent from circumventing policy through repeated marginal violations.


## 9. Artifacts, Outputs & Deliverables

Everything an agent produces — code, documents, images, bundled packages — is an Artifact. This chapter defines the universal hierarchy: base type with lifecycle and branching, immutable versions, metadata, and subtypes for code, documents, media, and packages.

### 9.1 Artifact Lifecycle & Versioning

Artifact provides identity, lifecycle, and content-type discrimination. ArtifactVersion makes revisions immutable and addressable. ArtifactMetadata accumulates quality metrics and inter-artifact relationships.

#### 9.1.1 Artifact

Artifact unifies all outputs under one identity and lifecycle envelope. `contentType` uses MIME-style identifiers to route to renderers. `lifecycleStatus` tracks `draft`, `review`, `published`, and `deprecated`. `branchHeads` enables parallel editing by multiple agents.

```typescript
interface Artifact {
  /** Globally unique identifier. */
  id: UUID;
  /** Human-readable display name. */
  name: string;
  /** MIME-style content type discriminator. */
  contentType: string;
  /** Lifecycle status controlling visibility and mutability. */
  lifecycleStatus: "draft" | "review" | "published" | "deprecated";
  /** ID of the current default-branch version. */
  currentVersionId: UUID;
  /** Branch name → head version ID for parallel editing. */
  branchHeads: Record<string, UUID>;
  /** Owning entity — user, agent, or organization. */
  ownerId: UUID;
  /** Containing project. */
  projectId: UUID;
  /** Workspace scope for cross-project discoverability. */
  workspaceId: UUID;
  /** Tasks that produced or consume this artifact. */
  taskIds: UUID[];
  /** Classification tags for filtering and search. */
  tags: string[];
  /** Creation timestamp. */
  createdAt: Timestamp;
  /** Last record modification timestamp (not content). */
  updatedAt: Timestamp;
  /** Soft deletion flag for archival. */
  isDeleted: boolean;
}
```

**Key design notes:** `branchHeads` enables parallel agent work. Separating artifact identity from version content ensures references remain valid as content evolves. `contentType` is a plain string for extensibility without schema migration.

#### 9.1.2 ArtifactVersion

ArtifactVersion represents an immutable content snapshot. `contentHash` enables deduplication. `parentVersionIds` forms a DAG supporting branching and merging. `changeSummary` makes history browsable. Content is stored out-of-band via `contentStorageUri`.

```typescript
interface ArtifactVersion {
  /** Globally unique version identifier. */
  id: UUID;
  /** Parent artifact. */
  artifactId: UUID;
  /** Cryptographic hash of normalized content. */
  contentHash: string;
  /** URI to actual content storage. */
  contentStorageUri: string;
  /** Content size in bytes. */
  contentSizeBytes: number;
  /** Parent versions — empty for initial, multiple for merges. */
  parentVersionIds: UUID[];
  /** Human-readable summary of changes. */
  changeSummary: string;
  /** Author entity. */
  authorId: UUID;
  /** Semantic version tag or branch label. */
  label?: string;
  /** Execution session that produced this version. */
  producedBySessionId?: UUID;
  /** Quality score at creation time (0–1). */
  qualityScore?: number;
  /** Automated validation results at creation. */
  validationResults?: ValidationReport;
  /** Creation timestamp. */
  createdAt: Timestamp;
}
```

**Key design notes:** The DAG via `parentVersionIds` enables branching and merging. Content-addressed storage deduplicates across branches. `producedBySessionId` links to ExecutionSession for provenance.

#### 9.1.3 ArtifactMetadata

ArtifactMetadata accumulates data that changes independently of content revisions. `qualityMetrics` stores computed scores. `usageStatistics` tracks engagement. `relationships` captures directed links forming a knowledge graph.

```typescript
interface ArtifactMetadata {
  /** Artifact this metadata describes. */
  artifactId: UUID;
  /** Descriptive text explaining purpose. */
  description: string;
  /** Primary author attribution. */
  authorId: UUID;
  /** License identifier. */
  license?: string;
  /** Computed quality metrics keyed by name. */
  qualityMetrics: Record<string, number>;
  /** Current review status. */
  reviewStatus: {
    state: "pending" | "inReview" | "approved" | "rejected";
    assignedReviewerIds: UUID[];
    completedReviewIds: UUID[];
  };
  /** Engagement statistics. */
  usageStatistics: {
    viewCount: number;
    referenceCount: number;
    lastReferencedAt?: Timestamp;
    incorporatedInPackageIds: UUID[];
  };
  /** Directed relationships to other artifacts. */
  relationships: {
    targetArtifactId: UUID;
    relationType: "derivedFrom" | "supersedes" | "dependsOn" | "references" | "contains";
    createdAt: Timestamp;
  }[];
  /** Custom properties for extensibility. */
  customProperties: Record<string, string>;
  /** Last metadata update. */
  updatedAt: Timestamp;
}
```

**Key design notes:** `relationships` transforms a flat namespace into a navigable graph. Separating metadata from content avoids spurious version creation.

### 9.2 Code-Specific Artifacts

CodeFile models source at rest. Patch represents proposed changes. Diff provides structured change representations for semantic analysis and merging.

#### 9.2.1 CodeFile

CodeFile extends Artifact with language identification, AST references, import/export tracking, and quality metrics. `languageId` enables language-aware tooling. `astReference` points to a cached AST. `imports` and `exports` form a dependency graph. `testCoverage` stores per-line data; `qualityScores` aggregates lint and complexity metrics.

```typescript
interface CodeFile {
  /** Underlying artifact record. */
  artifactId: UUID;
  /** Current version. */
  currentVersionId: UUID;
  /** Programming language identifier. */
  languageId: string;
  /** File path within the project tree. */
  filePath: string;
  /** Cached AST reference. */
  astReference?: string;
  /** Modules imported by this file. */
  imports: {
    sourcePath: string;
    importedSymbols: string[];
    isExternal: boolean;
  }[];
  /** Symbols exported by this file. */
  exports: {
    symbolName: string;
    symbolType: "function" | "class" | "interface" | "variable" | "type" | "default";
    lineNumber: number;
  }[];
  /** Per-line test coverage (line → covered). */
  testCoverage: Record<number, boolean>;
  /** Aggregated quality scores. */
  qualityScores: {
    lintScore: number;
    typecheckScore: number;
    complexityScore: number;
    documentationScore: number;
  };
  /** Test artifacts exercising this file. */
  testedByTestIds: UUID[];
  /** Last analysis timestamp. */
  lastAnalyzedAt: Timestamp;
}
```

**Key design notes:** `filePath` anchors the artifact in the project tree. Import/export arrays are auto-populated by language analyzers. Per-line coverage enables fine-grained visualization.

#### 9.2.2 Patch

Patch is the unit of code contribution. `targetFiles` identifies modified CodeFiles with base versions. `applicabilityConditions` captures prerequisites preventing unsafe application. `automatedTestResults` stores test outcomes; failures block merge approval.

```typescript
interface Patch {
  /** Globally unique patch identifier. */
  id: UUID;
  /** Owning artifact (patches are versioned artifacts). */
  artifactId: UUID;
  /** Title describing change intent. */
  title: string;
  /** Detailed rationale. */
  description: string;
  /** Target files with base versions. */
  targetFiles: {
    codeFileArtifactId: UUID;
    baseVersionId: UUID;
  }[];
  /** Referenced diff records. */
  diffIds: UUID[];
  /** Prerequisites for safe application. */
  applicabilityConditions: {
    requiredBaseVersions: Record<UUID, UUID>;
    environmentConstraints?: string[];
    dependencyRequirements?: Record<string, string>;
  };
  /** Automated test results. */
  automatedTestResults: {
    testRunId: UUID;
    passed: boolean;
    passedCount: number;
    failedCount: number;
    skippedCount: number;
    durationMs: number;
  };
  /** Review discussion threads. */
  reviewThreadIds: UUID[];
  /** Pipeline status. */
  status: "draft" | "readyForReview" | "inReview" | "approved" | "rejected" | "merged";
  /** Author entity. */
  authorId: UUID;
  /** Creation timestamp. */
  createdAt: Timestamp;
  /** Last update. */
  updatedAt: Timestamp;
}
```

**Key design notes:** Separating Patch from Diff allows multiple diffs per patch. `applicabilityConditions` prevents unsafe application in multi-agent workflows.

#### 9.2.3 Diff

Diff stores changes in a structured format for semantic analysis. `changeType` classifies intent enabling filtered views. `Hunks` divide changes into regions with context for merge resolution. `Stats` provides aggregate metrics.

```typescript
interface Diff {
  /** Globally unique diff identifier. */
  id: UUID;
  /** Source version (null for additions). */
  beforeVersionId?: UUID;
  /** Target version (null for deletions). */
  afterVersionId?: UUID;
  /** Semantic classification of change intent. */
  changeType: "addition" | "deletion" | "modification" | "refactor" | "bugfix" | "documentation";
  /** Change regions with context. */
  hunks: {
    beforeStartLine: number;
    afterStartLine: number;
    removedLines: string[];
    addedLines: string[];
    contextLines: string[];
  }[];
  /** Aggregate statistics. */
  stats: {
    filesChanged: number;
    linesAdded: number;
    linesRemoved: number;
    complexityDelta: number;
  };
  /** Associated patch. */
  patchId?: UUID;
  /** Generation timestamp. */
  createdAt: Timestamp;
}
```

**Key design notes:** `changeType` is machine-assigned via change analysis. Hunks with context enable automatic conflict resolution. `complexityDelta` signals risk for review prioritization.

### 9.3 Document & Mixed-Media Artifacts

These shapes extend the artifact model to non-code outputs with equal structural fidelity.

#### 9.3.1 Document

Document models non-code text with format, outline structure, embedded media, and export configuration. `format` determines editing tools. `outline` stores headings for navigation. `embeddedMediaIds` references MediaAssets; `exportTargets` configures publishing pipelines.

```typescript
interface Document {
  /** Underlying artifact record. */
  artifactId: UUID;
  /** Current version. */
  currentVersionId: UUID;
  /** Native content format. */
  format: "markdown" | "structured-text" | "rich-text" | "latex";
  /** Hierarchical outline for navigation. */
  outline: {
    level: number;
    title: string;
    lineNumber: number;
  }[];
  /** Embedded media asset references. */
  embeddedMediaIds: UUID[];
  /** Export destinations with formatting. */
  exportTargets: {
    format: "pdf" | "html" | "markdown" | "docx";
    destinationUri?: string;
    templateId?: UUID;
    lastExportedAt?: Timestamp;
  }[];
  /** Word count. */
  wordCount: number;
  /** Estimated reading time in minutes. */
  readingTimeMinutes: number;
  /** Content language (ISO 639-1). */
  language: string;
}
```

**Key design notes:** The eagerly extracted `outline` enables fast navigation. `embeddedMediaIds` maintains referential integrity. `exportTargets` enables push-button publishing on transition to `published`.

#### 9.3.2 MediaAsset

MediaAsset represents binary artifacts — images, audio, video. `formatMetadata` stores dimensions and duration. `generationParameters` captures AI generation config. `previewVariants` references thumbnails for efficient browsing.

```typescript
interface MediaAsset {
  /** Underlying artifact record. */
  artifactId: UUID;
  /** Current version. */
  currentVersionId: UUID;
  /** Media category. */
  mediaType: "image" | "audio" | "video" | "3d-model";
  /** Technical format metadata. */
  formatMetadata: {
    mimeType: string;
    width?: number;
    height?: number;
    durationSeconds?: number;
    sampleRate?: number;
    colorSpace?: string;
    fileSizeBytes: number;
  };
  /** AI generation parameters, if applicable. */
  generationParameters?: {
    prompt: string;
    negativePrompt?: string;
    modelId: string;
    seed?: number;
    additionalParams: Record<string, string | number | boolean>;
  };
  /** Encoding configuration. */
  compressionSettings: {
    codec: string;
    quality: number;
    bitrate?: number;
  };
  /** Pre-generated previews for efficient display. */
  previewVariants: {
    variantType: "thumbnail" | "lowres" | "poster" | "waveform";
    storageUri: string;
    width?: number;
    height?: number;
  }[];
  /** Back-references to embedding documents. */
  embeddedInDocumentIds: UUID[];
}
```

**Key design notes:** `generationParameters` enables reproducibility. Full versioning preserves creative history. `previewVariants` prevents full-resolution downloads.

#### 9.3.3 ExportPackage

ExportPackage bundles artifacts for distribution. The `manifest` is a bill of materials with exact version IDs for reproducible builds. `bundlingRules` configures structure and transformations. `validation` records pre-distribution checks. `distributionTargets` specifies destinations.

```typescript
interface ExportPackage {
  /** Underlying artifact record. */
  artifactId: UUID;
  /** Current version. */
  currentVersionId: UUID;
  /** Bill of materials — every included artifact. */
  manifest: {
    artifactId: UUID;
    versionId: UUID;
    includedPath: string;
    transformation?: "none" | "minify" | "transpile" | "compress" | "convert";
  }[];
  /** Package structure and transformation rules. */
  bundlingRules: {
    baseDirectory: string;
    includePatterns: string[];
    excludePatterns: string[];
    transformations: {
      pattern: string;
      operation: "minify" | "transpile" | "compress" | "convert";
      targetFormat?: string;
    }[];
  };
  /** Pre-distribution validation. */
  validation: {
    checksumValid: boolean;
    licenseScanPassed: boolean;
    sizeWithinLimits: boolean;
    vulnerabilityScanPassed?: boolean;
    completedAt: Timestamp;
  };
  /** Distribution destinations with tracking. */
  distributionTargets: {
    targetType: "registry" | "s3" | "file-server" | "email";
    targetUri: string;
    deploymentStatus: "pending" | "inProgress" | "completed" | "failed";
    deployedAt?: Timestamp;
    artifactUri?: string;
  }[];
  /** Total size in bytes. */
  totalSizeBytes: number;
  /** Creation trigger. */
  triggerType: "manual" | "scheduled" | "event";
}
```

**Key design notes:** Per-artifact versioning ensures reproducible builds. `bundlingRules` enables source-to-distribution pipelines. `validation` gates distribution. Multi-channel release is supported with per-destination tracking.

## 10. Temporal Model, History & Versioning

Every entity in an agentic workspace — every artifact, plan, conversation, and agent state — is potentially time-variant. The temporal model is a foundational subsystem that enables time-travel debugging, counterfactual analysis, branching parallel realities, and the human question "show me the workspace exactly as it was on Tuesday at 3pm." This chapter defines how time is represented (Timeline, Event), how state is preserved (Snapshot, Tag), how divergent futures are explored (Branch), and how past states are reconstructed and replayed (StateReconstruction, ReplayConfig, HistoricalView). These shapes build upon ArtifactVersion (Chapter 9), PlanCheckpoint (Chapter 5), and SessionFork (Chapter 8), unifying them into a coherent history and versioning framework.

### 10.1 Timeline & Event Sequencing

Timelines are the backbone of the temporal system. Every entity carries an associated Timeline that records every change as an ordered sequence of atomic Events. A hybrid logical/physical clock combines Lamport timestamps for causal consistency with wall-clock timestamps for human-queryable history, resolving the tension between "what happened before what" (causality) and "what happened at 3pm" (human time).

#### 10.1.1 Timeline

A Timeline is the ordered event sequence for a specific entity or the workspace as a whole. It maintains the complete history of changes — linear for simple entities, branching for artifacts and plans that support parallel evolution. The hybrid clock ordering ensures causally related events are correctly sequenced even when wall-clock timestamps are ambiguous due to distributed execution. Every Timeline is append-only; modifications to history are prohibited, ensuring the temporal model is a trustworthy foundation for audit and reconstruction.

```typescript
interface Timeline {
  /** Unique identifier for the timeline. */
  id: UUID;
  /** Entity this timeline tracks (workspace, project, artifact, agent, etc.). */
  subjectId: UUID;
  /** Type of entity being tracked — determines validation rules and event schemas. */
  subjectType: "workspace" | "project" | "artifact" | "agent" | "plan" | "conversation" | "system";
  /** Ordered sequence of event references in hybrid-clock order. */
  eventIds: UUID[];
  /** Current Lamport clock value — monotonically incrementing logical timestamp. */
  lamportClock: number;
  /** ID of the snapshot that serves as the base state for this timeline. */
  baseSnapshotId?: UUID;
  /** Branch this timeline belongs to; null for the default (main) branch. */
  branchId?: UUID;
  /** Whether this timeline supports branching (artifacts, plans) or is strictly linear (audit logs). */
  supportsBranching: boolean;
  /** When this timeline was created. */
  createdAt: Timestamp;
  /** When the most recent event was appended. */
  lastEventAt: Timestamp;
  /** Total number of events in the timeline. */
  eventCount: number;
}
```

**Key design notes.** The `lamportClock` field is central to the hybrid clock system: every event carries both a Lamport value (for causal ordering) and a wall-clock timestamp (for human queries), resolving the clock-skew problem that arises when distributed agents generate events with unreliable local clocks. The `supportsBranching` boolean distinguishes linear-only timelines (system-wide audit trails) from branch-capable timelines (artifact edit histories). The `baseSnapshotId` enables efficient state reconstruction by providing a known-good starting point rather than replaying from an empty state. Timelines are append-only by design; historical modification would invalidate Snapshot references, Branch lineages, and any StateReconstruction built upon them.

#### 10.1.2 Event

An Event is the atomic unit of history — the smallest indivisible occurrence that changes workspace state. Each Event captures what happened, when, who caused it, which entities were affected, and the state immediately before and after. The before/after snapshots embedded in each Event enable fine-grained state reconstruction without requiring a full Snapshot at every change. Causal references link each Event to its triggering predecessor, creating a directed acyclic graph of causality across the workspace.

```typescript
interface Event {
  /** Unique identifier for the event. */
  id: UUID;
  /** Timeline this event belongs to. */
  timelineId: UUID;
  /** Wall-clock timestamp of the event occurrence. */
  timestamp: Timestamp;
  /** Lamport logical clock value ensuring causal ordering across distributed actors. */
  lamportTs: number;
  /** Identity (user, agent, service, or system) that initiated this event. */
  actorId: UUID;
  /** Classification of the event type — determines payload schema. */
  eventType: string;
  /** Strongly typed payload specific to the event type (e.g., artifact edit, task status change). */
  payload: Record<string, unknown>;
  /** Vector clock for multi-actor causal tracking across concurrent workstreams. */
  vectorClock?: Record<UUID, number>;
  /** IDs of entities directly affected by this event. */
  affectedEntityIds: UUID[];
  /** Snapshot of affected entity state immediately before the event. */
  beforeSnapshot?: Record<string, unknown>;
  /** Snapshot of affected entity state immediately after the event. */
  afterSnapshot?: Record<string, unknown>;
  /** ID of the event that directly triggered this one; null if root cause. */
  triggeredBy?: UUID;
  /** IDs of concurrent events that happened-before this event in vector-clock terms. */
  concurrentWith?: UUID[];
  /** IDs of events that must be processed before this event for correct state reconstruction. */
  causalDependencies: UUID[];
  /** Whether this event was generated by a human actor, an agent, or the system. */
  origin: "human" | "agent" | "system";
  /** Whether this event has been materialized into a Snapshot (enables incremental snapshotting). */
  isCheckpointed: boolean;
}
```

**Key design notes.** The `beforeSnapshot` and `afterSnapshot` fields are delta-sized — they contain only the state of directly affected entities, not the entire workspace. This balances reconstruction speed against storage efficiency. The `vectorClock` field enables precise reasoning about concurrency: when two agents in separate Workstreams (Chapter 8) modify related artifacts, the vector clock reveals whether one event strictly happened-before the other or whether they are genuinely concurrent. The `triggeredBy` reference creates a causal chain linking derived events to their origins; for example, a "task completed" event triggered by an "artifact published" event carries a back-reference enabling full provenance traversal. Events are immutable after creation — this immutability is the foundation upon which Snapshot integrity, Branch consistency, and audit trustworthiness depend.

#### 10.1.3 TemporalQuery

TemporalQuery is the interface that enables agents and users to interrogate history across multiple modes: point queries ("state at time T"), range queries ("events between T1 and T2"), causal queries ("what led to outcome X"), and pattern queries ("find all instances of this sequence"). The query engine resolves these by traversing Timelines, filtering Events, and reconstructing state as needed.

```typescript
interface TemporalQuery {
  /** Unique identifier for the query. */
  id: UUID;
  /** Identity that issued this query — used for access control on historical data. */
  issuedBy: UUID;
  /** Query mode determining which fields are relevant and how results are structured. */
  queryMode: "point" | "range" | "causal" | "pattern";
  /** Target timestamp for point queries — exact moment to reconstruct. */
  targetTimestamp?: Timestamp;
  /** Start of time range for range queries. */
  rangeStart?: Timestamp;
  /** End of time range for range queries. */
  rangeEnd?: Timestamp;
  /** Target event from which to trace causal ancestry for causal queries. */
  targetEventId?: UUID;
  /** Maximum depth of causal chain traversal; null for unlimited. */
  causalDepth?: number;
  /** Event type pattern for pattern queries — sequence of event types to match. */
  eventPattern?: string[];
  /** Entity IDs to restrict the query scope; empty means all entities. */
  entityFilter: UUID[];
  /** Event type filter; empty means all event types. */
  eventTypeFilter: string[];
  /** Actor filter; empty means all actors. */
  actorFilter: UUID[];
  /** Branch to query within; null queries the default branch only. */
  branchId?: UUID;
  /** Whether to include events from merged branches in the result. */
  includeMergedBranches: boolean;
  /** Maximum number of events to return. */
  limit: number;
  /** Result set containing matched events or reconstructed state. */
  results: TemporalQueryResult[];
  /** Confidence score for the result set (lower when reconstruction gaps exist). */
  confidence: number;
  /** When the query was executed. */
  executedAt: Timestamp;
  /** Execution duration in milliseconds. */
  executionTimeMs: number;
}

interface TemporalQueryResult {
  /** Event matched by the query. */
  eventId: UUID;
  /** Relevance score for ranking results within the response. */
  relevanceScore: number;
  /** Optional reconstructed state at this point in time. */
  reconstructedState?: Record<string, unknown>;
}
```

**Key design notes.** Point queries resolve by finding the nearest Snapshot before the target time and replaying Events forward — the `confidence` field reflects how far back that nearest Snapshot is. Causal queries walk the `triggeredBy` and `causalDependencies` chains backward from a target Event, producing a directed acyclic graph that answers "how did we get here?" — invaluable for debugging agent behavior. Pattern queries scan across Timelines using sequence-matching to find recurring event patterns, enabling agents to learn from historical precedents. The `includeMergedBranches` flag is essential: when a Branch has been merged back into its parent, events from that branch become part of the effective history and must be included for accurate reconstruction.

### 10.2 Snapshot & Branch Model

While Events capture change, Snapshots capture state. A Snapshot is an immutable, complete record of entity state at a specific moment — the foundation upon which time-travel rests. Branches extend this model by allowing multiple divergent futures from a single Snapshot. Tags provide human-meaningful names for significant Snapshots, turning opaque timestamps into landmarks.

#### 10.2.1 Snapshot

A Snapshot is an immutable complete state capture enabling full reconstruction of an entity at a specific point in time. Unlike the delta-sized snapshots embedded in individual Events, a Snapshot is comprehensive — it contains all state necessary to bootstrap execution without replaying preceding Events. Snapshots serve as anchor points for state reconstruction: the further back a Snapshot is from the target time, the more Events must be replayed. Storage cost is bounded by intelligent retention policies that keep only strategically placed checkpoints.

```typescript
interface Snapshot {
  /** Unique identifier for the snapshot. */
  id: UUID;
  /** Timeline this snapshot belongs to. */
  timelineId: UUID;
  /** Entity being snapshotted. */
  subjectId: UUID;
  /** Type of the subject entity — determines snapshot schema. */
  subjectType: string;
  /** Wall-clock timestamp when this snapshot was captured. */
  capturedAt: Timestamp;
  /** Lamport clock value at capture time — positions this snapshot in causal order. */
  lamportTs: number;
  /** ID of the event immediately preceding this snapshot; enables gapless replay. */
  precedingEventId?: UUID;
  /** Complete serialized state of the subject entity at capture time. */
  state: Record<string, unknown>;
  /** Cryptographic hash of the state blob — enables integrity verification. */
  stateHash: string;
  /** Whether this snapshot was taken automatically (by policy) or manually. */
  captureMode: "automatic" | "manual";
  /** Triggering policy or reason for automatic snapshots; user description for manual snapshots. */
  captureReason: string;
  /** Size of the snapshot state in bytes — for storage management. */
  sizeBytes: number;
  /** IDs of any branches that originate from this snapshot. */
  branchOriginIds: UUID[];
  /** Tags that reference this snapshot — enables semantic lookup. */
  tagIds: UUID[];
  /** Whether this snapshot is the base for the main branch timeline. */
  isMainline: boolean;
  /** When this snapshot was created. */
  createdAt: Timestamp;
}
```

**Key design notes.** The `stateHash` field provides cryptographic integrity verification essential for audit and compliance scenarios where tamper-evidence is required. Snapshots are write-once, read-many; the immutable guarantee ensures deterministic StateReconstruction results. The `precedingEventId` eliminates reconstruction gaps — when replaying Events forward from a Snapshot, the system knows exactly which Event comes next. The `isMainline` flag distinguishes snapshots on the default branch from those on divergent branches, affecting retention policy and reconstruction priority. Snapshots are strategically placed at configurable intervals, before risky operations, and at Branch origins — balancing storage cost against reconstruction performance.

#### 10.2.2 Branch

A Branch is a named divergent development line originating from a specific Snapshot, enabling parallel exploration of alternatives. Branches apply to any entity whose Timeline supports branching — artifacts under parallel editing, plans with alternative strategies, workspace configurations being experimented with. Each Branch maintains its own Timeline that forks from the origin Snapshot. Branches can be merged (incorporating changes into the parent), discarded (abandoning the line), or promoted (becoming the new mainline). This model extends the SessionFork concept from Chapter 8 into a general-purpose temporal primitive.

```typescript
interface Branch {
  /** Unique identifier for the branch. */
  id: UUID;
  /** Human-readable name (e.g., "auth-refactor-alt", "speculative-api-v2"). */
  name: string;
  /** Snapshot from which this branch diverges — the common ancestor. */
  originSnapshotId: UUID;
  /** Timeline that tracks events on this branch. */
  timelineId: UUID;
  /** Entity that this branch applies to. */
  subjectId: UUID;
  /** Current lifecycle state of the branch. */
  state: "active" | "merged" | "discarded" | "promoted" | "stale";
  /** ID of the branch this diverged from; null if branched from mainline. */
  parentBranchId?: UUID;
  /** If merged, the snapshot at which merge occurred; null otherwise. */
  mergeSnapshotId?: UUID;
  /** If merged, the merge strategy used to reconcile divergent states. */
  mergeStrategy?: "fast-forward" | "three-way" | "manual" | "auto-resolved";
  /** Ordered list of child branches that diverged from this branch. */
  childBranchIds: UUID[];
  /** Identity that created this branch. */
  createdBy: UUID;
  /** Description of the branch's purpose — critical for human orientation. */
  description: string;
  /** When this branch was created. */
  createdAt: Timestamp;
  /** When this branch was last modified (new event or state change). */
  lastActivityAt: Timestamp;
  /** Timestamp when this branch was merged, discarded, or promoted; null if still active. */
  closedAt?: Timestamp;
  /** Reason for closure — especially important for discarded branches. */
  closureReason?: string;
}
```

**Key design notes.** The Branch shape generalizes SessionFork (Chapter 8) and ArtifactVersion branching (Chapter 9) into a unified temporal primitive. While SessionFork captures runtime branching of agent execution contexts, Branch captures persistent historical branching — the two interoperate when a SessionFork's changes are persisted as a new Branch on an artifact's Timeline. The `state` lifecycle includes `stale` for branches that have not received events within a configured threshold, enabling cleanup policies that warn about abandoned branches before archival. The `mergeStrategy` field records how conflicts were resolved, providing an audit trail for future agents. The `description` field is required because branches proliferate rapidly in multi-agent workspaces; without mandatory descriptions, agents and humans lose track of why each branch exists.

#### 10.2.3 Tag

A Tag is a human-meaningful named pointer to a Snapshot, transforming an opaque timestamp into a semantic landmark. Tags serve as stable identifiers for significant moments: "release-1.0," "before-refactor," "stable-baseline." Unlike branches, tags do not support independent evolution — they are purely references. Tags can be applied to any Snapshot on any branch, making them the primary mechanism for marking milestones across the temporal graph. A PlanCheckpoint (Chapter 5) may reference a Tag, a deployment may be bound to a Tag, and a conversation may use a Tag as its contextual starting point.

```typescript
interface Tag {
  /** Unique identifier for the tag. */
  id: UUID;
  /** Human-meaningful name — the primary reference handle (e.g., "release-1.0"). */
  name: string;
  /** Snapshot this tag points to. */
  snapshotId: UUID;
  /** Entity being tagged — denormalized for query efficiency. */
  subjectId: UUID;
  /** Optional branch context — which branch the tagged snapshot belongs to. */
  branchId?: UUID;
  /** Classification of the tag's purpose. */
  tagType: "release" | "milestone" | "baseline" | "experiment" | "checkpoint" | "bookmark" | "custom";
  /** Detailed description of what this tag represents and why it matters. */
  description: string;
  /** Identity that created this tag. */
  createdBy: UUID;
  /** Color or visual indicator for UI rendering — enables at-a-glance categorization. */
  color?: string;
  /** Whether this tag is protected from deletion — important tags require elevated privileges to remove. */
  isProtected: boolean;
  /** Ordered list of related tags — enables semantic grouping (e.g., release series). */
  relatedTagIds: UUID[];
  /** When this tag was created. */
  createdAt: Timestamp;
  /** When this tag was last modified. */
  updatedAt: Timestamp;
}
```

**Key design notes.** The `name` field must be unique within the scope of its `subjectId` — duplicate names create ambiguity that undermines tags as stable references. The `relatedTagIds` field enables tag sequences ("release-1.0" → "release-1.1" → "release-1.2") that agents traverse to understand evolution patterns. The `isProtected` flag addresses an operational hazard: agents running automated cleanup might delete unrecognized tags. Protected tags require elevated privileges to remove, ensuring milestones survive routine maintenance. Tags are immutable in their snapshot reference — a tag always points to the same Snapshot. To "move" a tag, the old one is deleted and a new one created, preserving the historical record.

### 10.3 State Reconstruction & Replay

Snapshots and Events form the raw material of history; reconstruction and replay transform that material into usable past perspectives. StateReconstruction rebuilds a past state with quantified confidence. ReplayConfig enables counterfactual exploration — "what if" scenarios. HistoricalView is the user-facing lens that presents reconstructed past states in a navigable interface.

#### 10.3.1 StateReconstruction

StateReconstruction is the process of rebuilding an entity's past state from the nearest preceding Snapshot and the sequence of Events that followed. The reconstruction engine walks the Timeline from the Snapshot forward, applying each Event's before/after deltas incrementally. The process produces a confidence assessment quantifying reliability — confidence degrades when Events are missing, snapshots are distant, or concurrent modifications create ambiguous ordering.

```typescript
interface StateReconstruction {
  /** Unique identifier for this reconstruction operation. */
  id: UUID;
  /** Entity whose state is being reconstructed. */
  targetEntityId: UUID;
  /** Type of the target entity. */
  targetEntityType: string;
  /** Target timestamp, event, or tag to reconstruct to. */
  targetMode: "timestamp" | "event" | "tag";
  /** Target wall-clock timestamp for timestamp mode. */
  targetTimestamp?: Timestamp;
  /** Target event ID for event mode. */
  targetEventId?: UUID;
  /** Target tag name for tag mode. */
  targetTagName?: string;
  /** Snapshot used as the reconstruction base. */
  baseSnapshotId: UUID;
  /** Number of events replayed to reach the target state. */
  eventsReplayed: number;
  /** Ordered list of event IDs that were replayed. */
  replayedEventIds: UUID[];
  /** The reconstructed state at the target point in time. */
  reconstructedState: Record<string, unknown>;
  /** Hash of the reconstructed state for integrity comparison. */
  stateHash: string;
  /** Confidence score from 0.0 to 1.0 — higher is more reliable. */
  confidence: number;
  /** Reasons for confidence degradation. */
  confidenceNotes: string[];
  /** Events that could not be applied due to missing dependencies or schema incompatibility. */
  unappliedEvents: UUID[];
  /** Branch used for reconstruction. */
  branchId?: UUID;
  /** Identity that requested this reconstruction. */
  requestedBy: UUID;
  /** When the reconstruction was started. */
  startedAt: Timestamp;
  /** When the reconstruction completed. */
  completedAt: Timestamp;
  /** Duration of reconstruction in milliseconds. */
  durationMs: number;
}
```

**Key design notes.** The `confidence` field transforms reconstruction from a binary success/failure operation into a graded assessment that downstream consumers can threshold — a HistoricalView might warn users below 0.8 confidence, while an automated agent might refuse to act below 0.95. Confidence degrades for three reasons: distant snapshots (many Events increase error opportunity), missing Events (gaps from dropped or pruned records), and concurrent modifications (vector-clock ambiguity forcing arbitrary ordering choices). The `targetMode` supports three entry points: timestamp mode for human queries ("Tuesday at 3pm"), event mode for precise causal reconstruction, and tag mode for semantic reconstruction ("the release-1.0 state"). The `unappliedEvents` array records Events the engine could not apply — critical debugging information when reconstruction produces unexpected state.

#### 10.3.2 ReplayConfig

ReplayConfig defines parameters for counterfactual replay — taking a sequence of historical Events, modifying some, and replaying to observe different outcomes. This enables "what if" analysis: what if the agent had chosen a different approach, what if the human had approved instead of rejecting. Counterfactual replay is a powerful learning and debugging tool, enabling agents to explore alternatives without modifying actual workspace state. The ReplayConfig specifies which events to replay, what modifications to apply, execution speed, and breakpoint conditions.

```typescript
interface ReplayConfig {
  /** Unique identifier for this replay configuration. */
  id: UUID;
  /** Human-readable description of the counterfactual scenario. */
  description: string;
  /** Source timeline from which events are drawn. */
  sourceTimelineId: UUID;
  /** Source branch; null for mainline. */
  sourceBranchId?: UUID;
  /** Starting snapshot — the state from which replay begins. */
  startSnapshotId: UUID;
  /** Ending event or condition — where replay stops. */
  endCondition: ReplayEndCondition;
  /** Event sequence to replay — may be a subset of the full timeline. */
  eventSequence: UUID[];
  /** Modifications applied to specific events during replay. */
  eventModifications: EventModification[];
  /** Speed setting for replay execution. */
  speed: "realtime" | "accelerated" | "instant";
  /** Acceleration factor for accelerated mode. */
  accelerationFactor?: number;
  /** Breakpoints where replay pauses for inspection or decision. */
  breakpoints: ReplayBreakpoint[];
  /** Whether replay mutations affect actual workspace state or virtual state only. */
  mode: "virtual" | "speculative" | "destructive";
  /** Results collected during replay — populated as replay progresses. */
  results: ReplayResult[];
  /** Identity that configured this replay. */
  configuredBy: UUID;
  /** When this replay configuration was created. */
  createdAt: Timestamp;
  /** When replay started execution; null if not yet started. */
  startedAt?: Timestamp;
  /** When replay completed; null if not yet completed. */
  completedAt?: Timestamp;
}

interface ReplayEndCondition {
  /** Type of end condition. */
  type: "event" | "timestamp" | "state-match" | "breakpoint" | "manual";
  /** Target event ID for event-type end condition. */
  targetEventId?: UUID;
  /** Target timestamp for timestamp-type end condition. */
  targetTimestamp?: Timestamp;
  /** State predicate for state-match end condition. */
  statePredicate?: Record<string, unknown>;
}

interface EventModification {
  /** Event being modified. */
  eventId: UUID;
  /** Type of modification. */
  modificationType: "replace-payload" | "change-actor" | "swap-outcome" | "insert-delay" | "remove";
  /** Replacement payload for replace-payload modifications. */
  newPayload?: Record<string, unknown>;
  /** Replacement actor for change-actor modifications. */
  newActorId?: UUID;
  /** Delay duration in milliseconds for insert-delay modifications. */
  delayMs?: number;
}

interface ReplayBreakpoint {
  /** Event at which to pause. */
  eventId: UUID;
  /** Condition that must be met to pause; null for unconditional pause. */
  condition?: Record<string, unknown>;
  /** Whether to require human approval to continue past this breakpoint. */
  requiresApproval: boolean;
}

interface ReplayResult {
  /** Event that produced this result. */
  eventId: UUID;
  /** State after this event was applied. */
  resultingState: Record<string, unknown>;
  /** Any side effects or observations from this step. */
  observations: string[];
  /** Timestamp when this step was executed during replay. */
  appliedAt: Timestamp;
}
```

**Key design notes.** The `mode` field is the most consequential decision: `virtual` runs in an isolated sandbox with no side effects — safe for exploration; `speculative` writes to a temporary Branch that can be inspected, merged, or discarded; `destructive` modifies actual workspace state and is restricted to highly privileged identities. The `eventModifications` array supports five modification types covering the most common counterfactual scenarios: replacing what an agent did, simulating a different actor, inverting an outcome, introducing timing variations, and removing an event to test robustness. Breakpoints transform replay from a batch process into an interactive debugging session. The ReplayConfig shape extends SpeculativeExecution (Chapter 8) by providing a concrete configuration mechanism for "what-if" exploration across the entire workspace history.

#### 10.3.3 HistoricalView

HistoricalView is the read-only, user-facing interface presenting a reconstructed past state as a navigable experience. When a user asks "show me the workspace as it was on Tuesday at 3pm," the system performs a StateReconstruction and wraps the result in a HistoricalView — a self-contained perspective with temporal navigation controls, search capabilities, and contextual annotations. HistoricalViews are strictly read-only; modification attempts are rejected with guidance on branching from that point if the user wishes to create a divergent timeline.

```typescript
interface HistoricalView {
  /** Unique identifier for this historical view instance. */
  id: UUID;
  /** Display title for this view (e.g., "Workspace — Tuesday 3:00 PM"). */
  title: string;
  /** The point in time this view represents. */
  targetTimestamp: Timestamp;
  /** Entity being viewed at historical state. */
  targetEntityId: UUID;
  /** Type of the target entity. */
  targetEntityType: string;
  /** Reconstruction that produced this view's underlying state. */
  reconstructionId: UUID;
  /** Reconstructed state presented through this view. */
  state: Record<string, unknown>;
  /** Confidence of the reconstruction — displayed prominently in the UI. */
  confidence: number;
  /** Timeline navigation controls. */
  navigation: ViewNavigationControls;
  /** Available tags at or before the target timestamp for quick jumping. */
  availableTags: Tag[];
  /** Search results within the historical context. */
  searchContext: HistoricalSearchContext;
  /** Related branches that existed at this point in time. */
  activeBranchesAtTime: UUID[];
  /** Events that occurred within a window of the target time. */
  surroundingEvents: UUID[];
  /** Whether the view includes speculative/counterfactual state. */
  isSpeculative: boolean;
  /** If speculative, the ReplayConfig that produced this view. */
  sourceReplayConfigId?: UUID;
  /** Identity that requested this view. */
  viewedBy: UUID;
  /** When this view was created. */
  createdAt: Timestamp;
  /** Expiration time — historical views are cached but not permanent. */
  expiresAt: Timestamp;
}

interface ViewNavigationControls {
  /** ID of the previous event before the target timestamp on this timeline. */
  previousEventId?: UUID;
  /** ID of the next event after the target timestamp on this timeline. */
  nextEventId?: UUID;
  /** ID of the nearest preceding tag. */
  previousTagId?: UUID;
  /** ID of the nearest following tag. */
  nextTagId?: UUID;
  /** Whether the user can step forward in time from this view. */
  canStepForward: boolean;
  /** Whether the user can step backward in time from this view. */
  canStepBackward: boolean;
  /** Earliest timestamp available on this timeline. */
  timelineStart: Timestamp;
  /** Latest timestamp available on this timeline. */
  timelineEnd: Timestamp;
}

interface HistoricalSearchContext {
  /** Query string if a search was performed within this historical view. */
  query?: string;
  /** Results matching the query within the historical state. */
  results: HistoricalSearchResult[];
  /** Whether search spans the full history or just the visible state. */
  searchScope: "state-only" | "timeline" | "all-branches";
}

interface HistoricalSearchResult {
  /** Entity matching the search. */
  entityId: UUID;
  /** Type of the matching entity. */
  entityType: string;
  /** Relevance score. */
  relevance: number;
  /** Snippet or summary of why this matched. */
  matchSnippet: string;
  /** State of this entity at the historical view's target time. */
  entityState: Record<string, unknown>;
}
```

**Key design notes.** The HistoricalView shape is the culmination of the temporal system — it makes all the underlying machinery (Timelines, Events, Snapshots, Branches, StateReconstruction) accessible to users and agents. The `navigation` field transforms a static reconstruction into an interactive time-travel experience: stepping event by event, jumping between tags, or scrubbing the timeline. The `isSpeculative` flag prominently marks views derived from counterfactual replay, preventing users from mistaking hypothetical states for actual history. The `expiresAt` field implements cache eviction: HistoricalViews are expensive to construct, so they are cached for a configurable period and regenerated on next access. The `activeBranchesAtTime` field shows which alternative branches coexisted at the viewed moment, enabling exploration of roads not taken. Search within HistoricalViews defaults to reconstructed state but can expand to the full timeline or across all branches, enabling queries such as "find every time this file contained 'deprecated' across all branches."


## 11. Inter-Agent Communication & Handoff

While human-facing conversations are modeled by `ConversationThread`, agents must also coordinate directly with one another in channels invisible to the user. This chapter defines the "nervous system" of the multi-agent workspace — the data shapes that enable agents to exchange structured messages, transfer responsibility, and maintain shared state without human mediation. These primitives are what make parallel agent execution possible: they allow an agent to hand off a partially completed task, broadcast availability to collaborators, or acquire exclusive access to a resource that another agent is concurrently modifying. Every shape in this section is designed for machine consumption first, with serialization formats optimized for parsing speed rather than human readability.

### 11.1 Direct Messaging & Signals

The messaging layer provides three distinct delivery semantics — durable direct message, briefly stored broadcast, and ephemeral signal — so that agents can choose the appropriate reliability guarantee for each coordination need. This tiered approach balances storage cost against delivery assurance: not every state change warrants a database row.

#### 11.1.1 AgentMessage

An `AgentMessage` represents a direct, structured communication from one agent to another, distinct from the natural-language exchanges captured in `ConversationThread`. These messages are typically machine-structured payloads — JSON objects conveying status updates, information requests, completion notices, or coordination directives. Where `ConversationThread` entries are optimized for human readability, `AgentMessage` entries prioritize parsing efficiency and schema validation. The shape includes a `messageType` discriminator that enables routing logic to dispatch messages to appropriate handlers without inspecting the payload contents. Every message carries both a `senderAgentId` and a `recipientAgentId`, forming a directed edge in the agent coordination graph. The `inReplyTo` field enables request-response correlation, while `priority` allows urgent coordination messages to jump ahead of routine status reports in the recipient's inbox. Messages are stored durably until explicitly acknowledged, ensuring that transient agent restarts do not lose critical coordination state.

```typescript
interface AgentMessage {
  /** Unique identifier for this message. */
  id: UUID;
  /** Discriminator for routing: 'status_update', 'info_request', 'completion_notice', 'coordination_directive', etc. */
  messageType: string;
  /** The agent that sent this message. References Agent.id. */
  senderAgentId: UUID;
  /** The intended recipient agent. References Agent.id. */
  recipientAgentId: UUID;
  /** Machine-structured payload; schema varies by messageType. */
  payload: Record<string, unknown>;
  /** Priority level: 0 = critical, 1 = high, 2 = normal, 3 = low. */
  priority: number;
  /** If this is a reply, references the original AgentMessage.id. */
  inReplyTo?: UUID;
  /** The conversation thread this message relates to, if any. References ConversationThread.id. */
  threadId?: UUID;
  /** The execution session within which this message was sent. References ExecutionSession.id. */
  sessionId?: UUID;
  /** Whether the recipient has acknowledged receipt. */
  acknowledged: boolean;
  /** Timestamp when the message was sent. */
  sentAt: Timestamp;
  /** Timestamp when the message was acknowledged, if applicable. */
  acknowledgedAt?: Timestamp;
  /** TTL in seconds; null means persist until acknowledged. */
  expiresAt?: Timestamp;
  /** Metadata for audit and debugging. */
  metadata: Record<string, unknown>;
}
```

**Key design notes.** The `payload` field uses a loose `Record<string, unknown>` type because the schema of agent-to-agent messages is inherently extensible — new message types are defined by collaboration patterns and agent capabilities. However, production systems should enforce schema validation at the application layer via the `messageType` discriminator. The `priority` field uses numeric levels rather than an enum to allow agents to define custom granularity. The `expiresAt` TTL enables automatic cleanup of stale coordination messages, preventing inbox bloat in long-running sessions.

#### 11.1.2 Broadcast

A `Broadcast` is a one-to-many announcement sent by an agent to all members of an `ActorGroup` or `Workstream`, stored briefly so that late-joining agents can query recent announcements without requiring the originator to repeat the message. Broadcasts fill a critical gap between direct messages and ephemeral signals: they need broader reach than a single recipient, but they also need some durability so that agents that come online after the broadcast can still discover the information. Typical broadcasts include dependency announcements ("the API schema is now available"), capability discovery queries ("which agent has expertise in React performance optimization?"), and environment alerts ("the build pipeline is broken"). The `scope` field controls visibility — a broadcast may target all agents in a workstream, a specific actor group, or the global agent pool. The `retentionUntil` field enforces brief storage: once expired, the broadcast is eligible for archival or deletion. Agents query broadcasts by scope and time range, allowing a newly initialized agent to catch up on relevant context from the past few minutes of activity.

```typescript
interface Broadcast {
  /** Unique identifier for this broadcast. */
  id: UUID;
  /** The agent that originated the broadcast. References Agent.id. */
  senderAgentId: UUID;
  /** Discriminator: 'dependency_available', 'capability_query', 'environment_alert', 'discovery_announcement', etc. */
  broadcastType: string;
  /** Machine-structured payload with broadcast-specific data. */
  payload: Record<string, unknown>;
  /** Visibility scope: 'workstream', 'actor_group', or 'global'. */
  scope: string;
  /** The specific workstream or group this targets, if scope is not 'global'. References Workstream.id or ActorGroup.id. */
  scopeTargetId?: UUID;
  /** The execution session within which this broadcast was made. References ExecutionSession.id. */
  sessionId?: UUID;
  /** Timestamp when the broadcast was sent. */
  sentAt: Timestamp;
  /** Retention deadline; broadcast becomes eligible for deletion after this time. */
  retentionUntil: Timestamp;
  /** List of agent IDs that have read this broadcast. References Agent.id. */
  readBy: UUID[];
  /** Whether this broadcast has been superseded by a newer broadcast of the same type. */
  superseded: boolean;
  /** ID of the broadcast that supersedes this one, if applicable. References Broadcast.id. */
  supersededBy?: UUID;
  /** Metadata for indexing and filtering. */
  metadata: Record<string, unknown>;
}
```

**Key design notes.** The `superseded` and `supersededBy` fields address a common broadcast pattern where an earlier alert is invalidated by new information — for example, a "build broken" broadcast followed by a "build fixed" broadcast. Superseded broadcasts remain stored until `retentionUntil` to preserve a complete timeline, but query APIs can filter them out by default. The `readBy` array provides lightweight read receipts without the per-recipient overhead of creating individual `AgentMessage` records. Retention periods should typically be short (minutes, not hours) to keep the broadcast index lightweight.

#### 11.1.3 Signal

A `Signal` is an ephemeral, fire-and-forget notification that requires no response and carries no durability guarantee. If the intended recipient is not listening when the signal is sent, the signal is simply lost — this is by design. Signals are used for lightweight state change announcements ("I have started processing Task X"), invitations to ephemeral collaboration opportunities ("join this computation race if you have spare capacity"), and heartbeat pulses that indicate an agent is still active. The `Signal` shape exists primarily as an interface contract: the underlying transport may be an in-memory event bus, a WebSocket push, or a message queue with no persistence layer. Because signals are not stored, they have no `id` field and no acknowledgment mechanism. The `correlationTag` allows agents to filter signals by topic without inspecting the payload, enabling efficient subscription patterns where agents listen only for signals relevant to their current work.

```typescript
interface Signal {
  /** Discriminator: 'state_change', 'invitation', 'heartbeat', 'capability_advertisement', etc. */
  signalType: string;
  /** The agent that emitted the signal. References Agent.id. */
  senderAgentId: UUID;
  /** Optional specific recipient; if omitted, the signal is multicast. References Agent.id. */
  recipientAgentId?: UUID;
  /** Machine-structured payload; schema varies by signalType. */
  payload: Record<string, unknown>;
  /** Topic tag for subscription filtering; agents listen to specific tags. */
  correlationTag: string;
  /** The execution session within which this signal was emitted. References ExecutionSession.id. */
  sessionId?: UUID;
  /** Timestamp when the signal was emitted. */
  emittedAt: Timestamp;
  /** Maximum propagation time in milliseconds; signal should be discarded if delivery exceeds this. */
  propagationTimeoutMs: number;
}
```

**Key design notes.** Signals intentionally lack an `id` and durability to enforce the ephemeral contract at the data model level. If a use case requires persistence, it should use `AgentMessage` or `Broadcast` instead. The `propagationTimeoutMs` field allows the emitter to express freshness requirements — a heartbeat signal might tolerate longer delivery than a time-sensitive invitation to a race condition resolution. The `correlationTag` replaces a traditional topic string with a flat tag space to minimize subscription management overhead in high-frequency signaling scenarios.

### 11.2 Handoff Protocols & Context Transfer

When an agent cannot complete a task and must delegate responsibility to another agent, the workspace supports a structured handoff protocol. This ensures that the receiving agent has sufficient context to continue work without starting from scratch, and that the original agent has confirmation of what was successfully transferred.

#### 11.2.1 Handoff

A `Handoff` represents the formal transfer of responsibility from a source agent to a target agent. It encapsulates everything the target needs to continue the work: a `ContextTransfer` payload containing active context and memory state, a `briefingSummary` written by the source agent explaining what has been accomplished and what remains, and a list of `transferredItems` enumerating the specific artifacts, decisions, and state objects being passed. The handoff protocol is two-phase: first, the source creates the `Handoff` record with status `"pending"`; second, the target reviews the transfer and creates a `HandoffReceipt` to accept, accept-with-qualifications, or reject the handoff. The `reason` field captures why the handoff is occurring — whether the source agent lacks the required capability, has exceeded its iteration budget, or is explicitly delegating a sub-task as part of a collaboration pattern. The `timeoutAt` field prevents handoffs from lingering indefinitely: if the target does not respond before the timeout, the handoff is automatically marked `"expired"` and the source may attempt reassignment.

```typescript
interface Handoff {
  /** Unique identifier for this handoff. */
  id: UUID;
  /** The execution session within which this handoff occurs. References ExecutionSession.id. */
  sessionId: UUID;
  /** The agent transferring responsibility. References Agent.id. */
  sourceAgentId: UUID;
  /** The agent receiving responsibility. References Agent.id. */
  targetAgentId: UUID;
  /** Reason for handoff: 'capability_mismatch', 'budget_exhausted', 'explicit_delegation', 'error_recovery', etc. */
  reason: string;
  /** Human-readable summary of work completed and remaining. */
  briefingSummary: string;
  /** The context payload being transferred. */
  contextTransfer: ContextTransfer;
  /** Enumeration of specific items being handed off: decisions, artifacts, locks, etc. */
  transferredItems: TransferredItem[];
  /** Current status: 'pending', 'accepted', 'accepted_with_qualifications', 'rejected', 'expired'. */
  status: string;
  /** The receipt submitted by the target agent, once available. References HandoffReceipt.id. */
  receiptId?: UUID;
  /** The collaboration pattern governing this handoff, if any. References CollaborationPattern.id. */
  collaborationPatternId?: UUID;
  /** Deadline for target response. */
  timeoutAt: Timestamp;
  /** Timestamp when the handoff was initiated. */
  initiatedAt: Timestamp;
  /** Timestamp when the handoff was resolved. */
  resolvedAt?: Timestamp;
  /** Metadata for routing and audit. */
  metadata: Record<string, unknown>;
}

interface TransferredItem {
  /** Type of item: 'artifact', 'decision', 'lock_token', 'working_memory_entry', 'context_scope'. */
  itemType: string;
  /** ID of the item being transferred. */
  itemId: UUID;
  /** Human-readable description of the item. */
  description: string;
  /** Whether the transfer of this item succeeded. */
  transferStatus: 'pending' | 'success' | 'failed';
  /** Error message if transfer failed. */
  errorMessage?: string;
}
```

**Key design notes.** The `Handoff` shape is intentionally heavyweight because handoffs are infrequent but high-stakes events. The `transferredItems` array provides granular per-item transfer tracking, enabling partial handoffs where some items fail to transfer but the target can still proceed with the remainder. The two-phase protocol (pending → receipt → resolved) ensures that both source and target have a shared record of what was agreed upon, preventing disputes about scope when work is later reviewed. The `timeoutAt` field is critical in parallel execution scenarios where a stalled handoff would block downstream agents.

#### 11.2.2 HandoffReceipt

A `HandoffReceipt` is the target agent's formal response to a `Handoff`, confirming what was received, articulating any qualifications or concerns, and documenting items that failed to transfer. The `acceptanceStatus` field captures the target's disposition: `"accepted"` means the target is confident it can continue the work, `"accepted_with_qualifications"` means it will proceed but has noted gaps or limitations (for example, "I can implement this but I am not expert in the database layer"), and `"rejected"` means the target declines the handoff — typically triggering a reassignment by the source or an orchestrator. The `receivedItems` and `failedItems` arrays provide item-level confirmation that mirrors the `transferredItems` in the originating `Handoff`, enabling the workspace to detect discrepancies between what was sent and what was received. The `qualifications` field is a free-text field where the target agent can articulate constraints or caveats that the collaboration framework should account for when evaluating the handoff outcome.

```typescript
interface HandoffReceipt {
  /** Unique identifier for this receipt. */
  id: UUID;
  /** The handoff this receipt responds to. References Handoff.id. */
  handoffId: UUID;
  /** The agent submitting the receipt (the target of the handoff). References Agent.id. */
  submittingAgentId: UUID;
  /** Acceptance status: 'accepted', 'accepted_with_qualifications', 'rejected'. */
  acceptanceStatus: string;
  /** Free-text qualifications, constraints, or concerns about taking over the work. */
  qualifications?: string;
  /** Items the target confirms it has received. */
  receivedItems: ReceivedItem[];
  /** Items that failed to transfer or were missing. */
  failedItems: FailedItem[];
  /** The target's assessment of the remaining work and estimated effort. */
  workAssessment: string;
  /** Proposed next steps from the target's perspective. */
  proposedNextSteps: string[];
  /** Timestamp when the receipt was submitted. */
  submittedAt: Timestamp;
  /** Metadata for audit trail. */
  metadata: Record<string, unknown>;
}

interface ReceivedItem {
  /** Type of item received. */
  itemType: string;
  /** ID of the received item. */
  itemId: UUID;
  /** Whether the item was validated successfully by the target. */
  validated: boolean;
  /** Notes on the received item's condition or completeness. */
  notes?: string;
}

interface FailedItem {
  /** Type of item that failed. */
  itemType: string;
  /** ID of the failed item. */
  itemId: UUID;
  /** Reason for the failure: 'not_found', 'access_denied', 'corrupted', 'incompatible_format', etc. */
  failureReason: string;
  /** Whether the failure is blocking (target cannot proceed without this item). */
  blocking: boolean;
}
```

**Key design notes.** The `qualifications` field serves a critical function in multi-agent quality assessment: when a handoff is accepted with qualifications, the orchestration layer can decide whether to augment the target agent with additional resources or to schedule a secondary review. The `workAssessment` field enables effort estimation across handoff chains — if Agent A hands off to Agent B, which then hands off to Agent C, the cumulative assessments provide a projected completion timeline. The mirror structure between `Handoff.transferredItems` and `HandoffReceipt.receivedItems` enables automated discrepancy detection, flagging potential data loss during context serialization.

#### 11.2.3 ContextTransfer

A `ContextTransfer` is the payload carried within a `Handoff`, comprising the specific subset of an agent's working state that is relevant for the target agent to continue the delegated task. It is not a wholesale memory dump — the source agent curates the transfer contents to include only what the target needs. The `activeScope` field contains the current `ContextScope` (as defined in the context management subsystem), establishing the namespace and grounding of the conversation. The `relevantMemorySummaries` field holds condensed versions of long-term memories that pertain to the task, rather than the full memory records — this keeps transfer sizes manageable while preserving semantic relevance. The `workingMemorySnapshot` captures the current state of the source agent's scratchpad: partially formed plans, intermediate computations, and notes. The `openDecisions` array enumerates choices that the source agent has identified but not resolved, giving the target agent a clear view of pending judgment points. Finally, `artifactPointers` references in-progress artifacts (by ID) that the target should continue working on.

```typescript
interface ContextTransfer {
  /** Unique identifier for this context transfer. */
  id: UUID;
  /** The handoff this payload belongs to. References Handoff.id. */
  handoffId: UUID;
  /** The active context scope at the time of handoff. */
  activeScope: ContextScopeSnapshot;
  /** Summaries of long-term memories relevant to the delegated task. */
  relevantMemorySummaries: MemorySummary[];
  /** Snapshot of the source agent's working memory state. */
  workingMemorySnapshot: Record<string, unknown>;
  /** Decisions that remain unresolved and require target attention. */
  openDecisions: OpenDecision[];
  /** Pointers to artifacts the target should continue working on. */
  artifactPointers: ArtifactPointer[];
  /** Explicit exclusions: items the source deliberately omitted from the transfer. */
  excludedItems: ExcludedItem[];
  /** Estimated semantic relevance score of this transfer (0.0 to 1.0). */
  relevanceScore: number;
  /** Timestamp when the context transfer was assembled. */
  assembledAt: Timestamp;
  /** Total serialized size in bytes for transfer budget monitoring. */
  serializedSizeBytes: number;
}

interface ContextScopeSnapshot {
  /** The context scope ID. References ContextScope.id. */
  scopeId: UUID;
  /** The scope type: 'project', 'task', 'conversation', 'global'. */
  scopeType: string;
  /** Key grounding variables active in this scope. */
  groundingVariables: Record<string, unknown>;
}

interface MemorySummary {
  /** The memory ID this summary represents. References Memory.id. */
  memoryId: UUID;
  /** Condensed representation of the memory content. */
  summary: string;
  /** Relevance score for this memory to the delegated task (0.0 to 1.0). */
  relevanceScore: number;
  /** Type of memory: 'fact', 'decision', 'observation', 'plan'. */
  memoryType: string;
}

interface OpenDecision {
  /** Unique identifier for this decision within the transfer. */
  decisionId: UUID;
  /** Description of the decision to be made. */
  description: string;
  /** Options under consideration. */
  options: string[];
  /** The option the source agent was leaning toward, if any. */
  preferredOption?: string;
  /** Constraints or requirements the target should consider. */
  constraints: string[];
  /** Whether this decision is blocking further progress. */
  blocking: boolean;
}

interface ArtifactPointer {
  /** The artifact ID. References Artifact.id. */
  artifactId: UUID;
  /** The type of artifact: 'file', 'document', 'code', 'configuration', 'test'. */
  artifactType: string;
  /** Current status of the artifact: 'in_progress', 'draft', 'review_needed', 'partial'. */
  status: string;
  /** Specific section or component the target should focus on. */
  focusArea?: string;
}

interface ExcludedItem {
  /** Type of excluded item: 'memory', 'artifact', 'credential', 'irrelevant_context'. */
  itemType: string;
  /** Reason for exclusion: 'irrelevant', 'sensitive', 'too_large', 'redundant', 'permission_denied'. */
  exclusionReason: string;
  /** Brief description of what was excluded. */
  description: string;
}
```

**Key design notes.** The curation of `ContextTransfer` contents is the most complex aspect of the handoff protocol. The source agent must balance completeness against transfer size — overly large transfers slow down handoff and may include distracting irrelevant context, while overly minimal transfers leave the target agent under-informed. The `excludedItems` array provides transparency about what was deliberately omitted and why, so the target can request specific items if needed. The `relevanceScore` field enables the orchestration layer to rank multiple candidate handoffs by estimated quality. The `serializedSizeBytes` field supports transfer budget enforcement, preventing agents from attempting to hand off unbounded state.

### 11.3 Collaboration Patterns & Shared State

When multiple agents work concurrently, they need agreed-upon protocols for coordination and mechanisms for safe access to shared resources. This section defines the patterns that govern multi-agent cooperation and the primitives that prevent conflicting state modifications.

#### 11.3.1 CollaborationPattern

A `CollaborationPattern` defines a reusable cooperative protocol that governs how multiple agents work together on a shared objective. The pattern specifies the communication topology (who talks to whom, and how frequently), the shared state scope (which data structures are jointly accessible), and the conflict resolution strategy (how disagreements or race conditions are handled). Four canonical patterns are supported: `"divide_and_conquer"` splits a task into independent sub-tasks assigned to different agents; `"specialization"` assigns each agent a distinct aspect of the problem (for example, one agent handles API design while another handles frontend implementation); `"consensus"` requires all participating agents to agree before any action is taken; and `"relay"` passes work sequentially from one agent to the next in a pipeline. The `communicationFrequency` field encodes how often agents must synchronize — continuous (every change), periodic (at defined intervals), or milestone-based (only at phase transitions). The `sharedStateScope` field defines which `SharedState` instances agents in this pattern can access. Patterns are instantiated per-`Workstream` and can be composed: a divide-and-conquer pattern at the top level may contain specialization sub-patterns within each sub-task.

```typescript
interface CollaborationPattern {
  /** Unique identifier for this pattern instance. */
  id: UUID;
  /** The workstream this pattern governs. References Workstream.id. */
  workstreamId: UUID;
  /** The pattern type: 'divide_and_conquer', 'specialization', 'consensus', 'relay', 'custom'. */
  patternType: string;
  /** Human-readable description of how this pattern is applied to the current workstream. */
  description: string;
  /** Agents participating in this collaboration. References Agent.id. */
  participantAgentIds: UUID[];
  /** Communication synchronization frequency: 'continuous', 'periodic', 'milestone_based'. */
  communicationFrequency: string;
  /** Period in seconds if frequency is 'periodic'; null otherwise. */
  syncPeriodSeconds?: number;
  /** IDs of SharedState instances accessible to participants. References SharedState.id. */
  sharedStateScope: UUID[];
  /** Conflict resolution strategy: 'last_write_wins', 'voting', 'hierarchy', 'merge_manual', 'optimistic_locking'. */
  conflictResolution: string;
  /** The execution session within which this pattern is active. References ExecutionSession.id. */
  sessionId: UUID;
  /** Parent pattern ID if this is a nested sub-pattern. References CollaborationPattern.id. */
  parentPatternId?: UUID;
  /** Child pattern IDs for nested decomposition. References CollaborationPattern.id. */
  childPatternIds: UUID[];
  /** Current status: 'forming', 'active', 'paused', 'dissolved'. */
  status: string;
  /** Timestamp when the pattern was instantiated. */
  createdAt: Timestamp;
  /** Timestamp when the pattern was last modified. */
  updatedAt: Timestamp;
  /** Metadata for pattern configuration. */
  metadata: Record<string, unknown>;
}
```

**Key design notes.** The nested pattern structure (parent-child relationships) enables complex hierarchical collaboration where a top-level strategy decomposes into more specific local protocols. The `conflictResolution` field is particularly important: `"voting"` requires a minimum participant count to be effective, while `"hierarchy"` assumes a designated lead agent whose decisions override others. The `"optimistic_locking"` strategy delegates conflict handling to the `LockToken` and `SharedState` mechanisms defined below. Pattern status transitions follow a lifecycle: `"forming"` while participants are being assigned, `"active"` during normal operation, `"paused"` when synchronization is temporarily suspended (for example, during a handoff), and `"dissolved"` when the collaboration objective is complete.

#### 11.3.2 LockToken

A `LockToken` grants an agent exclusive access to a shared resource, preventing conflicting modifications when multiple agents operate concurrently. The token model is fundamental to safe parallel execution: before modifying a shared artifact, state variable, or configuration, an agent must acquire the corresponding `LockToken`; after completing the modification, it releases the token. Each token has an `ownerAgentId` identifying the holding agent, a `scope` describing the resource being locked (which may be a specific artifact, a state variable, or a pattern-wide lock), and an `expiresAt` timestamp after which the lock is automatically released — this prevents deadlocks when an agent crashes or stalls while holding a lock. The `waitQueue` field tracks agents that have requested the lock but are blocked, enabling FIFO or priority-based lock acquisition ordering. The `deadlockDetection` flag enables a background process to analyze wait-for graphs across all outstanding tokens and break detected deadlocks by force-releasing the oldest lock in the cycle.

```typescript
interface LockToken {
  /** Unique identifier for this lock token. */
  id: UUID;
  /** The agent that currently holds this lock. References Agent.id. */
  ownerAgentId: UUID;
  /** The collaboration pattern this lock belongs to, if any. References CollaborationPattern.id. */
  patternId?: UUID;
  /** The execution session within which this lock is active. References ExecutionSession.id. */
  sessionId: UUID;
  /** The resource being locked: artifact ID, state variable name, or pattern-scoped identifier. */
  scope: string;
  /** Scope type: 'artifact', 'state_variable', 'pattern_wide', 'configuration'. */
  scopeType: string;
  /** The specific resource ID if scopeType is 'artifact'. References Artifact.id. */
  resourceId?: UUID;
  /** Lock acquisition timestamp. */
  acquiredAt: Timestamp;
  /** Automatic expiration timestamp; lock is released if owner does not renew. */
  expiresAt: Timestamp;
  /** Whether the owner has requested an extension. */
  extensionRequested: boolean;
  /** Extension deadline; owner must release or renew by this time. */
  extendDeadline?: Timestamp;
  /** Ordered queue of agents waiting for this lock. References Agent.id. */
  waitQueue: WaitQueueEntry[];
  /** Whether deadlock detection is active for this lock. */
  deadlockDetection: boolean;
  /** Current status: 'held', 'expired', 'released', 'contested'. */
  status: string;
  /** The handoff that transferred this lock, if applicable. References Handoff.id. */
  transferredViaHandoffId?: UUID;
  /** Metadata for lock management. */
  metadata: Record<string, unknown>;
}

interface WaitQueueEntry {
  /** The agent waiting for the lock. References Agent.id. */
  agentId: UUID;
  /** Timestamp when the agent entered the queue. */
  queuedAt: Timestamp;
  /** Priority of this waiting agent (lower number = higher priority). */
  priority: number;
  /** Whether this agent has enabled deadlock detection for its wait. */
  deadlockDetectionEnabled: boolean;
}
```

**Key design notes.** The `transferredViaHandoffId` field supports a critical handoff scenario where an agent passes both a task and the lock on a shared resource to another agent — without this, the target would need to reacquire the lock, creating a window where another agent could seize it. The `extendDeadline` and `extensionRequested` fields implement a lease-renewal pattern: the owner must periodically demonstrate liveness by requesting an extension, or the lock expires. This prevents "zombie locks" when an agent becomes unresponsive. The `waitQueue` priority field allows urgent operations to jump ahead of routine work, though the default should be FIFO to prevent starvation. The `deadlockDetection` flag should default to true for all locks within the same `CollaborationPattern` to ensure cycle detection across the pattern's resource graph.

#### 11.3.3 SharedState

`SharedState` is a concurrently accessible data structure that multiple agents can read and write during a collaboration. Unlike agent-private working memory, shared state is explicitly designed for concurrent access and includes mechanisms for consistency enforcement and change notification. The `consistencyModel` field determines the concurrency semantics: `"strong"` guarantees that all agents see the same value at all times (typically implemented via the `LockToken` system); `"eventual"` allows temporary divergence with guaranteed convergence (useful for caching and derived computations); and `"optimistic"` permits concurrent writes with conflict detection at commit time (appropriate for low-contention scenarios where rollbacks are cheap). The `accessRules` field defines per-agent permissions: which agents can read, which can write, and which have administrative control over the state. The `changeNotifications` field records a history of updates so that agents can subscribe to changes and react to state evolution — this is the primary mechanism by which agents stay synchronized in `"continuous"` communication frequency patterns. The `currentValue` field stores the actual shared data as a flexible JSON structure, while `versionVector` supports conflict resolution in distributed scenarios.

```typescript
interface SharedState {
  /** Unique identifier for this shared state instance. */
  id: UUID;
  /** Human-readable name for this shared state variable or structure. */
  name: string;
  /** The collaboration pattern this state belongs to. References CollaborationPattern.id. */
  patternId: UUID;
  /** The execution session within which this state exists. References ExecutionSession.id. */
  sessionId: UUID;
  /** Consistency model: 'strong', 'eventual', 'optimistic'. */
  consistencyModel: string;
  /** The current shared value; schema depends on the use case. */
  currentValue: Record<string, unknown>;
  /** Monotonically increasing version number for optimistic concurrency. */
  version: number;
  /** Version vector for distributed conflict resolution. Maps agentId -> logical clock. */
  versionVector: Record<UUID, number>;
  /** Per-agent access rules: read, write, admin. */
  accessRules: AccessRule[];
  /** History of changes for subscription and replay. */
  changeNotifications: StateChange[];
  /** Maximum number of change notifications to retain. */
  changeHistoryLimit: number;
  /** Agents currently subscribed to change notifications. References Agent.id. */
  subscribers: UUID[];
  /** The lock token currently protecting this state, if consistencyModel is 'strong'. References LockToken.id. */
  activeLockTokenId?: UUID;
  /** Timestamp when the state was created. */
  createdAt: Timestamp;
  /** Timestamp when the state was last modified. */
  updatedAt: Timestamp;
  /** Metadata for state management. */
  metadata: Record<string, unknown>;
}

interface AccessRule {
  /** The agent this rule applies to. References Agent.id. */
  agentId: UUID;
  /** Permission level: 'read', 'write', 'admin'. */
  permission: string;
  /** Whether the agent receives change notifications. */
  notifyOnChange: boolean;
}

interface StateChange {
  /** Unique identifier for this change record. */
  changeId: UUID;
  /** The agent that made the change. References Agent.id. */
  agentId: UUID;
  /** The value after this change (snapshot or delta). */
  newValue: Record<string, unknown>;
  /** Type of change: 'full_replace', 'patch', 'delta', 'merge'. */
  changeType: string;
  /** Version number after this change. */
  version: number;
  /** Timestamp when the change was applied. */
  timestamp: Timestamp;
  /** The lock token that protected this change, if any. References LockToken.id. */
  lockTokenId?: UUID;
}
```

**Key design notes.** The choice of `consistencyModel` is a fundamental design decision with significant performance implications: `"strong"` consistency serializes all writes and is appropriate for critical configuration and decision state, while `"eventual"` consistency enables higher throughput for derived metrics and progress tracking where transient staleness is acceptable. The `versionVector` field supports the `"eventual"` model by allowing the system to detect concurrent updates and apply domain-specific merge strategies. The `changeNotifications` array serves dual purposes: it enables real-time subscription patterns (agents react immediately to changes) and provides an audit trail for post-hoc analysis of how shared state evolved during a collaboration. The `changeHistoryLimit` prevents unbounded growth of the notification log — old entries should be archived to cold storage rather than deleted to preserve the complete history. The `activeLockTokenId` creates an explicit linkage to the locking subsystem, ensuring that strong consistency is always backed by an acquired `LockToken`.


## 12. Event System & Lifecycle Hooks

Every state change in an agentic workspace — a task assigned, an artifact created, a plan checkpoint reached — is an event that other components may need to react to. Without a unified event infrastructure, these reactions are hardcoded: the task system calls the notification system, which calls the audit system. This chapter defines the pub-sub backbone that decouples producers from consumers: type-safe events capturing who did what and why; lifecycle hooks that inject custom behavior at named progression points; and streams, buffers, and subscriptions that make the system reliable under load.

### 12.1 Event Taxonomy & Schema

Before any component can subscribe, the workspace must agree on what an event is and how its payload is structured. This section defines the event envelope, the filter language, and the versioned payload schema system.

#### 12.1.1 DomainEvent

A `DomainEvent` is the fundamental unit of notification — a type-safe record that something significant occurred. It carries an `eventType` discriminator, an `actorId` identifying the initiator, `affectedEntityIds` recording modified entities, and a `causalChain` linking to triggering events to form a causal DAG for debugging and parallel execution analysis. The `sequenceNumber` guarantees ordering within a stream even when wall-clock timestamps collide.

```typescript
interface DomainEvent {
  /** Unique identifier for this event instance. */
  id: UUID;
  /** Type discriminator: 'task.assigned', 'artifact.created', etc. */
  eventType: string;
  /** Schema version enabling independent payload evolution. */
  eventTypeVersion: number;
  /** Entity that initiated the action. References Agent.id or User.id. */
  actorId: UUID;
  /** Actor classification: 'human', 'agent', 'system', 'external'. */
  actorType: string;
  /** IDs of entities directly affected. */
  affectedEntityIds: UUID[];
  /** Primary entity type affected. */
  primaryEntityType: string;
  /** Event-specific payload; schema determined by eventType. */
  payload: EventPayload;
  /** IDs of preceding events forming a causal DAG. */
  causalChain: UUID[];
  /** Correlation identifier grouping related events. */
  correlationId: UUID;
  /** Workspace scope. References Workspace.id. */
  workspaceId: UUID;
  /** Session scope. References ExecutionSession.id. */
  sessionId?: UUID;
  /** Monotonic sequence number within the stream. */
  sequenceNumber: number;
  /** Event emission timestamp. */
  emittedAt: Timestamp;
  /** Whether generated by a lifecycle hook callback. */
  triggeredByHook?: boolean;
  /** Metadata for routing and indexing. */
  metadata: Record<string, unknown>;
}
```

**Key design notes.** The `causalChain` enables answering "which artifact creation caused this task completion?" The `triggeredByHook` flag prevents infinite loops when a hook callback emits an event that triggers another hook.

#### 12.1.2 EventFilter

An `EventFilter` is a declarative subset selector evaluated at the source rather than client-side. It matches by `eventTypePatterns` (glob patterns like `task.*`), `actorIds`, `affectedEntityIds`, time ranges, and payload content via `payloadPredicates`. The `customPredicate` field supports arbitrary boolean expressions for complex conditions. Filters are used by subscriptions, audit queries, automation rules, and replay.

```typescript
interface EventFilter {
  /** Unique identifier. */
  id: UUID;
  /** Human-readable name. */
  name: string;
  /** Event type patterns: exact or glob ('task.*'). */
  eventTypePatterns?: string[];
  /** Actor IDs to include. */
  actorIds?: UUID[];
  /** Actor types: 'human', 'agent', 'system', 'external'. */
  actorTypes?: string[];
  /** Affected entity IDs — event must affect one. */
  affectedEntityIds?: UUID[];
  /** Primary entity types. */
  primaryEntityTypes?: string[];
  /** Workspace scope. References Workspace.id. */
  workspaceId?: UUID;
  /** Session scope. References ExecutionSession.id. */
  sessionId?: UUID;
  /** Lower time bound (inclusive). */
  emittedAfter?: Timestamp;
  /** Upper time bound (inclusive). */
  emittedBefore?: Timestamp;
  /** Payload path predicates. */
  payloadPredicates?: Record<string, unknown>;
  /** Custom predicate in filter DSL. */
  customPredicate?: string;
  /** Include events triggered by hooks. */
  includeHookTriggeredEvents: boolean;
  /** Max results; null = unlimited. */
  limit?: number;
  /** Metadata. */
  metadata: Record<string, unknown>;
}
```

**Key design notes.** The `payloadPredicates` use JSON-path keys without requiring the filter to parse payloads directly — the event bus maintains a payload index. `includeHookTriggeredEvents` defaults to false to prevent visibility pollution.

#### 12.1.3 EventPayload

An `EventPayload` is the strongly typed, event-specific data within a `DomainEvent`. Separating payload from envelope allows schemas to evolve independently — adding a field to `task.assigned` requires no changes to the event bus or subscription system. The `schemaVersion` enables consumers to handle multiple payload versions; the `schemaHash` detects when producer and consumer disagree about expected shape.

```typescript
interface EventPayload {
  /** Event type this payload belongs to. */
  eventType: string;
  /** Schema version — incremented on changes. */
  schemaVersion: number;
  /** Hash of canonical schema for integrity. */
  schemaHash: string;
  /** Event-specific data; schema varies by eventType. */
  payloadData: Record<string, unknown>;
  /** Human-readable summary for UIs. */
  displaySummary?: string;
  /** Compression: 'none', 'gzip', 'zstd'. */
  compression: string;
  /** Original size in bytes. */
  uncompressedSizeBytes: number;
  /** Metadata. */
  metadata: Record<string, unknown>;
}
```

**Key design notes.** `schemaVersion` enables gradual migration: a v3 consumer processes v2 events by applying defaults for missing fields. The `compression` field addresses large payloads — artifact snapshots, thread dumps — that must be compressed for stream throughput.

### 12.2 Lifecycle Hooks & Callbacks

Lifecycle hooks transform the event system from passive notification into active intervention. This section defines hook declarations, executable callbacks, and the registrations that bind them.

#### 12.2.1 LifecycleHook

A `LifecycleHook` defines a named injection point in an entity lifecycle — `before_task_assignment`, `after_artifact_creation`, `on_plan_checkpoint`, `before_agent_termination`. The `haltable` flag distinguishes hooks that may block transitions (a `before_task_assignment` hook may prevent assignment pending approval) from hooks that may only observe. The `blockingTimeoutMs` prevents misbehaving callbacks from freezing the lifecycle.

```typescript
interface LifecycleHook {
  /** Unique identifier. */
  id: UUID;
  /** Globally unique hook name. */
  hookName: string;
  /** Entity type: 'task', 'artifact', 'plan', 'agent', 'conversation'. */
  entityType: string;
  /** Triggering transition: 'create', 'update', 'delete', 'transition'. */
  lifecycleTransition: string;
  /** Whether callbacks may block the lifecycle. */
  haltable: boolean;
  /** Default execution order (lower = earlier). */
  executionOrder: number;
  /** Human-readable description. */
  description: string;
  /** Expected context shape for callbacks. */
  contextSchema: Record<string, unknown>;
  /** Whether async callback execution is supported. */
  supportsAsync: boolean;
  /** Max blocking time before forced termination. */
  blockingTimeoutMs: number;
  /** Workspace scope. References Workspace.id. */
  workspaceId: UUID;
  /** Whether the hook is active. */
  isActive: boolean;
  /** Timestamp. */
  createdAt: Timestamp;
  /** Metadata. */
  metadata: Record<string, unknown>;
}
```

**Key design notes.** Haltable hooks execute synchronously before the transition commits; non-haltable hooks may execute asynchronously after. The `contextSchema` documents the entity context shape, enabling type-safe callback development.

#### 12.2.2 Callback

A `Callback` is the executable invoked when a hook fires. It receives full entity context and may produce side effects, modify the entity, or return a halt decision. The `callbackType` classifies implementation: `inline_script`, `webhook`, `agent_invocation`, or `builtin`. The `canModifyEntity` and `canHalt` flags are permissions enforced by the hook runtime.

```typescript
interface Callback {
  /** Unique identifier. */
  id: UUID;
  /** Human-readable name. */
  name: string;
  /** Implementation type. */
  callbackType: string;
  /** Target hook. References LifecycleHook.id. */
  targetHookId: UUID;
  /** Script body, URL, or agent ID. */
  implementation: string;
  /** Execution mode. */
  executionMode: string;
  /** Runtime limit before forced termination. */
  timeoutMs: number;
  /** May modify entity context. */
  canModifyEntity: boolean;
  /** May halt lifecycle for haltable hooks. */
  canHalt: boolean;
  /** Workspace scope. References Workspace.id. */
  workspaceId: UUID;
  /** Whether enabled. */
  isEnabled: boolean;
  /** Timestamp. */
  createdAt: Timestamp;
  /** Metadata. */
  metadata: Record<string, unknown>;
}
```

**Key design notes.** A callback without `canHalt` that returns a halt decision is ignored, preventing accidental lifecycle blockage. `executionMode` decouples intent from the hook default — a callback may request async at a haltable hook, forfeiting the ability to halt.

#### 12.2.3 HookRegistration

A `HookRegistration` binds a `Callback` to a `LifecycleHook` with execution conditions. The `priority` orders callbacks at the same hook; `filterConditionId` restricts firing ("only for tasks in Project X"); `maxInvocations` supports one-shot debugging hooks. The `errorHandlingPolicy` defines failure behavior: `continue`, `halt`, or `retry` with backoff.

```typescript
interface HookRegistration {
  /** Unique identifier. */
  id: UUID;
  /** Subscribed hook. References LifecycleHook.id. */
  hookId: UUID;
  /** Callback to invoke. References Callback.id. */
  callbackId: UUID;
  /** Execution priority — lower runs first. */
  priority: number;
  /** Filter for conditional firing. References EventFilter.id. */
  filterConditionId?: UUID;
  /** Execution mode override. */
  executionMode: string;
  /** Maximum invocations; null = unlimited. */
  maxInvocations?: number;
  /** Current invocation count. */
  invocationCount: number;
  /** Failure behavior: 'continue', 'halt', 'retry'. */
  errorHandlingPolicy: string;
  /** Retry config for 'retry' policy. */
  retryConfig?: {
    maxRetries: number;
    backoffMs: number;
    backoffMultiplier: number;
  };
  /** Whether active. */
  isActive: boolean;
  /** Creator. References User.id or Agent.id. */
  createdBy: UUID;
  /** Workspace scope. References Workspace.id. */
  workspaceId: UUID;
  /** Timestamps. */
  createdAt: Timestamp;
  updatedAt: Timestamp;
  /** Metadata. */
  metadata: Record<string, unknown>;
}
```

**Key design notes.** Separating hook, callback, and registration enables reuse: one callback registered against multiple hooks, one hook hosting many registrations. `priority` supports ordered chains where one callback's modification is visible to subsequent callbacks.

### 12.3 Event Streams & Subscriptions

This section defines the durable delivery infrastructure: streams preserving ordering, buffers absorbing backpressure, and subscriptions connecting consumers to relevant events.

#### 12.3.1 EventStream

An `EventStream` is an ordered, append-only sequence of `DomainEvent` records. Three scopes exist: `global` (all workspace events), `entity_specific` (events for one artifact, task, or agent), and `filtered` (events matching a predefined `EventFilter`). The `checkpointSequenceNumber` marks the position up to which all events are durably processed, enabling history truncation.

```typescript
interface EventStream {
  /** Unique identifier. */
  id: UUID;
  /** Human-readable name. */
  name: string;
  /** Scope type. */
  scopeType: string;
  /** Tracked entity, if entity-specific. */
  entityId?: UUID;
  /** Applied filter, if filtered. References EventFilter.id. */
  filterId?: UUID;
  /** Workspace scope. References Workspace.id. */
  workspaceId: UUID;
  /** Highest sequence number. */
  headSequenceNumber: number;
  /** Durable-processed position for truncation. */
  checkpointSequenceNumber: number;
  /** Retention policy. */
  retentionPolicy: string;
  /** Retention parameter. */
  retentionValue?: number;
  /** Supports real-time push. */
  supportsLiveConsumption: boolean;
  /** Supports historical replay. */
  supportsReplay: boolean;
  /** Active subscriptions. References Subscription.id. */
  activeSubscriptionIds: UUID[];
  /** Timestamps. */
  createdAt: Timestamp;
  lastAppendedAt: Timestamp;
  /** Metadata. */
  metadata: Record<string, unknown>;
}
```

**Key design notes.** Entity-specific streams enable fast "everything that happened to this task" queries without scanning the global log. Filtered streams are materialized views — they index into the underlying stream rather than duplicating events.

#### 12.3.2 EventBuffer

An `EventBuffer` sits between producers and consumers, absorbing bursts when production exceeds consumption. The `capacity` defines maximum held events; when reached, `evictionPolicy` chooses behavior: `drop_oldest`, `drop_newest`, or `block_producer` for backpressure. The `flushTrigger` configures release timing: `size_threshold`, `time_window`, or `transaction_boundary` for atomic delivery.

```typescript
interface EventBuffer {
  /** Unique identifier. */
  id: UUID;
  /** Human-readable name. */
  name: string;
  /** Upstream stream. References EventStream.id. */
  sourceStreamId: UUID;
  /** Maximum events held. */
  capacity: number;
  /** Behavior at capacity: 'drop_oldest', 'drop_newest', 'block_producer'. */
  evictionPolicy: string;
  /** Flush timing trigger. */
  flushTrigger: string;
  /** Flush threshold — count or milliseconds. */
  flushThresholdValue: number;
  /** Current buffered count. */
  bufferedEventCount: number;
  /** Oldest buffered event time. */
  oldestBufferedAt?: Timestamp;
  /** Total events dropped since creation. */
  totalDroppedEvents: number;
  /** Total flushes since creation. */
  totalFlushOperations: number;
  /** Average flush latency. */
  averageFlushLatencyMs: number;
  /** Currently blocking producers. */
  isBlockingProducers: boolean;
  /** Workspace scope. References Workspace.id. */
  workspaceId: UUID;
  /** Timestamp. */
  createdAt: Timestamp;
  /** Metadata. */
  metadata: Record<string, unknown>;
}
```

**Key design notes.** `block_producer` implements backpressure: full buffers block producing operations until space frees. `transaction_boundary` ensures all events in a logical transaction are delivered atomically. `averageFlushLatencyMs` drives autoscaling — sustained high latency signals the need for more consumer capacity.

#### 12.3.3 Subscription

A `Subscription` registers a consumer to receive events from an `EventStream`. The `deliveryMode` supports `push` (events sent to `handlerEndpoint`) or `pull` (consumer requests batches from a cursor). The `durabilityLevel` controls reliability: `ephemeral` (drop when offline), `at_least_once` (redeliver until acknowledged), or `exactly_once` (workspace deduplicates). The `lastAcknowledgedSequenceNumber` enables resume after disconnection.

```typescript
interface Subscription {
  /** Unique identifier. */
  id: UUID;
  /** Human-readable name. */
  name: string;
  /** Consumed stream. References EventStream.id. */
  streamId: UUID;
  /** Additional consumer filter. References EventFilter.id. */
  consumerFilterId?: UUID;
  /** 'push' or 'pull'. */
  deliveryMode: string;
  /** Push endpoint: URL, queue, or function ref. */
  handlerEndpoint?: string;
  /** Acknowledged cursor position. */
  lastAcknowledgedSequenceNumber: number;
  /** 'ephemeral', 'at_least_once', 'exactly_once'. */
  durabilityLevel: string;
  /** Max events per batch. */
  batchSize: number;
  /** Owner. References User.id or Agent.id. */
  subscriberId: UUID;
  /** Whether active. */
  isActive: boolean;
  /** Last successful delivery. */
  lastDeliveredAt?: Timestamp;
  /** Consecutive delivery failures. */
  consecutiveFailures: number;
  /** Paused due to excessive failures. */
  isPaused: boolean;
  /** Workspace scope. References Workspace.id. */
  workspaceId: UUID;
  /** Timestamps. */
  createdAt: Timestamp;
  updatedAt: Timestamp;
  /** Metadata. */
  metadata: Record<string, unknown>;
}
```

**Key design notes.** `consecutiveFailures` with `isPaused` implements a circuit breaker preventing wasted delivery to dead endpoints. `consumerFilterId` enables stream sharing — multiple subscriptions apply independent filters without separate materialization. `exactly_once` push mode requires maintaining delivery state until acknowledgement, reserved for critical automation.


## 13. Governance, Access Control & Audit

Autonomous agents amplify every risk that traditional access control was designed to contain. A human developer who misclicks deletes one file; an agent with a misunderstood instruction can overwrite an entire repository in seconds. This chapter defines the governance substrate of the agentic workspace — the data shapes that answer three existential questions: who can do what, how are those boundaries enforced at runtime, and how is every decision recorded for later scrutiny. The permission model must accommodate both human and non-human actors, the policy engine must evaluate constraints in milliseconds on every agent action, and the audit trail must be tamper-evident so that post-incident analysis can trust what it reads. Every shape in this section is designed under the assumption that agents will attempt things they should not, that policies will conflict, and that regulatory auditors will eventually demand proof.

### 13.1 Permission Model & Access Control

The permission system provides three composable layers: individual Permissions define atomic access rights, Roles bundle Permissions into named collections scoped to workspaces or projects, and AccessPolicies evaluate requests by combining identity attributes with resource properties and environmental context. An agent's effective access at any moment is the intersection of all three layers — what the permission grants, what the role includes, and what the policy allows given current conditions.

#### 13.1.1 Permission

A Permission represents a single, indivisible access right against a specific resource or resource type. It is the atomic building block of the entire authorization system — every access check ultimately resolves to a set of Permission instances. The `action` field uses namespaced verbs (`codefile:read`, `task:execute`, `workspace:administer`) to avoid ambiguity when multiple domains define similar operations. The `resourceScope` determines whether this permission applies to a specific instance (e.g., "read this one file"), all instances of a type ("read any CodeFile"), or a wildcard pattern ("read any file matching `/docs/**`"). Permissions are stored as first-class entities so they can be individually granted, revoked, and audited, rather than being embedded as string arrays inside roles where their provenance would be opaque.

```typescript
interface Permission {
  /** Unique identifier for this permission definition. */
  id: UUID;
  /** Namespaced action verb: 'codefile:read', 'task:execute', 'workspace:administer'. */
  action: string;
  /** Scope of resource applicability: 'instance', 'type', or 'pattern'. */
  resourceScope: "instance" | "type" | "pattern";
  /** Target resource type identifier, if scope is 'type' or 'pattern'. */
  resourceType?: string;
  /** Specific resource instance ID, if scope is 'instance'. */
  resourceId?: UUID;
  /** Glob-style pattern for resource matching, if scope is 'pattern'. */
  resourcePattern?: string;
  /** Human-readable description of what this permission allows. */
  description: string;
  /** Whether this permission can be granted to agents (false = human-only). */
  allowAgentGrant: boolean;
  /** Maximum risk level this permission is allowed to reach before requiring additional approval. */
  riskLevel: "low" | "medium" | "high" | "critical";
  /** Timestamp when this permission definition was created. */
  createdAt: Timestamp;
  /** Identity that created this permission definition. */
  createdBy: UUID;
}
```

**Key design notes.** The `allowAgentGrant` boolean is essential in agentic systems: some permissions (e.g., deploying to production, modifying access control itself) must never be held by autonomous agents regardless of how trusted they are. The `riskLevel` field enables dynamic escalation — an agent holding a `high` risk permission may be required to pass additional checks or human approval gates before exercising it. The namespaced `action` format ensures that as new resource types are added to the workspace, their permissions cannot accidentally collide with existing verbs.

#### 13.1.2 Role

A Role is a named collection of Permissions that can be assigned to an actor (human or agent) within a specific scope. Rather than granting permissions individually, administrators bundle them into conceptual roles such as "Project Owner", "Code Reviewer", or "Documentation Agent" and assign the role as a unit. The `scope` field determines where the role applies: a workspace-level role grants its permissions across all projects, a project-level role is bounded to one project, and a resource-level role applies only to a specific artifact or file. The same actor may hold different roles in different scopes — an agent may be a "Contributor" in Project A while being a "Viewer" in Project B. Roles can compose other roles via `includedRoleIds`, enabling inheritance hierarchies that avoid duplicating permission sets.

```typescript
interface Role {
  /** Unique identifier for this role. */
  id: UUID;
  /** Human-readable role name: 'Project Owner', 'Contributor', 'Reviewer'. */
  name: string;
  /** Scope of applicability: 'workspace', 'project', or 'resource'. */
  scope: "workspace" | "project" | "resource";
  /** Workspace this role belongs to. References Workspace.id. */
  workspaceId: UUID;
  /** Project this role applies to, if scope is 'project'. References Project.id. */
  projectId?: UUID;
  /** Specific resource this role applies to, if scope is 'resource'. */
  resourceId?: UUID;
  /** IDs of permissions granted by this role. References Permission.id. */
  permissionIds: UUID[];
  /** IDs of other roles whose permissions are included transitively. References Role.id. */
  includedRoleIds: UUID[];
  /** Whether this role can be assigned to agents (false = human actors only). */
  assignableToAgents: boolean;
  /** Whether this role is defined by the system or a workspace administrator. */
  isSystemRole: boolean;
  /** Human-readable description of responsibilities. */
  description: string;
  /** Timestamp when this role was created. */
  createdAt: Timestamp;
  /** Identity that created this role. */
  createdBy: UUID;
}
```

**Key design notes.** The `assignableToAgents` flag works in concert with Permission's `allowAgentGrant` to create a defense-in-depth boundary: even if an administrator accidentally adds a forbidden permission to a role, the role itself cannot be assigned to an agent. The `includedRoleIds` field enables the classic "Senior Developer" role that includes all permissions from "Developer" plus additional administrative rights, eliminating the need to maintain duplicate permission lists and ensuring that permission additions to the base role propagate automatically.

#### 13.1.3 AccessPolicy

An AccessPolicy is the dynamic, request-time evaluation engine that supplements the static grant model of Permissions and Roles. Where Permissions answer "does this actor hold the right?" and Roles answer "which rights are bundled together?", the AccessPolicy answers "should this specific request be permitted given who the actor is, what they are accessing, what conditions apply, and what is happening in the environment right now?" Policies combine identity attributes ("is this a human or an agent?", "what trust tier?"), resource properties ("is this a production environment?", "does the file contain secrets?"), contextual conditions ("time of day", "active session count"), and environmental factors ("is the deployment pipeline healthy?", "are there open incidents?"). A request is authorized only when all applicable policies evaluate to permit.

```typescript
interface AccessPolicy {
  /** Unique identifier for this policy. */
  id: UUID;
  /** Human-readable policy name. */
  name: string;
  /** Evaluation precedence — higher values evaluated first for override policies. */
  priority: number;
  /** Effect when conditions match: 'permit', 'deny', or 'require_approval'. */
  effect: "permit" | "deny" | "require_approval";
  /** Identity attribute conditions: actor type, trust tier, role membership. */
  identityConditions: PolicyCondition[];
  /** Resource property conditions: type, sensitivity label, environment tag. */
  resourceConditions: PolicyCondition[];
  /** Contextual conditions: time windows, session state, concurrent request limits. */
  contextConditions: PolicyCondition[];
  /** Environmental conditions: system health, incident status, deployment state. */
  environmentConditions: PolicyCondition[];
  /** The approval chain required if effect is 'require_approval'. References ApprovalChain.id. */
  approvalChainId?: UUID;
  /** Whether this policy is currently active. */
  isActive: boolean;
  /** Workspace this policy applies to. References Workspace.id. */
  workspaceId: UUID;
  /** Timestamp when this policy was created. */
  createdAt: Timestamp;
  /** Timestamp when this policy was last modified. */
  updatedAt: Timestamp;
}

/** Atomic condition within an AccessPolicy — field, operator, and value triple. */
interface PolicyCondition {
  /** The attribute field to evaluate: 'actor.type', 'resource.sensitivity', 'context.timeOfDay'. */
  field: string;
  /** Comparison operator: 'eq', 'ne', 'in', 'gt', 'lt', 'regex', 'contains'. */
  operator: string;
  /** The value or values to compare against. */
  value: unknown;
}
```

**Key design notes.** The `PolicyCondition` triple (field, operator, value) is intentionally simple to enable efficient evaluation: a policy engine can index conditions by field and short-circuit entire policy blocks when a known condition is unsatisfiable. The `require_approval` effect transforms the policy from a binary allow/deny gate into a workflow trigger — instead of blocking the request, it pauses execution and routes an approval request through the designated chain (Chapter 7). This is critical for agentic workflows where a hard deny would break autonomous execution, but an unchecked permit would be unsafe.

### 13.2 Policy Enforcement & Constraints

Permissions and policies define what should happen; this section defines what the system actually enforces at runtime. PolicyRules are declarative statements of organizational intent ("no agent may deploy without human approval"), Constraints are hard technical limits applied at execution time ("maximum 1000 tokens per response"), and Violations capture what happens when enforcement fails. Together these shapes bridge the gap between governance intent and runtime reality.

#### 13.2.1 PolicyRule

A PolicyRule is a declarative statement of organizational constraint expressed in human-readable form but machine-enforceable structure. Rules capture governance intent that transcends individual permissions: they express cross-cutting requirements such as "no agent may deploy to production without human approval", "all code changes require review by a second agent", or "sensitive files cannot be accessed by external-service identities". The `enforcementMode` field determines how the rule affects execution: `strict` blocks the action entirely, `advisory` allows the action but surfaces a warning to the actor and any observers, and `audit_only` records the event without interfering with execution — a mode useful for rule rollout and impact assessment before switching to stricter enforcement.

```typescript
interface PolicyRule {
  /** Unique identifier for this rule. */
  id: UUID;
  /** Human-readable rule statement. */
  statement: string;
  /** Machine-interpretable rule category: 'deployment_approval', 'code_review', 'sensitive_access', 'resource_limit'. */
  category: string;
  /** Enforcement mode: 'strict' (block), 'advisory' (warn), or 'audit_only' (log). */
  enforcementMode: "strict" | "advisory" | "audit_only";
  /** The access policy that implements this rule, if machine-enforceable. References AccessPolicy.id. */
  implementingPolicyId?: UUID;
  /** Target resource types this rule applies to. */
  appliesToResourceTypes: string[];
  /** Target actor types: 'human', 'agent', or 'service'. */
  appliesToActorTypes: ("human" | "agent" | "service")[];
  /** Scope of rule application: workspace, project, or global. */
  scope: "workspace" | "project" | "global";
  /** Workspace or project this rule applies to, if not global. */
  scopeTargetId?: UUID;
  /** Whether this rule is currently active. */
  isActive: boolean;
  /** Timestamp when this rule was created. */
  createdAt: Timestamp;
  /** Identity that authored this rule. */
  createdBy: UUID;
}
```

**Key design notes.** The separation between `statement` (human-readable) and `implementingPolicyId` (machine-executable) acknowledges that not all governance intent can be precisely encoded as policy conditions — some rules require human judgment. The `enforcementMode` spectrum enables gradual rollout: a new rule begins as `audit_only` to measure how often it would trigger, graduates to `advisory` to warn actors, and finally becomes `strict` once confidence is established. The `appliesToActorTypes` array allows rules to differentiate between human and agent actors — a rule requiring "review by a second agent" only applies when the actor is an agent, not when a human initiates the action.

#### 13.2.2 Constraint

A Constraint is a hard technical limitation applied at execution time, distinct from the organizational intent captured by PolicyRule. Where PolicyRules express "should not" (governance), Constraints enforce "cannot" (physics). They define runtime boundaries such as maximum token consumption per response, network access restrictions during code execution, directory bounds that confine file operations to a sandbox, or rate limits on external API calls. Constraints are evaluated by the execution environment before an agent action is permitted to proceed, and they trigger one of three responses: `block` (prevent the action), `warn` (allow but notify), or `log` (record for later analysis). Every Constraint carries a `currentValue` and `limitValue` enabling real-time monitoring of how close an agent is to its boundaries.

```typescript
interface Constraint {
  /** Unique identifier for this constraint. */
  id: UUID;
  /** Human-readable constraint name. */
  name: string;
  /** Constraint category: 'token_cap', 'network_restriction', 'directory_bound', 'rate_limit', 'memory_limit', 'execution_timeout'. */
  category: string;
  /** The entity this constraint applies to: agent, workstream, or global. */
  appliesToType: "agent" | "workstream" | "global";
  /** ID of the entity this constraint applies to, if not global. References Agent.id or Workstream.id. */
  appliesToId?: UUID;
  /** The current value of the constrained metric (e.g., tokens consumed, requests made). */
  currentValue: number;
  /** The hard limit that must not be exceeded. */
  limitValue: number;
  /** Unit of measurement: 'tokens', 'requests_per_minute', 'bytes', 'seconds', 'count'. */
  unit: string;
  /** Trigger behavior when limit is reached: 'block', 'warn', or 'log'. */
  onLimitReached: "block" | "warn" | "log";
  /** Whether the constraint resets on a periodic basis: 'none', 'hourly', 'daily', 'session'. */
  resetPeriod: "none" | "hourly" | "daily" | "session";
  /** Timestamp when this constraint was created. */
  createdAt: Timestamp;
  /** Timestamp when this constraint was last updated. */
  updatedAt: Timestamp;
}
```

**Key design notes.** Constraints are evaluated at the execution boundary — the sandbox or runtime environment checks them before allowing an agent's action to affect external systems. The `resetPeriod` field is essential for temporal constraints: a "100 requests per minute" limit and a "1000 requests per day" limit may apply to the same agent simultaneously, each with independent counters. The `currentValue` field enables proactive throttling — when an agent reaches 80% of a token cap, the system can reduce its `max_tokens` parameter in subsequent requests rather than waiting for a hard block. Constraints are often derived from PolicyRules (a "no production deployment without approval" rule translates to an execution constraint that blocks the deploy action), but they may also be set independently by system administrators for resource management.

#### 13.2.3 Violation

A Violation records an instance of a breached PolicyRule or exceeded Constraint. It is the accountability artifact of the governance system — the data shape that answers "what rule was broken, who broke it, against what resource, how severe was it, and has it been fixed?" Every Violation triggers downstream actions: alerts to workspace administrators, automated responses such as agent quarantine or permission revocation, and compliance reporting. The `severity` field drives response escalation: `critical` violations may immediately suspend the responsible agent, `high` violations trigger review workflows, and `low` violations are batched for periodic review. The `remediationStatus` tracks the violation through its lifecycle from detection to resolution.

```typescript
interface Violation {
  /** Unique identifier for this violation record. */
  id: UUID;
  /** The rule that was breached, if applicable. References PolicyRule.id. */
  ruleId?: UUID;
  /** The constraint that was exceeded, if applicable. References Constraint.id. */
  constraintId?: UUID;
  /** The identity responsible for the violation — user, agent, or service. References Actor.id. */
  actorId: UUID;
  /** The resource that was affected by the violation. */
  resourceId: UUID;
  /** Type of the affected resource. */
  resourceType: string;
  /** Severity level: 'critical', 'high', 'medium', or 'low'. */
  severity: "critical" | "high" | "medium" | "low";
  /** Human-readable description of what occurred. */
  description: string;
  /** Enforcement response that was triggered: 'blocked', 'warned', 'logged', 'quarantined', 'escalated'. */
  enforcementResponse: string;
  /** Remediation status: 'open', 'under_review', 'remediated', 'accepted_risk', 'false_positive'. */
  remediationStatus: "open" | "under_review" | "remediated" | "accepted_risk" | "false_positive";
  /** Human or system-provided explanation of remediation actions taken. */
  remediationNotes?: string;
  /** Identity that reviewed and resolved this violation, if applicable. */
  reviewedBy?: UUID;
  /** The execution session during which the violation occurred. References ExecutionSession.id. */
  sessionId?: UUID;
  /** Timestamp when the violation was detected. */
  detectedAt: Timestamp;
  /** Timestamp when the violation was remediated or accepted, if applicable. */
  resolvedAt?: Timestamp;
  /** Merkle root of the audit log entries related to this violation, for tamper-evident cross-reference. */
  auditMerkleRoot?: string;
}
```

**Key design notes.** The `auditMerkleRoot` field cryptographically links each Violation to the underlying AuditLog entries that recorded the breach, ensuring that the violation record cannot be falsified without also breaking the integrity chain of the audit log itself. The `enforcementResponse` field captures what the system actually did (block, warn, quarantine) rather than what the rule specified — this distinction is critical for post-incident analysis, as a `strict` rule may be downgraded to `warn` during system degradation. The `false_positive` remediation status acknowledges that automated violation detection is imperfect, particularly for context-sensitive rules, and provides an explicit resolution path that removes false positives from compliance tallies.

### 13.3 Audit Trail & Compliance

The audit and compliance layer transforms runtime enforcement data into trustworthy, queryable records suitable for security review, regulatory compliance, and forensic analysis. AuditLog entries are append-only and tamper-evident, forming an integrity chain that stretches back to workspace creation. DataRetention policies govern how long different categories of audit data are preserved. ComplianceReport surfaces structured summaries for human reviewers and external auditors.

#### 13.3.1 AuditLog

An AuditLog entry is an append-only, tamper-evident record of every access attempt, permission evaluation, and agent action within the workspace. It is the system of record for accountability — the shape that makes every other governance primitive auditable. Each entry captures the five Ws of security logging: who (actor), what (action), where (resource), when (timestamp), and why (policy decision). The `decision` field records whether the action was permitted or denied and which specific PolicyRule or Constraint governed the outcome. Critically, every entry carries a `merkleHash` that forms a cryptographic chain with the previous entry, making the entire audit log tamper-evident: any modification to a historical entry invalidates all subsequent hashes.

```typescript
interface AuditLog {
  /** Unique identifier for this audit entry. */
  id: UUID;
  /** Sequential entry number — monotonically increasing within the workspace. */
  sequenceNumber: number;
  /** The actor that performed or attempted the action. References Actor.id. */
  actorId: UUID;
  /** The target resource of the action. */
  resourceId: UUID;
  /** Type of the target resource. */
  resourceType: string;
  /** The action that was attempted: 'read', 'write', 'execute', 'delete', 'administer'. */
  action: string;
  /** Authorization decision: 'permitted', 'denied', or 'escalated'. */
  decision: "permitted" | "denied" | "escalated";
  /** ID of the policy rule that governed this decision, if applicable. References PolicyRule.id. */
  governingRuleId?: UUID;
  /** IDs of all roles the actor held at the time of the request. */
  actorRoleIds: UUID[];
  /** IDs of all policies evaluated during authorization. */
  evaluatedPolicyIds: UUID[];
  /** Execution session context, if applicable. References ExecutionSession.id. */
  sessionId?: UUID;
  /** Timestamp of the action attempt. */
  timestamp: Timestamp;
  /** Merkle hash linking this entry to the previous for tamper evidence. */
  merkleHash: string;
  /** Cryptographic hash of the entry contents for integrity verification. */
  entryHash: string;
  /** Human-readable context for the action. */
  description: string;
  /** Machine-structured additional data relevant to the audit entry. */
  metadata: Record<string, unknown>;
}
```

**Key design notes.** The `sequenceNumber` provides a fast, ordered index that is independent of wall-clock timestamps — essential because distributed agents may generate events with out-of-order or skewed clocks. The `merkleHash` field chains each entry to its predecessor by hashing the previous entry's hash together with the current entry's content, creating a chain that is computationally infeasible to alter retroactively. The `evaluatedPolicyIds` array captures the complete policy evaluation context, enabling auditors to reconstruct exactly which policies were considered and why a particular decision was reached. AuditLog entries are immutable and cannot be deleted by any actor, including workspace administrators; retention is governed exclusively by DataRetention policies.

#### 13.3.2 DataRetention

A DataRetention policy governs how long different categories of workspace data are preserved before archival or deletion. In an agentic workspace, data categories include audit logs, agent memory traces, conversation threads, produced artifacts, and temporary execution outputs — each with distinct legal, operational, and cost implications. The policy defines a retention duration per category, an archival action (`archive` for long-term compressed storage, `delete` for permanent removal, or `anonymize` for privacy-preserving retention), and legal hold exceptions that override scheduled deletion when litigation or compliance investigations are active. The `category` field uses a taxonomy that aligns with the workspace's data classification scheme.

```typescript
interface DataRetention {
  /** Unique identifier for this retention policy. */
  id: UUID;
  /** Human-readable policy name. */
  name: string;
  /** Data category: 'audit_log', 'agent_memory', 'conversation', 'artifact', 'execution_output', 'temporary'. */
  category: string;
  /** Retention duration in days before archival action is triggered. */
  retentionDays: number;
  /** Action to take after retention period: 'archive', 'delete', or 'anonymize'. */
  archivalAction: "archive" | "delete" | "anonymize";
  /** Whether a legal hold is currently active, preventing any archival action. */
  legalHoldActive: boolean;
  /** Reason for the legal hold, if applicable. */
  legalHoldReason?: string;
  /** Identity that placed the legal hold, if active. */
  legalHoldBy?: UUID;
  /** Timestamp when the legal hold was placed, if active. */
  legalHoldAt?: Timestamp;
  /** Whether this policy applies workspace-wide or to a specific project. */
  scope: "workspace" | "project";
  /** Project this policy applies to, if scope is 'project'. References Project.id. */
  projectId?: UUID;
  /** Workspace this policy belongs to. References Workspace.id. */
  workspaceId: UUID;
  /** Timestamp when this policy was created. */
  createdAt: Timestamp;
  /** Timestamp when this policy was last modified. */
  updatedAt: Timestamp;
}
```

**Key design notes.** The `legalHoldActive` boolean provides an emergency brake that supersedes all automated retention processing — when active, no data in the category may be archived, deleted, or anonymized regardless of age. This is essential for litigation readiness and regulatory investigations where premature deletion would constitute spoliation. The `anonymize` archival action enables privacy-compliant retention: instead of deleting potentially valuable analytical data, identifying fields are stripped so that aggregate patterns can still be studied without exposing individual actor behavior. Retention policies are themselves auditable; every modification to a DataRetention policy generates an AuditLog entry.

#### 13.3.3 ComplianceReport

A ComplianceReport is a structured summary generated from AuditLog data, designed for human reviewers, security teams, and external auditors. It synthesizes raw audit entries into actionable intelligence: activity metrics (how many actions were taken, by whom, over what period), violation tallies (how many PolicyRules were breached, which were most frequently violated), access pattern analysis (which resources were accessed most, which agents are most active), and attestations (signed statements that the report data is complete and unmodified). Reports can be generated on-demand for incident response or on a scheduled basis for continuous compliance monitoring. The `signature` field carries a cryptographic signature over the report contents, ensuring that once generated, the report cannot be altered without invalidating the signature.

```typescript
interface ComplianceReport {
  /** Unique identifier for this report. */
  id: UUID;
  /** Report type: 'activity_summary', 'violation_audit', 'access_pattern', 'full_compliance'. */
  reportType: string;
  /** The time period this report covers. */
  periodStart: Timestamp;
  /** The time period this report covers. */
  periodEnd: Timestamp;
  /** Workspace this report covers. References Workspace.id. */
  workspaceId: UUID;
  /** Total number of audit entries analyzed for this report. */
  totalEventsAnalyzed: number;
  /** Summary of activity by actor type: counts of human vs agent actions. */
  activityByActorType: Record<string, number>;
  /** Summary of actions by decision type: permitted, denied, escalated. */
  decisionSummary: Record<string, number>;
  /** Violation tally: rule ID → count of violations during the period. */
  violationTallies: Record<UUID, number>;
  /** IDs of the most frequently accessed resources during the period. */
  mostAccessedResourceIds: UUID[];
  /** IDs of agents with the highest action counts during the period. */
  mostActiveAgentIds: UUID[];
  /** Whether all audit log entries in the period passed integrity verification. */
  integrityVerified: boolean;
  /** Cryptographic signature over the report contents. */
  signature: string;
  /** Identity that generated and signed this report. */
  generatedBy: UUID;
  /** Timestamp when this report was generated. */
  generatedAt: Timestamp;
}
```

**Key design notes.** The `integrityVerified` boolean reports whether the Merkle chain of all AuditLog entries in the report period was verified before report generation — a critical attestation that the underlying data has not been tampered with. The `signature` field binds the entire report to the identity that generated it, creating non-repudiation: the generator cannot later claim the report was falsified. The `violationTallies` map uses Rule IDs as keys, enabling drill-down from summary numbers to specific PolicyRule definitions. ComplianceReports are themselves subject to DataRetention policies as `artifact`-category data, ensuring that generated reports are preserved according to the same governance framework they attest to.


## 14. Cross-Cutting Primitives, Reflection & Extensions

This final chapter defines the cross-cutting meta-layer: type primitives that unify heterogeneous data, reflection infrastructure enabling agents to observe their own cognition, and the extension model transforming the system into an open platform.

### 14.1 Shared Type Primitives

#### 14.1.1 TypedValue — Runtime Type-Tagged Value Container

TypedValue pairs an arbitrary payload with a `SchemaRef` describing its structure — the universal envelope for heterogeneous data appearing in `Event.payload` (Chapter 10), `AgentMessage.content` (Chapter 11), and `Extension.configuration`.

```typescript
interface TypedValue {
  /** Unique identifier. */
  id: UUID;
  /** Schema describing payload structure. */
  schemaRef: SchemaRef;
  /** Data payload — validated against schemaRef at runtime. */
  payload: unknown;
  /** Schema version at creation. */
  schemaVersion: string;
  /** Encoding: 'json', 'protobuf', 'raw', 'base64'. */
  encoding?: 'json' | 'protobuf' | 'raw' | 'base64';
  /** UI display label. */
  displayLabel?: string;
  /** Creation timestamp. */
  createdAt: Timestamp;
  /** Creator entity ID. */
  creatorId: UUID;
}
```

The `payload` field carries type `unknown` deliberately — structure is validated at runtime, eliminating the need for compile-time type knowledge where extensions and agents introduce novel shapes dynamically.

#### 14.1.2 SchemaRef — Runtime Schema Reference

SchemaRef provides an unambiguous reference to a type definition, enabling runtime schema discovery and cross-language sharing. Referenced by TypedValue, ValidationRule, and ExtensionPoint.

```typescript
interface SchemaRef {
  /** Schema registry identifier. */
  schemaId: UUID;
  /** Name: 'AgentMessage', 'DesignDoc'. */
  name: string;
  /** Namespace: 'core', 'ext.acme.corp', 'agent.7f3a9b'. */
  namespace: string;
  /** Semantic version. */
  version: string;
  /** URI to schema document. */
  schemaUri: string;
  /** Document hash for integrity. */
  contentHash: string;
  /** 'core', 'extension', 'agent-generated', 'ephemeral'. */
  kind: 'core' | 'extension' | 'agent-generated' | 'ephemeral';
  /** 'stable', 'experimental', 'deprecated', 'superseded'. */
  stability: 'stable' | 'experimental' | 'deprecated' | 'superseded';
  /** Replacement schema if superseded. */
  supersededBy?: UUID;
  /** Registration timestamp. */
  registeredAt: Timestamp;
}
```

The hierarchical `namespace` prevents collisions between core, extension, and agent-generated types in a decentralized ecosystem.

#### 14.1.3 ValidationRule — Constraint Specification

ValidationRule formalizes constraints for well-formedness checking in a system where data shapes are defined dynamically. Rules attach to schemas, values, or ExtensionPoint contracts.

```typescript
interface ValidationRule {
  /** Unique identifier. */
  ruleId: UUID;
  /** Name: 'port-range', 'required-field'. */
  name: string;
  /** 'type', 'range', 'presence', 'format', 'cross-field', 'custom'. */
  ruleType: 'type' | 'range' | 'presence' | 'format' | 'cross-field' | 'custom';
  /** JSONPath targeting field(s) under validation. */
  targetPath: string;
  /** Expected type name. */
  expectedType?: string;
  /** Inclusive bounds. */
  min?: number;
  max?: number;
  /** Regex or format name. */
  pattern?: string;
  /** Whether null/missing is permitted. */
  required?: boolean;
  /** Related field for cross-field checks. */
  relatedPath?: string;
  /** External validator URI for custom rules. */
  customValidatorUri?: string;
  /** Failure message. */
  errorMessage: string;
  /** 'error' rejects; 'warning' permits with notice. */
  severity: 'error' | 'warning';
  /** Target schema. */
  appliesToSchema?: SchemaRef;
}
```

The `ruleType` discriminant routes efficiently — native execution for type and range, delegation for `custom`. `severity` distinguishes fatal violations from warnings where slightly malformed intermediates may still yield value.

### 14.2 Reflection & Meta-Cognition

#### 14.2.1 ReasoningChain — Inspectable Step-by-Step Thinking Process

ReasoningChain captures agent deliberation as a traversable data structure. Each step is an inferential move annotated with confidence, evidence, and predecessor links. Connects to `Message` (Chapter 4) via `reasoningChainId` and feeds `EpisodicMemory` (Chapter 2) consolidation.

```typescript
interface ReasoningChain {
  /** Unique identifier. */
  id: UUID;
  /** Reasoning agent ID. */
  agentId: UUID;
  /** Ordered reasoning steps. */
  steps: ReasoningStep[];
  /** Overall conclusion. */
  conclusion: string;
  /** Confidence: 0.0 to 1.0. */
  finalConfidence: number;
  /** Context scope. */
  contextScopeId: UUID;
  /** Triggering task/message ID. */
  triggeredById?: UUID;
  /** 'in-progress', 'completed', 'abandoned', 'revising'. */
  status: 'in-progress' | 'completed' | 'abandoned' | 'revising';
  /** Start/end times. */
  startedAt: Timestamp;
  endedAt?: Timestamp;
  /** Tags: 'planning', 'debugging', 'analytical'. */
  tags: string[];
}

interface ReasoningStep {
  /** Step identifier. */
  stepId: UUID;
  /** Sequence order. */
  sequenceIndex: number;
  /** 'hypothesis', 'evidence', 'inference', 'backtrack', 'synthesis', 'question'. */
  stepType: 'hypothesis' | 'evidence' | 'inference' | 'backtrack' | 'synthesis' | 'question';
  /** Reasoning description. */
  description: string;
  /** Confidence: 0.0 to 1.0. */
  confidence: number;
  /** Supporting memory/prior step IDs. */
  supportingEvidence: UUID[];
  /** Preceding step; null for roots. */
  parentStepId?: UUID;
  /** Steps invalidated (backtracking). */
  supersedesStepIds?: UUID[];
  /** Step output as TypedValue. */
  intermediateResult?: TypedValue;
}
```

`supersedesStepIds` preserves non-linear traces — invalidated hypotheses remain auditable for debugging and training. `intermediateResult` uses `TypedValue` for varied step outputs.

#### 14.2.2 SelfAssessment — Agent Self-Evaluation Record

SelfAssessment formalizes an agent's evaluation of capabilities and calibration accuracy, preventing overconfident behavior. Connects to `Persona` (Chapter 1) and is consulted by task routing.

```typescript
interface SelfAssessment {
  /** Unique identifier. */
  id: UUID;
  /** Assessed agent. */
  agentId: UUID;
  /** Version incremented as the agent learns. */
  assessmentVersion: number;
  /** Confidence-accuracy per domain. */
  calibrationScores: CalibrationScore[];
  /** Known limitations. */
  knownLimitations: KnownLimitation[];
  /** Autonomous acceptance thresholds. */
  capabilityBoundaries: CapabilityBoundary[];
  /** Overall competence: 0.0 to 1.0. */
  overallCompetence: number;
  /** 'self-generated', 'human-reviewed', 'benchmarked', 'hybrid'. */
  assessmentSource: 'self-generated' | 'human-reviewed' | 'benchmarked' | 'hybrid';
  /** Last update. */
  lastUpdatedAt: Timestamp;
  /** Prior assessment in version chain. */
  supersedesAssessmentId?: UUID;
}

interface CalibrationScore {
  /** Domain: 'code-review', 'math'. */
  domain: string;
  /** Evaluation sample size. */
  sampleSize: number;
  /** Pearson correlation: confidence vs. accuracy. */
  calibrationCorrelation: number;
  /** Over/underconfidence rates. */
  overconfidenceRate: number;
  underconfidenceRate: number;
}

interface KnownLimitation {
  /** Description. */
  description: string;
  /** 'critical' blocks; 'warning' permits with caution. */
  severity: 'critical' | 'warning' | 'informational';
  /** Mitigation strategy. */
  mitigation: string;
}

interface CapabilityBoundary {
  /** Task type or domain. */
  taskType: string;
  /** Max autonomous complexity. */
  maxAutonomousComplexity: number;
  /** Min confidence for unsupervised attempt. */
  minConfidenceThreshold: number;
  /** Beyond boundary: 'escalate', 'cautious-attempt', 'refuse'. */
  beyondBoundaryAction: 'escalate' | 'cautious-attempt' | 'refuse';
}
```

The `supersedesAssessmentId` chain creates an immutable history of self-perception evolution, critical for detecting capability drift or degradation.

#### 14.2.3 MetaCognitiveMonitor — Running Self-Observer

MetaCognitiveMonitor continuously observes an agent's cognitive state, detecting stuck states, recognizing opportunity patterns, and monitoring load. Connects to `Workstream` (Chapter 8) and `Task` (Chapter 5).

```typescript
interface MetaCognitiveMonitor {
  /** Unique identifier. */
  id: UUID;
  /** Monitored agent. */
  agentId: UUID;
  /** Current load assessment. */
  cognitiveLoad: CognitiveLoadReading;
  /** Active stuck-state detections. */
  stuckStateDetections: StuckStateDetection[];
  /** Recognized opportunities. */
  opportunityRecognitions: OpportunityRecognition[];
  /** Intervention thresholds. */
  interventionThresholds: InterventionThresholds;
  /** 'active', 'paused', 'diagnostic'. */
  status: 'active' | 'paused' | 'diagnostic';
  /** Last observation cycle. */
  lastObservationAt: Timestamp;
  /** Cumulative interventions. */
  totalInterventionsTriggered: number;
}

interface CognitiveLoadReading {
  /** 0.0 (idle) to 1.0 (overloaded). */
  loadScore: number;
  /** Active workstream count. */
  activeWorkstreamCount: number;
  /** Task switches per minute. */
  switchingRate: number;
  /** Stored items / capacity limit. */
  memoryUtilization: number;
  /** Milliseconds since last completion. */
  timeSinceLastCompletion: number;
}

interface StuckStateDetection {
  /** Stuck task/chain ID. */
  targetId: UUID;
  /** 'retry-loop', 'no-progress', 'circular-reasoning', 'resource-starved'. */
  stuckType: 'retry-loop' | 'no-progress' | 'circular-reasoning' | 'resource-starved';
  /** Detection time. */
  detectedAt: Timestamp;
  /** Failed attempts since. */
  failureCount: number;
  /** Intervention fired. */
  interventionTriggered: boolean;
}

interface OpportunityRecognition {
  /** Description. */
  description: string;
  /** Relevant past chain/memory IDs. */
  relevantPrecedentIds: UUID[];
  /** Match confidence: 0.0 to 1.0. */
  matchConfidence: number;
  /** Related current task IDs. */
  relatedCurrentTaskIds: UUID[];
  /** Recognition time. */
  recognizedAt: Timestamp;
}

interface InterventionThresholds {
  /** Load triggering shedding. */
  maxCognitiveLoad: number;
  /** Failures before stuck intervention. */
  stuckStateFailureThreshold: number;
  /** Min confidence for suggestions. */
  opportunityMatchThreshold: number;
  /** Max idle before health check. */
  maxIdleTimeMs: number;
}
```

The `stuckType` discriminant enables targeted responses — `retry-loop` varies strategy, `circular-reasoning` backtracks, `resource-starved` requests tools. Observations produce `Event` records (Chapter 10) for auditability.

### 14.3 Extension Model & Platform Configuration

#### 14.3.1 Extension — Functional Augmentation Package

Extension packages added functionality — data shapes, tools, UI components — as a deployable unit with a manifest. Connects to `SchemaRef` via contributed schemas and `Permission` (Chapter 13) via declared requirements.

```typescript
interface Extension {
  /** Unique identifier. */
  id: UUID;
  /** Name: 'PostgreSQL Agent Tools'. */
  name: string;
  /** Semantic version. */
  version: string;
  /** Publisher namespace. */
  publisherNamespace: string;
  /** Description. */
  description: string;
  /** ExtensionPoint hooks. */
  extensionPoints: ExtensionPointBinding[];
  /** Contributed data shapes. */
  contributedSchemas: SchemaRef[];
  /** Required permissions. */
  requiredPermissions: string[];
  /** Extension dependencies. */
  dependencies: ExtensionDependency[];
  /** 'full' (sandboxed), 'restricted', 'trusted'. */
  isolationLevel: 'full' | 'restricted' | 'trusted';
  /** Lifecycle state. */
  lifecycleState: 'registered' | 'loading' | 'active' | 'pausing' | 'paused' | 'unloading' | 'error';
  /** Registration time. */
  registeredAt: Timestamp;
  /** Last activation. */
  lastActivatedAt?: Timestamp;
  /** Configuration values. */
  configuration: Record<string, TypedValue>;
}

interface ExtensionPointBinding {
  /** Hooked ExtensionPoint ID. */
  extensionPointId: UUID;
  /** Handler function. */
  handlerName: string;
  /** Priority — lower executes first. */
  priority: number;
  /** Required (blocks activation on failure) or optional. */
  required: boolean;
}

interface ExtensionDependency {
  /** Required extension namespace. */
  namespace: string;
  /** Minimum version. */
  minVersion: string;
  /** Required or optional. */
  optional: boolean;
}
```

`isolationLevel` is the security boundary — `full` sandboxes with mediated access, `trusted` grants full access for audited code. `configuration` uses `TypedValue` to preserve runtime type information. Lifecycle transitions emit `DomainEvent` records (Chapter 12).

#### 14.3.2 ExtensionPoint — Platform Injection Interface

ExtensionPoint defines where extensions inject behavior. Every subsystem exposes these — conversation pre-processing, task scheduling, artifact handling — each declaring contract, invocation semantics, and isolation guarantees.

```typescript
interface ExtensionPoint {
  /** Unique identifier. */
  id: UUID;
  /** Name: 'message.pre-process', 'task.schedule'. */
  name: string;
  /** Owning subsystem. */
  subsystem: string;
  /** Handler parameter type. */
  parameterSchema: SchemaRef;
  /** Expected return type. */
  returnSchema?: SchemaRef;
  /** 'sequential', 'parallel', 'first-wins', 'voting'. */
  invocationMode: 'sequential' | 'parallel' | 'first-wins' | 'voting';
  /** 'before', 'after', 'around', 'on-error', 'continuous'. */
  lifecyclePhase: 'before' | 'after' | 'around' | 'on-error' | 'continuous';
  /** 'read-only', 'mutable', 'replaceable'. */
  mutationPolicy: 'read-only' | 'mutable' | 'replaceable';
  /** Max handler execution time. */
  timeoutMs: number;
  /** 'stop', 'continue', 'fallback' on failure. */
  errorPolicy: 'stop' | 'continue' | 'fallback';
  /** Registered handler IDs. */
  registeredHandlers: UUID[];
  /** Handler limit. */
  maxHandlers: number;
  /** 'stable', 'experimental', 'deprecated'. */
  stability: 'stable' | 'experimental' | 'deprecated';
  /** Definition time. */
  definedAt: Timestamp;
}
```

`invocationMode` determines multi-handler interaction: `sequential` chains, `parallel` merges, `first-wins` enables fallback, `voting` aggregates. `mutationPolicy` controls safety — `read-only` for observers, `mutable` for transformers, `replaceable` for substitution. `errorPolicy` defines resilience: `stop` for strict consistency, `continue` for availability, `fallback` for defaults.

#### 14.3.3 FeatureFlag — Toggleable Behavior Control

FeatureFlag controls conditional feature availability across scopes — boolean toggles, percentage rollouts, scoped enablement, scheduled windows, and full audit trail.

```typescript
interface FeatureFlag {
  /** Unique identifier. */
  id: UUID;
  /** Name: 'new-code-interpreter'. */
  name: string;
  /** Description. */
  description: string;
  /** 'boolean', 'percentage', 'scoped', 'schedule'. */
  rolloutType: 'boolean' | 'percentage' | 'scoped' | 'schedule';
  /** Global on/off. */
  enabled?: boolean;
  /** Exposure rate: 0.0 to 1.0. */
  exposurePercent?: number;
  /** Per-scope rules. */
  scopeRules?: ScopeRule[];
  /** Time-based windows. */
  scheduleRules?: ScheduleRule[];
  /** Controlled extension ID. */
  targetExtensionId?: UUID;
  /** Targeted subsystem IDs. */
  targetSubsystemIds?: string[];
  /** 'any-true', 'all-true', 'priority'. */
  evaluationStrategy: 'any-true' | 'all-true' | 'priority';
  /** Default when no rule matches. */
  defaultValue: boolean;
  /** Modification history. */
  changeHistory: FlagChangeRecord[];
  /** 'draft', 'active', 'graduating', 'deprecated', 'retired'. */
  flagState: 'draft' | 'active' | 'graduating' | 'deprecated' | 'retired';
  /** Creation time. */
  createdAt: Timestamp;
  /** Last modification. */
  updatedAt: Timestamp;
  /** Creator ID. */
  createdBy: UUID;
}

interface ScopeRule {
  /** 'global', 'workspace', 'user', 'agent', 'extension'. */
  scopeType: 'global' | 'workspace' | 'user' | 'agent' | 'extension';
  /** Entity ID or '*' for all. */
  scopeId: string;
  /** 'include' or 'exclude'. */
  action: 'include' | 'exclude';
  /** Conflict priority. */
  priority: number;
}

interface ScheduleRule {
  /** Window start. */
  startAt: Timestamp;
  /** Window end; null for indefinite. */
  endAt?: Timestamp;
  /** Timezone. */
  timezone: string;
  /** 'once', 'daily', 'weekly'. */
  recurrence?: 'once' | 'daily' | 'weekly';
}

interface FlagChangeRecord {
  /** Change time. */
  changedAt: Timestamp;
  /** Who changed it. */
  changedBy: UUID;
  /** Modified field. */
  fieldChanged: string;
  /** Previous and new values. */
  previousValue: string;
  newValue: string;
  /** Reason. */
  changeReason: string;
}
```

`evaluationStrategy` resolves overlapping rules — `priority` uses precedence, `any-true` is permissive, `all-true` restrictive. `FlagChangeRecord` provides compliance audit trails and enables rollback. The `flagState` lifecycle (`draft` → `active` → `graduating` → `deprecated` → `retired`) prevents accumulation and signals stability to extension developers.
