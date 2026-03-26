//! WebGPU bindings for wasm32-emscripten (emdawnwebgpu).
//!
//! Defines Zig structs with snake_case field names that are ABI-compatible
//! with emdawnwebgpu's webgpu.h C structs (same types, same order).
//! Method wrappers call the C functions via @ptrCast.

const std = @import("std");

pub const c = @cImport({
    @cInclude("webgpu/webgpu.h");
});

// ════════════════════════════════════════════════════════════════════════
// Scalar types and flags
// ════════════════════════════════════════════════════════════════════════

pub const WGPUBool = c.WGPUBool;
pub const WGPUFlags = u64;

// Zig enums backed by c_uint — enables enum literal syntax (.clear, .vertex, etc.)
// while staying ABI-compatible with the C header's integer types.

pub const TextureFormat = enum(c_uint) {
    @"undefined" = c.WGPUTextureFormat_Undefined,
    bgra8_unorm = c.WGPUTextureFormat_BGRA8Unorm,
    bgra8_unorm_srgb = c.WGPUTextureFormat_BGRA8UnormSrgb,
    rgba8_unorm = c.WGPUTextureFormat_RGBA8Unorm,
    rgba8_unorm_srgb = c.WGPUTextureFormat_RGBA8UnormSrgb,
    depth24_plus = c.WGPUTextureFormat_Depth24Plus,
    depth32_float = c.WGPUTextureFormat_Depth32Float,
    r8_unorm = c.WGPUTextureFormat_R8Unorm,
    _,
};

pub const VertexFormat = enum(c_uint) {
    @"undefined" = 0,
    float32 = c.WGPUVertexFormat_Float32,
    float32x2 = c.WGPUVertexFormat_Float32x2,
    float32x3 = c.WGPUVertexFormat_Float32x3,
    float32x4 = c.WGPUVertexFormat_Float32x4,
    uint32 = c.WGPUVertexFormat_Uint32,
    _,
};

pub const VertexStepMode = enum(c_uint) {
    @"undefined" = c.WGPUVertexStepMode_Undefined,
    vertex = c.WGPUVertexStepMode_Vertex,
    instance = c.WGPUVertexStepMode_Instance,
    _,
};

pub const PrimitiveTopology = enum(c_uint) {
    @"undefined" = c.WGPUPrimitiveTopology_Undefined,
    point_list = c.WGPUPrimitiveTopology_PointList,
    line_list = c.WGPUPrimitiveTopology_LineList,
    line_strip = c.WGPUPrimitiveTopology_LineStrip,
    triangle_list = c.WGPUPrimitiveTopology_TriangleList,
    triangle_strip = c.WGPUPrimitiveTopology_TriangleStrip,
    _,
};

pub const IndexFormat = enum(c_uint) {
    @"undefined" = c.WGPUIndexFormat_Undefined,
    uint16 = c.WGPUIndexFormat_Uint16,
    uint32 = c.WGPUIndexFormat_Uint32,
    _,
};

pub const FrontFace = enum(c_uint) {
    @"undefined" = c.WGPUFrontFace_Undefined,
    ccw = c.WGPUFrontFace_CCW,
    cw = c.WGPUFrontFace_CW,
    _,
};

pub const CullMode = enum(c_uint) {
    @"undefined" = c.WGPUCullMode_Undefined,
    none = c.WGPUCullMode_None,
    front = c.WGPUCullMode_Front,
    back = c.WGPUCullMode_Back,
    _,
};

pub const CompareFunction = enum(c_uint) {
    @"undefined" = c.WGPUCompareFunction_Undefined,
    never = c.WGPUCompareFunction_Never,
    less = c.WGPUCompareFunction_Less,
    equal = c.WGPUCompareFunction_Equal,
    less_equal = c.WGPUCompareFunction_LessEqual,
    greater = c.WGPUCompareFunction_Greater,
    not_equal = c.WGPUCompareFunction_NotEqual,
    greater_equal = c.WGPUCompareFunction_GreaterEqual,
    always = c.WGPUCompareFunction_Always,
    _,
};

pub const StencilOperation = enum(c_uint) {
    @"undefined" = c.WGPUStencilOperation_Undefined,
    keep = c.WGPUStencilOperation_Keep,
    zero = c.WGPUStencilOperation_Zero,
    replace = c.WGPUStencilOperation_Replace,
    _,
};

pub const BlendOperation = enum(c_uint) {
    @"undefined" = c.WGPUBlendOperation_Undefined,
    add = c.WGPUBlendOperation_Add,
    subtract = c.WGPUBlendOperation_Subtract,
    reverse_subtract = c.WGPUBlendOperation_ReverseSubtract,
    min = c.WGPUBlendOperation_Min,
    max = c.WGPUBlendOperation_Max,
    _,
};

