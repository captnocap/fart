// ============================================================================
// Module system types
// ============================================================================

export type PortType = 'audio' | 'control' | 'midi';
export type PortDirection = 'in' | 'out';
export type ParamType = 'float' | 'enum' | 'bool';

export interface PortDef {
  type: PortType;
  direction: PortDirection;
}

export interface FloatParamDef {
  type: 'float';
  min: number;
  max: number;
  default: number;
}

export interface EnumParamDef {
  type: 'enum';
  values: string[];
  default: string;
}

export interface BoolParamDef {
  type: 'bool';
  default: boolean;
}

export type ParamDef = FloatParamDef | EnumParamDef | BoolParamDef;

export interface ModuleState {
  id: string;
  type: string;
  params: Record<string, any>;
  ports: Record<string, { type: PortType; direction: PortDirection }>;
  activeNotes?: Record<string, { note: number; envelope: number }>;
}

// ============================================================================
// Connection types
// ============================================================================

export interface Connection {
  fromId: string;
  fromPort: string;
  toId: string;
  toPort: string;
  type: PortType;
}

// ============================================================================
// Rack state (full graph snapshot from Lua)
// ============================================================================

export interface RackState {
  modules: ModuleState[];
  connections: Connection[];
  midi: MIDIState;
}

// ============================================================================
// MIDI types
// ============================================================================

export interface MIDIDevice {
  id: string;
  name: string;
  connected: boolean;
}

export interface MIDIMapping {
  channel: number;
  cc: number;
  moduleId: string;
  param: string;
}

export interface MIDIState {
  available: boolean;
  devices: MIDIDevice[];
  mappings: MIDIMapping[];
  learning: { moduleId: string; param: string } | null;
}

export interface MIDINoteEvent {
  note: number;
  velocity: number;
  on: boolean;
  channel: number;
  device: string;
}

export interface MIDICCEvent {
  cc: number;
  value: number;
  channel: number;
  device: string;
}

// ============================================================================
// Hook return types
// ============================================================================

export interface UseModuleResult {
  id: string;
  type: string;
  params: Record<string, any>;
  ports: Record<string, { type: PortType; direction: PortDirection }>;
  activeNotes?: Record<string, { note: number; envelope: number }>;
  setParam: (name: string, value: any) => Promise<any>;
}

export interface UseRackResult {
  modules: ModuleState[];
  connections: Connection[];
  addModule: (type: string, id: string, params?: Record<string, any>) => Promise<any>;
  removeModule: (id: string) => Promise<any>;
  connect: (fromId: string, fromPort: string, toId: string, toPort: string) => Promise<any>;
  disconnect: (fromId: string, fromPort: string, toId: string, toPort: string) => Promise<any>;
}

export interface UseMIDIResult {
  available: boolean;
  devices: MIDIDevice[];
  mappings: MIDIMapping[];
  learning: { moduleId: string; param: string } | null;
  learn: (moduleId: string, param: string) => Promise<any>;
  map: (moduleId: string, param: string, channel: number, cc: number) => Promise<any>;
  unmap: (moduleId: string, param: string) => Promise<any>;
}
