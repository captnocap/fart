// @ilovereact/audio — Modular audio framework for iLoveReact
//
// Lua-side: lua/audio/ (engine, graph, modules, MIDI)
// React-side: hooks for rack management, module control, MIDI

export type {
  PortType,
  PortDirection,
  ParamType,
  PortDef,
  FloatParamDef,
  EnumParamDef,
  BoolParamDef,
  ParamDef,
  ModuleState,
  Connection,
  RackState,
  MIDIDevice,
  MIDIMapping,
  MIDIState,
  MIDINoteEvent,
  MIDICCEvent,
  UseModuleResult,
  UseRackResult,
  UseMIDIResult,
} from './types';

export {
  useRack,
  useModule,
  useParam,
  useMIDI,
  useMIDINote,
  useMIDICC,
  useAudioInit,
} from './hooks';