pub const BlendFactor = enum(c_uint) {
    @"undefined" = c.WGPUBlendFactor_Undefined,
    zero = c.WGPUBlendFactor_Zero,
    one = c.WGPUBlendFactor_One,
    src = c.WGPUBlendFactor_Src,
    one_minus_src = c.WGPUBlendFactor_OneMinusSrc,
    src_alpha = c.WGPUBlendFactor_SrcAlpha,
    one_minus_src_alpha = c.WGPUBlendFactor_OneMinusSrcAlpha,
    dst = c.WGPUBlendFactor_Dst,
    one_minus_dst = c.WGPUBlendFactor_OneMinusDst,
    dst_alpha = c.WGPUBlendFactor_DstAlpha,
    one_minus_dst_alpha = c.WGPUBlendFactor_OneMinusDstAlpha,
    _,
};

pub const LoadOp = enum(c_uint) {
    @"undefined" = c.WGPULoadOp_Undefined,
    clear = c.WGPULoadOp_Clear,
    load = c.WGPULoadOp_Load,
    _,
};

pub const StoreOp = enum(c_uint) {
    @"undefined" = c.WGPUStoreOp_Undefined,
    store = c.WGPUStoreOp_Store,
    discard = c.WGPUStoreOp_Discard,
    _,
};

pub const AddressMode = enum(c_uint) {
    @"undefined" = c.WGPUAddressMode_Undefined,
    clamp_to_edge = c.WGPUAddressMode_ClampToEdge,
    repeat = c.WGPUAddressMode_Repeat,
    mirror_repeat = c.WGPUAddressMode_MirrorRepeat,
    _,
};

pub const FilterMode = enum(c_uint) {
    @"undefined" = c.WGPUFilterMode_Undefined,
    nearest = c.WGPUFilterMode_Nearest,
    linear = c.WGPUFilterMode_Linear,
    _,
};

pub const MipmapFilterMode = enum(c_uint) {
    @"undefined" = c.WGPUMipmapFilterMode_Undefined,
    nearest = c.WGPUMipmapFilterMode_Nearest,
    linear = c.WGPUMipmapFilterMode_Linear,
    _,
};

pub const TextureDimension = enum(c_uint) {
    @"undefined" = c.WGPUTextureDimension_Undefined,
    @"1d" = c.WGPUTextureDimension_1D,
    @"2d" = c.WGPUTextureDimension_2D,
    @"3d" = c.WGPUTextureDimension_3D,
    _,
};

pub const TextureViewDimension = enum(c_uint) {
    @"undefined" = c.WGPUTextureViewDimension_Undefined,
    @"1d" = c.WGPUTextureViewDimension_1D,
    @"2d" = c.WGPUTextureViewDimension_2D,
    @"2d_array" = c.WGPUTextureViewDimension_2DArray,
    cube = c.WGPUTextureViewDimension_Cube,
    cube_array = c.WGPUTextureViewDimension_CubeArray,
    @"3d" = c.WGPUTextureViewDimension_3D,
    _,
};

pub const TextureAspect = enum(c_uint) {
    @"undefined" = c.WGPUTextureAspect_Undefined,
    all = c.WGPUTextureAspect_All,
    stencil_only = c.WGPUTextureAspect_StencilOnly,
    depth_only = c.WGPUTextureAspect_DepthOnly,
    _,
};

pub const TextureSampleType = enum(c_uint) {
    binding_not_used = 0,
    @"undefined" = c.WGPUTextureSampleType_Undefined,
    float = c.WGPUTextureSampleType_Float,
    unfilterable_float = c.WGPUTextureSampleType_UnfilterableFloat,
    depth = c.WGPUTextureSampleType_Depth,
    sint = c.WGPUTextureSampleType_Sint,
    uint = c.WGPUTextureSampleType_Uint,
    _,
};

pub const StorageTextureAccess = enum(c_uint) {
    binding_not_used = 0,
    @"undefined" = c.WGPUStorageTextureAccess_Undefined,
    write_only = c.WGPUStorageTextureAccess_WriteOnly,
    read_only = c.WGPUStorageTextureAccess_ReadOnly,
    read_write = c.WGPUStorageTextureAccess_ReadWrite,
    _,
};

pub const SamplerBindingType = enum(c_uint) {
    binding_not_used = 0,
    @"undefined" = c.WGPUSamplerBindingType_Undefined,
    filtering = c.WGPUSamplerBindingType_Filtering,
    non_filtering = c.WGPUSamplerBindingType_NonFiltering,
    comparison = c.WGPUSamplerBindingType_Comparison,
    _,
};

pub const BufferBindingType = enum(c_uint) {
    binding_not_used = c.WGPUBufferBindingType_BindingNotUsed,
    @"undefined" = c.WGPUBufferBindingType_Undefined,
    uniform = c.WGPUBufferBindingType_Uniform,
    storage = c.WGPUBufferBindingType_Storage,
    read_only_storage = c.WGPUBufferBindingType_ReadOnlyStorage,
    _,
};

pub const OptionalBool = enum(c_uint) {
    @"undefined" = c.WGPUOptionalBool_Undefined,
    @"false" = c.WGPUOptionalBool_False,
    @"true" = c.WGPUOptionalBool_True,
    _,
};

pub const PresentMode = enum(c_uint) {
    fifo = c.WGPUPresentMode_Fifo,
    fifo_relaxed = c.WGPUPresentMode_FifoRelaxed,
    immediate = c.WGPUPresentMode_Immediate,
    mailbox = c.WGPUPresentMode_Mailbox,
    _,
};

pub const CompositeAlphaMode = enum(c_uint) {
    auto = c.WGPUCompositeAlphaMode_Auto,
    @"opaque" = c.WGPUCompositeAlphaMode_Opaque,
    premultiplied = c.WGPUCompositeAlphaMode_Premultiplied,
    unpremultiplied = c.WGPUCompositeAlphaMode_Unpremultiplied,
    inherit = c.WGPUCompositeAlphaMode_Inherit,
    _,
};

pub const MapAsyncStatus = enum(c_uint) {
    success = c.WGPUMapAsyncStatus_Success,
    instance_dropped = c.WGPUMapAsyncStatus_InstanceDropped,
    @"error" = c.WGPUMapAsyncStatus_Error,
    aborted = c.WGPUMapAsyncStatus_Aborted,
    _,
};

pub const PowerPreference = enum(c_uint) {
    @"undefined" = c.WGPUPowerPreference_Undefined,
    low_power = c.WGPUPowerPreference_LowPower,
    high_performance = c.WGPUPowerPreference_HighPerformance,
    _,
};

pub const Status = c.WGPUStatus;

pub const SurfaceGetCurrentTextureStatus = enum(c_uint) {
    success_optimal = c.WGPUSurfaceGetCurrentTextureStatus_SuccessOptimal,
    success_suboptimal = c.WGPUSurfaceGetCurrentTextureStatus_SuccessSuboptimal,
    timeout = c.WGPUSurfaceGetCurrentTextureStatus_Timeout,
    outdated = c.WGPUSurfaceGetCurrentTextureStatus_Outdated,
    lost = c.WGPUSurfaceGetCurrentTextureStatus_Lost,
    @"error" = c.WGPUSurfaceGetCurrentTextureStatus_Error,
    _,
};

pub const RequestAdapterStatus = c.WGPURequestAdapterStatus;
pub const RequestDeviceStatus = c.WGPURequestDeviceStatus;

pub const BufferUsage = WGPUFlags;
pub const BufferUsages = struct {
    pub const none: BufferUsage = c.WGPUBufferUsage_None;
    pub const map_read: BufferUsage = c.WGPUBufferUsage_MapRead;
    pub const map_write: BufferUsage = c.WGPUBufferUsage_MapWrite;
    pub const copy_src: BufferUsage = c.WGPUBufferUsage_CopySrc;
    pub const copy_dst: BufferUsage = c.WGPUBufferUsage_CopyDst;
    pub const index: BufferUsage = c.WGPUBufferUsage_Index;
    pub const vertex: BufferUsage = c.WGPUBufferUsage_Vertex;
    pub const uniform: BufferUsage = c.WGPUBufferUsage_Uniform;
    pub const storage: BufferUsage = c.WGPUBufferUsage_Storage;
    pub const indirect: BufferUsage = c.WGPUBufferUsage_Indirect;
    pub const query_resolve: BufferUsage = c.WGPUBufferUsage_QueryResolve;
};

pub const TextureUsage = WGPUFlags;
pub const TextureUsages = struct {
    pub const none: TextureUsage = c.WGPUTextureUsage_None;
    pub const copy_src: TextureUsage = c.WGPUTextureUsage_CopySrc;
    pub const copy_dst: TextureUsage = c.WGPUTextureUsage_CopyDst;
    pub const texture_binding: TextureUsage = c.WGPUTextureUsage_TextureBinding;
    pub const storage_binding: TextureUsage = c.WGPUTextureUsage_StorageBinding;
    pub const render_attachment: TextureUsage = c.WGPUTextureUsage_RenderAttachment;
};

pub const MapMode = WGPUFlags;
pub const MapModes = struct {
    pub const none: MapMode = c.WGPUMapMode_None;
    pub const read: MapMode = c.WGPUMapMode_Read;
    pub const write: MapMode = c.WGPUMapMode_Write;
};

pub const ShaderStage = WGPUFlags;
pub const ShaderStages = struct {
    pub const none: ShaderStage = c.WGPUShaderStage_None;
    pub const vertex: ShaderStage = c.WGPUShaderStage_Vertex;
    pub const fragment: ShaderStage = c.WGPUShaderStage_Fragment;
    pub const compute: ShaderStage = c.WGPUShaderStage_Compute;
};

pub const ColorWriteMask = WGPUFlags;
pub const ColorWriteMasks = struct {
    pub const none: ColorWriteMask = c.WGPUColorWriteMask_None;
    pub const red: ColorWriteMask = c.WGPUColorWriteMask_Red;
    pub const green: ColorWriteMask = c.WGPUColorWriteMask_Green;
    pub const blue: ColorWriteMask = c.WGPUColorWriteMask_Blue;
    pub const alpha: ColorWriteMask = c.WGPUColorWriteMask_Alpha;
    pub const all: ColorWriteMask = c.WGPUColorWriteMask_All;
};

pub const BufferMapCallback = *const fn (MapAsyncStatus, StringView, ?*anyopaque, ?*anyopaque) callconv(.c) void;

// ════════════════════════════════════════════════════════════════════════
// StringView — with fromSlice method matching wgpu_native_zig API
// ════════════════════════════════════════════════════════════════════════

pub const StringView = extern struct {
    data: ?[*]const u8 = null,
    length: usize = 0,

    pub fn fromSlice(slice: []const u8) StringView {
        return .{ .data = slice.ptr, .length = slice.len };
    }

    pub fn toSlice(self: StringView) ?[]const u8 {
        const d = self.data orelse return null;
        return d[0..self.length];
    }
};

// ════════════════════════════════════════════════════════════════════════
// ChainedStruct
// ════════════════════════════════════════════════════════════════════════

pub const ChainedStruct = extern struct {
    next: ?*const ChainedStruct = null,
    s_type: u32 = 0,
};

// ════════════════════════════════════════════════════════════════════════
// Descriptor structs — snake_case, ABI-compatible with C (extern struct)
// ════════════════════════════════════════════════════════════════════════

pub const Color = extern struct { r: f64 = 0, g: f64 = 0, b: f64 = 0, a: f64 = 0 };

pub const Extent3D = extern struct {
    width: u32 = 0,
    height: u32 = 1,
    depth_or_array_layers: u32 = 1,
};

pub const Origin3D = extern struct { x: u32 = 0, y: u32 = 0, z: u32 = 0 };

pub const BufferDescriptor = extern struct {
    next_in_chain: ?*anyopaque = null,
    label: StringView = .{},
    usage: BufferUsage = 0,
    size: u64 = 0,
    mapped_at_creation: WGPUBool = 0,
};

pub const BufferBindingLayout = extern struct {
    next_in_chain: ?*anyopaque = null,
    @"type": BufferBindingType = .binding_not_used,
    has_dynamic_offset: WGPUBool = 0,
    min_binding_size: u64 = 0,
};

pub const SamplerBindingLayout = extern struct {
    next_in_chain: ?*anyopaque = null,
    @"type": SamplerBindingType = .binding_not_used,
};

pub const TextureBindingLayout = extern struct {
    next_in_chain: ?*anyopaque = null,
    sample_type: TextureSampleType = .binding_not_used,
    view_dimension: TextureViewDimension = .@"undefined",
    multisampled: WGPUBool = 0,
};

pub const StorageTextureBindingLayout = extern struct {
    next_in_chain: ?*anyopaque = null,
    access: StorageTextureAccess = .binding_not_used,
    format: TextureFormat = .@"undefined",
    view_dimension: TextureViewDimension = .@"undefined",
};

pub const VertexAttribute = extern struct {
    next_in_chain: ?*anyopaque = null,
    format: VertexFormat = .@"undefined",
    offset: u64 = 0,
    shader_location: u32 = 0,
};

pub const VertexBufferLayout = extern struct {
    next_in_chain: ?*anyopaque = null,
    step_mode: VertexStepMode = .vertex,
    array_stride: u64 = 0,
    attribute_count: usize = 0,
    attributes: ?[*]const VertexAttribute = null,
};

pub const BlendComponent = extern struct {
    operation: BlendOperation = .add,
    src_factor: BlendFactor = .one,
    dst_factor: BlendFactor = .zero,

    pub const over = BlendComponent{
        .operation = .add,
        .src_factor = .one,
        .dst_factor = .one_minus_src_alpha,
    };
};

pub const BlendState = extern struct {
    color: BlendComponent = .{},
    alpha: BlendComponent = .{},

    pub const premultiplied_alpha_blending = BlendState{
        .color = BlendComponent.over,
        .alpha = BlendComponent.over,
    };
};

pub const ColorTargetState = extern struct {
    next_in_chain: ?*anyopaque = null,
    format: TextureFormat = .@"undefined",
    blend: ?*const BlendState = null,
    write_mask: ColorWriteMask = c.WGPUColorWriteMask_All, // flags, not enum — c_int is fine
};

pub const StencilFaceState = extern struct {
    compare: CompareFunction = .always,
    fail_op: StencilOperation = .keep,
    depth_fail_op: StencilOperation = .keep,
    pass_op: StencilOperation = .keep,
};

pub const DepthStencilState = extern struct {
    next_in_chain: ?*anyopaque = null,
    format: TextureFormat = .@"undefined",
    depth_write_enabled: OptionalBool = .@"undefined",
    depth_compare: CompareFunction = .@"undefined",
    stencil_front: StencilFaceState = .{},
    stencil_back: StencilFaceState = .{},
    stencil_read_mask: u32 = 0xFFFFFFFF,
    stencil_write_mask: u32 = 0xFFFFFFFF,
    depth_bias: i32 = 0,
    depth_bias_slope_scale: f32 = 0,
    depth_bias_clamp: f32 = 0,
};

pub const PrimitiveState = extern struct {
    next_in_chain: ?*anyopaque = null,
    topology: PrimitiveTopology = .triangle_list,
    strip_index_format: IndexFormat = .@"undefined",
    front_face: FrontFace = .ccw,
    cull_mode: CullMode = .none,
    unclipped_depth: WGPUBool = 0,
};

pub const MultisampleState = extern struct {
    next_in_chain: ?*anyopaque = null,
    count: u32 = 1,
    mask: u32 = 0xFFFFFFFF,
    alpha_to_coverage_enabled: WGPUBool = 0,
};

pub const VertexState = extern struct {
    next_in_chain: ?*anyopaque = null,
    module: ?*ShaderModule = null,
    entry_point: StringView = .{},
    constant_count: usize = 0,
    constants: ?*const anyopaque = null,
    buffer_count: usize = 0,
    buffers: ?[*]const VertexBufferLayout = null,
};

pub const FragmentState = extern struct {
    next_in_chain: ?*anyopaque = null,
    module: ?*ShaderModule = null,
    entry_point: StringView = .{},
    constant_count: usize = 0,
    constants: ?*const anyopaque = null,
    target_count: usize = 0,
    targets: ?[*]const ColorTargetState = null,
};

pub const RenderPipelineDescriptor = extern struct {
    next_in_chain: ?*anyopaque = null,
    label: StringView = .{},
    layout: ?*PipelineLayout = null,
    vertex: VertexState = .{},
    primitive: PrimitiveState = .{},
    depth_stencil: ?*const DepthStencilState = null,
    multisample: MultisampleState = .{},
    fragment: ?*const FragmentState = null,
};

pub const PipelineLayoutDescriptor = extern struct {
    next_in_chain: ?*anyopaque = null,
    label: StringView = .{},
    bind_group_layout_count: usize = 0,
    bind_group_layouts: ?[*]const *BindGroupLayout = null,
    immediate_size: u32 = 0,
};

pub const BindGroupEntry = extern struct {
    next_in_chain: ?*anyopaque = null,
    binding: u32 = 0,
    buffer: ?*Buffer = null,
    offset: u64 = 0,
    size: u64 = 0,
    sampler: ?*Sampler = null,
    texture_view: ?*TextureView = null,
};

pub const BindGroupDescriptor = extern struct {
    next_in_chain: ?*anyopaque = null,
    label: StringView = .{},
    layout: ?*BindGroupLayout = null,
    entry_count: usize = 0,
    entries: ?[*]const BindGroupEntry = null,
};

pub const BindGroupLayoutEntry = extern struct {
    next_in_chain: ?*anyopaque = null,
    binding: u32 = 0,
    visibility: ShaderStage = 0,
    binding_array_size: u32 = 0,
    buffer: BufferBindingLayout = .{},
    sampler: SamplerBindingLayout = .{},
    texture: TextureBindingLayout = .{},
    storage_texture: StorageTextureBindingLayout = .{},
};

pub const BindGroupLayoutDescriptor = extern struct {
    next_in_chain: ?*anyopaque = null,
    label: StringView = .{},
    entry_count: usize = 0,
    entries: ?[*]const BindGroupLayoutEntry = null,
};

pub const CommandEncoderDescriptor = extern struct {
    next_in_chain: ?*anyopaque = null,
    label: StringView = .{},
};

pub const ShaderModuleDescriptor = extern struct {
    next_in_chain: ?*const anyopaque = null,
    label: StringView = .{},
};

pub const ColorAttachment = extern struct {
    next_in_chain: ?*anyopaque = null,
    view: ?*TextureView = null,
    depth_slice: u32 = 0xFFFFFFFF,
    resolve_target: ?*TextureView = null,
    load_op: LoadOp = .clear,
    store_op: StoreOp = .store,
    clear_value: Color = .{},
};

pub const DepthStencilAttachment = extern struct {
    next_in_chain: ?*anyopaque = null,
    view: ?*TextureView = null,
    depth_load_op: LoadOp = .@"undefined",
    depth_store_op: StoreOp = .@"undefined",
    depth_clear_value: f32 = 0,
    depth_read_only: WGPUBool = 0,
    stencil_load_op: LoadOp = .@"undefined",
    stencil_store_op: StoreOp = .@"undefined",
    stencil_clear_value: u32 = 0,
    stencil_read_only: WGPUBool = 0,
};

pub const RenderPassDescriptor = extern struct {
    next_in_chain: ?*anyopaque = null,
    label: StringView = .{},
    color_attachment_count: usize = 0,
    color_attachments: ?[*]const ColorAttachment = null,
    depth_stencil_attachment: ?*const DepthStencilAttachment = null,
    occlusion_query_set: ?*anyopaque = null,
    timestamp_writes: ?*const anyopaque = null,
};

pub const SurfaceConfiguration = extern struct {
    next_in_chain: ?*anyopaque = null,
    device: ?*Device = null,
    format: TextureFormat = .@"undefined",
    usage: TextureUsage = c.WGPUTextureUsage_RenderAttachment,
    width: u32 = 0,
    height: u32 = 0,
    view_format_count: usize = 0,
    view_formats: ?[*]const TextureFormat = null,
    alpha_mode: CompositeAlphaMode = .auto,
    present_mode: PresentMode = .fifo,
};

pub const SurfaceCapabilities = extern struct {
    next_in_chain: ?*anyopaque = null,
    usages: TextureUsage = 0,
    format_count: usize = 0,
    formats: ?[*]const TextureFormat = null,
    present_mode_count: usize = 0,
    present_modes: ?[*]const PresentMode = null,
    alpha_mode_count: usize = 0,
    alpha_modes: ?[*]const CompositeAlphaMode = null,
};

pub const SurfaceTexture = extern struct {
    next_in_chain: ?*anyopaque = null,
    texture: ?*Texture = null,
    status: SurfaceGetCurrentTextureStatus = .@"error",
};

pub const SamplerDescriptor = extern struct {
    next_in_chain: ?*anyopaque = null,
    label: StringView = .{},
    address_mode_u: AddressMode = .clamp_to_edge,
    address_mode_v: AddressMode = .clamp_to_edge,
    address_mode_w: AddressMode = .clamp_to_edge,
    mag_filter: FilterMode = .nearest,
    min_filter: FilterMode = .nearest,
    mipmap_filter: MipmapFilterMode = .nearest,
    lod_min_clamp: f32 = 0,
    lod_max_clamp: f32 = 32,
    compare: CompareFunction = .@"undefined",
    max_anisotropy: u16 = 1,
};

pub const TextureDescriptor = extern struct {
    next_in_chain: ?*anyopaque = null,
    label: StringView = .{},
    usage: TextureUsage = 0,
    dimension: TextureDimension = .@"2d",
    size: Extent3D = .{},
    format: TextureFormat = .@"undefined",
    mip_level_count: u32 = 1,
    sample_count: u32 = 1,
    view_format_count: usize = 0,
    view_formats: ?[*]const TextureFormat = null,
};

pub const TextureViewDescriptor = extern struct {
    next_in_chain: ?*anyopaque = null,
    label: StringView = .{},
    format: TextureFormat = .@"undefined",
    dimension: TextureViewDimension = .@"undefined",
    base_mip_level: u32 = 0,
    mip_level_count: u32 = 0xFFFFFFFF,
    base_array_layer: u32 = 0,
    array_layer_count: u32 = 0xFFFFFFFF,
    aspect: TextureAspect = .all,
    usage: TextureUsage = 0,
};

pub const TexelCopyBufferLayout = extern struct {
    offset: u64 = 0,
    bytes_per_row: u32 = 0,
    rows_per_image: u32 = 0,
};

pub const TexelCopyBufferInfo = extern struct {
    layout: TexelCopyBufferLayout = .{},
    buffer: ?*Buffer = null,
};

pub const TexelCopyTextureInfo = extern struct {
    texture: ?*Texture = null,
    mip_level: u32 = 0,
    origin: Origin3D = .{},
    aspect: TextureAspect = .all,
};

pub const BufferMapCallbackInfo = extern struct {
    next_in_chain: ?*anyopaque = null,
    mode: u32 = 2, // allow_process_events
    callback: ?BufferMapCallback = null,
    userdata1: ?*anyopaque = null,
    userdata2: ?*anyopaque = null,
};

// ════════════════════════════════════════════════════════════════════════
// Helper: shader module WGSL descriptor
// ════════════════════════════════════════════════════════════════════════

pub const ShaderModuleWGSLMergedDescriptor = struct {
    label: []const u8 = "",
    code: []const u8,
};

pub const ShaderSourceWGSL = extern struct {
    chain: ChainedStruct = .{ .s_type = c.WGPUSType_ShaderSourceWGSL },
    code: StringView = .{},
};

pub inline fn shaderModuleWGSLDescriptor(
    descriptor: ShaderModuleWGSLMergedDescriptor,
) ShaderModuleDescriptor {
    return ShaderModuleDescriptor{
        .next_in_chain = @ptrCast(&ShaderSourceWGSL{
            .code = StringView.fromSlice(descriptor.code),
        }),
        .label = StringView.fromSlice(descriptor.label),
    };
}

// ════════════════════════════════════════════════════════════════════════
// Opaque handle types with method wrappers
// ════════════════════════════════════════════════════════════════════════

pub const Instance = opaque {
    pub fn create(desc: ?*const anyopaque) ?*Instance {
        return @ptrCast(c.wgpuCreateInstance(@alignCast(@ptrCast(desc))));
    }
    fn cptr(self: *Instance) c.WGPUInstance { return @ptrCast(self); }
    pub fn createSurface(self: *Instance, desc: anytype) ?*Surface {
        return @ptrCast(c.wgpuInstanceCreateSurface(self.cptr(), @ptrCast(desc)));
    }
    pub fn release(self: *Instance) void { c.wgpuInstanceRelease(self.cptr()); }
};

pub const Adapter = opaque {
    fn cptr(self: *Adapter) c.WGPUAdapter { return @ptrCast(self); }
    pub fn release(self: *Adapter) void { c.wgpuAdapterRelease(self.cptr()); }
};

pub const Device = opaque {
    fn cptr(self: *Device) c.WGPUDevice { return @ptrCast(self); }
    pub fn getQueue(self: *Device) ?*Queue { return @ptrCast(c.wgpuDeviceGetQueue(self.cptr())); }
    pub fn createBuffer(self: *Device, desc: *const BufferDescriptor) ?*Buffer {
        return @ptrCast(c.wgpuDeviceCreateBuffer(self.cptr(), @ptrCast(desc)));
    }
    pub fn createCommandEncoder(self: *Device, desc: *const CommandEncoderDescriptor) ?*CommandEncoder {
        return @ptrCast(c.wgpuDeviceCreateCommandEncoder(self.cptr(), @ptrCast(desc)));
    }
    pub fn createShaderModule(self: *Device, desc: *const ShaderModuleDescriptor) ?*ShaderModule {
        return @ptrCast(c.wgpuDeviceCreateShaderModule(self.cptr(), @ptrCast(desc)));
    }
    pub fn createRenderPipeline(self: *Device, desc: *const RenderPipelineDescriptor) ?*RenderPipeline {
        return @ptrCast(c.wgpuDeviceCreateRenderPipeline(self.cptr(), @ptrCast(desc)));
    }
    pub fn createPipelineLayout(self: *Device, desc: *const PipelineLayoutDescriptor) ?*PipelineLayout {
        return @ptrCast(c.wgpuDeviceCreatePipelineLayout(self.cptr(), @ptrCast(desc)));
    }
    pub fn createBindGroupLayout(self: *Device, desc: *const BindGroupLayoutDescriptor) ?*BindGroupLayout {
        return @ptrCast(c.wgpuDeviceCreateBindGroupLayout(self.cptr(), @ptrCast(desc)));
    }
    pub fn createBindGroup(self: *Device, desc: *const BindGroupDescriptor) ?*BindGroup {
        return @ptrCast(c.wgpuDeviceCreateBindGroup(self.cptr(), @ptrCast(desc)));
    }
    pub fn createTexture(self: *Device, desc: *const TextureDescriptor) ?*Texture {
        return @ptrCast(c.wgpuDeviceCreateTexture(self.cptr(), @ptrCast(desc)));
    }
    pub fn createSampler(self: *Device, desc: *const SamplerDescriptor) ?*Sampler {
        return @ptrCast(c.wgpuDeviceCreateSampler(self.cptr(), @ptrCast(desc)));
    }
    pub fn poll(self: *Device, wait: WGPUBool, index: ?*const anyopaque) WGPUBool {
        _ = self; _ = wait; _ = index; return 0; // no-op on web
    }
    pub fn release(self: *Device) void { c.wgpuDeviceRelease(self.cptr()); }
};

pub const Queue = opaque {
    fn cptr(self: *Queue) c.WGPUQueue { return @ptrCast(self); }
    pub fn submit(self: *Queue, commands: []const *CommandBuffer) void {
        c.wgpuQueueSubmit(self.cptr(), commands.len, @ptrCast(commands.ptr));
    }
    pub fn writeBuffer(self: *Queue, buffer: *Buffer, offset: u64, data: *const anyopaque, size: usize) void {
        c.wgpuQueueWriteBuffer(self.cptr(), @ptrCast(buffer), offset, data, size);
    }
    pub fn writeTexture(self: *Queue, dest: *const TexelCopyTextureInfo, data: *const anyopaque, size: usize, layout: *const TexelCopyBufferLayout, extent: *const Extent3D) void {
        c.wgpuQueueWriteTexture(self.cptr(), @ptrCast(dest), data, size, @ptrCast(layout), @ptrCast(extent));
    }
    pub fn release(self: *Queue) void { c.wgpuQueueRelease(self.cptr()); }
};

pub const Buffer = opaque {
    fn cptr(self: *Buffer) c.WGPUBuffer { return @ptrCast(self); }
    pub fn release(self: *Buffer) void { c.wgpuBufferRelease(self.cptr()); }
    pub fn mapAsync(self: *Buffer, mode: MapMode, offset: usize, size: usize, info: BufferMapCallbackInfo) c.WGPUFuture {
        _ = self; _ = mode; _ = offset; _ = size; _ = info;
        return .{ .id = 0 }; // needs ASYNCIFY
    }
    pub fn getConstMappedRange(self: *Buffer, offset: usize, size: usize) ?*const anyopaque {
        return c.wgpuBufferGetConstMappedRange(self.cptr(), offset, size);
    }
    pub fn unmap(self: *Buffer) void { c.wgpuBufferUnmap(self.cptr()); }
};

pub const Surface = opaque {
    fn cptr(self: *Surface) c.WGPUSurface { return @ptrCast(self); }
    pub fn getCurrentTexture(self: *Surface, texture: *SurfaceTexture) void {
        c.wgpuSurfaceGetCurrentTexture(self.cptr(), @ptrCast(texture));
    }
    pub fn configure(self: *Surface, config: *const SurfaceConfiguration) void {
        c.wgpuSurfaceConfigure(self.cptr(), @ptrCast(config));
    }
    pub fn getCapabilities(self: *Surface, adapter: *Adapter, caps: *SurfaceCapabilities) Status {
        return c.wgpuSurfaceGetCapabilities(self.cptr(), @ptrCast(adapter), @ptrCast(caps));
    }
    pub fn present(self: *Surface) Status { return c.wgpuSurfacePresent(self.cptr()); }
    pub fn release(self: *Surface) void { c.wgpuSurfaceRelease(self.cptr()); }
};

pub const Texture = opaque {
    fn cptr(self: *Texture) c.WGPUTexture { return @ptrCast(self); }
    pub fn createView(self: *Texture, desc: ?*const TextureViewDescriptor) ?*TextureView {
        return @ptrCast(c.wgpuTextureCreateView(self.cptr(), if (desc) |d| @ptrCast(d) else null));
    }
    pub fn destroy(self: *Texture) void { c.wgpuTextureDestroy(self.cptr()); }
    pub fn release(self: *Texture) void { c.wgpuTextureRelease(self.cptr()); }
};

pub const TextureView = opaque {
    fn cptr(self: *TextureView) c.WGPUTextureView { return @ptrCast(self); }
    pub fn release(self: *TextureView) void { c.wgpuTextureViewRelease(self.cptr()); }
};

pub const ShaderModule = opaque {
    fn cptr(self: *ShaderModule) c.WGPUShaderModule { return @ptrCast(self); }
    pub fn release(self: *ShaderModule) void { c.wgpuShaderModuleRelease(self.cptr()); }
};

pub const RenderPipeline = opaque {
    fn cptr(self: *RenderPipeline) c.WGPURenderPipeline { return @ptrCast(self); }
    pub fn release(self: *RenderPipeline) void { c.wgpuRenderPipelineRelease(self.cptr()); }
};

pub const PipelineLayout = opaque {
    fn cptr(self: *PipelineLayout) c.WGPUPipelineLayout { return @ptrCast(self); }
    pub fn release(self: *PipelineLayout) void { c.wgpuPipelineLayoutRelease(self.cptr()); }
};

pub const BindGroup = opaque {
    fn cptr(self: *BindGroup) c.WGPUBindGroup { return @ptrCast(self); }
    pub fn release(self: *BindGroup) void { c.wgpuBindGroupRelease(self.cptr()); }
};

pub const BindGroupLayout = opaque {
    fn cptr(self: *BindGroupLayout) c.WGPUBindGroupLayout { return @ptrCast(self); }
    pub fn release(self: *BindGroupLayout) void { c.wgpuBindGroupLayoutRelease(self.cptr()); }
};

pub const Sampler = opaque {
    fn cptr(self: *Sampler) c.WGPUSampler { return @ptrCast(self); }
    pub fn release(self: *Sampler) void { c.wgpuSamplerRelease(self.cptr()); }
};

pub const CommandEncoder = opaque {
    fn cptr(self: *CommandEncoder) c.WGPUCommandEncoder { return @ptrCast(self); }
    pub fn beginRenderPass(self: *CommandEncoder, desc: anytype) ?*RenderPassEncoder {
        return @ptrCast(c.wgpuCommandEncoderBeginRenderPass(self.cptr(), @ptrCast(desc)));
    }
    pub fn copyTextureToBuffer(self: *CommandEncoder, src: anytype, dst: anytype, size: anytype) void {
        c.wgpuCommandEncoderCopyTextureToBuffer(self.cptr(), @ptrCast(src), @ptrCast(dst), @ptrCast(size));
    }
    pub fn finish(self: *CommandEncoder, desc: ?*const anyopaque) ?*CommandBuffer {
        return @ptrCast(c.wgpuCommandEncoderFinish(self.cptr(), @alignCast(@ptrCast(desc))));
    }
    pub fn release(self: *CommandEncoder) void { c.wgpuCommandEncoderRelease(self.cptr()); }
};

pub const CommandBuffer = opaque {
    fn cptr(self: *CommandBuffer) c.WGPUCommandBuffer { return @ptrCast(self); }
    pub fn release(self: *CommandBuffer) void { c.wgpuCommandBufferRelease(self.cptr()); }
};

pub const RenderPassEncoder = opaque {
    fn cptr(self: *RenderPassEncoder) c.WGPURenderPassEncoder { return @ptrCast(self); }
    pub fn setPipeline(self: *RenderPassEncoder, pipeline: *RenderPipeline) void {
        c.wgpuRenderPassEncoderSetPipeline(self.cptr(), @ptrCast(pipeline));
    }
    pub fn setVertexBuffer(self: *RenderPassEncoder, slot: u32, buffer: *Buffer, offset: u64, size: u64) void {
        c.wgpuRenderPassEncoderSetVertexBuffer(self.cptr(), slot, @ptrCast(buffer), offset, size);
    }
    pub fn setBindGroup(self: *RenderPassEncoder, index: u32, group: *BindGroup, count: usize, offsets: ?[*]const u32) void {
        c.wgpuRenderPassEncoderSetBindGroup(self.cptr(), index, @ptrCast(group), count, offsets);
    }
    pub fn setScissorRect(self: *RenderPassEncoder, x: u32, y: u32, w: u32, h: u32) void {
        c.wgpuRenderPassEncoderSetScissorRect(self.cptr(), x, y, w, h);
    }
    pub fn draw(self: *RenderPassEncoder, vert: u32, inst: u32, first_vert: u32, first_inst: u32) void {
        c.wgpuRenderPassEncoderDraw(self.cptr(), vert, inst, first_vert, first_inst);
    }
    pub fn end(self: *RenderPassEncoder) void { c.wgpuRenderPassEncoderEnd(self.cptr()); }
    pub fn release(self: *RenderPassEncoder) void { c.wgpuRenderPassEncoderRelease(self.cptr()); }
};
