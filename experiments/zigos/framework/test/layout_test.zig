const std = @import("std");
const testing = std.testing;
const layout = @import("../layout.zig");

fn mockMeasure(
    text: []const u8,
    font_size: u16,
    max_width: f32,
    letter_spacing: f32,
    line_height: f32,
    max_lines: u16,
    no_wrap: bool,
) layout.TextMetrics {
    _ = max_width;
    _ = letter_spacing;
    _ = line_height;
    _ = max_lines;
    _ = no_wrap;

    const width = @as(f32, @floatFromInt(text.len)) * 6;
    const height = @as(f32, @floatFromInt(font_size));
    return .{
        .width = width,
        .height = height,
        .ascent = height * 0.8,
    };
}

test "small centered text in a fixed-width box does not expand parent row height" {
    layout.setMeasureFn(mockMeasure);
    defer layout.setMeasureFn(null);

    var icon_text = [_]layout.Node{
        .{ .text = "+v", .font_size = 10 },
    };
    var gutter_slot = [_]layout.Node{
        .{
            .style = .{
                .width = 12,
                .align_items = .center,
                .justify_content = .center,
            },
            .children = &icon_text,
        },
    };
    var first_row_children = [_]layout.Node{
        .{
            .style = .{
                .width = 170,
                .flex_direction = .row,
                .align_items = .center,
            },
            .children = &gutter_slot,
        },
        .{ .text = "line 1", .font_size = 11 },
    };
    var second_row_children = [_]layout.Node{
        .{ .text = "line 2", .font_size = 11 },
    };
    var root_children = [_]layout.Node{
        .{
            .style = .{
                .flex_direction = .row,
            },
            .children = &first_row_children,
        },
        .{
            .style = .{
                .flex_direction = .row,
            },
            .children = &second_row_children,
        },
    };
    var root = layout.Node{
        .style = .{
            .flex_direction = .column,
            .gap = 1,
        },
        .children = &root_children,
    };

    layout.layout(&root, 0, 0, 220, 720);

    const first_row = &root.children[0];
    const second_row = &root.children[1];

    try testing.expectApproxEqAbs(@as(f32, 11), first_row.computed.h, 0.01);
    try testing.expectApproxEqAbs(@as(f32, 12), second_row.computed.y, 0.01);
    try testing.expectApproxEqAbs(@as(f32, 11), second_row.computed.h, 0.01);
}

test "centered auto-height fixed-width box shrink-wraps to its text" {
    layout.setMeasureFn(mockMeasure);
    defer layout.setMeasureFn(null);

    var icon_text = [_]layout.Node{
        .{ .text = "+v", .font_size = 10 },
    };
    var gutter_slot = [_]layout.Node{
        .{
            .style = .{
                .width = 12,
                .align_items = .center,
                .justify_content = .center,
            },
            .children = &icon_text,
        },
    };
    var leading_group = [_]layout.Node{
        .{
            .style = .{
                .width = 170,
                .flex_direction = .row,
                .align_items = .center,
            },
            .children = &gutter_slot,
        },
    };
    var root = layout.Node{
        .style = .{
            .flex_direction = .row,
        },
        .children = &leading_group,
    };

    layout.layout(&root, 0, 0, 220, 720);

    const centered_box = &root.children[0].children[0];
    const centered_text = &centered_box.children[0];

    try testing.expectApproxEqAbs(@as(f32, 10), centered_box.computed.h, 0.01);
    try testing.expectApproxEqAbs(centered_box.computed.y, centered_text.computed.y, 0.01);
}

test "empty centered fixed-width box stays shrink-wrapped" {
    layout.setMeasureFn(mockMeasure);
    defer layout.setMeasureFn(null);

    var gutter_slot = [_]layout.Node{
        .{
            .style = .{
                .width = 12,
                .align_items = .center,
                .justify_content = .center,
            },
        },
    };
    var first_row_children = [_]layout.Node{
        .{
            .style = .{
                .width = 170,
                .flex_direction = .row,
                .align_items = .center,
            },
            .children = &gutter_slot,
        },
        .{ .text = "line 1", .font_size = 11 },
    };
    var second_row_children = [_]layout.Node{
        .{ .text = "line 2", .font_size = 11 },
    };
    var root_children = [_]layout.Node{
        .{
            .style = .{
                .flex_direction = .row,
            },
            .children = &first_row_children,
        },
        .{
            .style = .{
                .flex_direction = .row,
            },
            .children = &second_row_children,
        },
    };
    var root = layout.Node{
        .style = .{
            .flex_direction = .column,
            .gap = 1,
        },
        .children = &root_children,
    };

    layout.layout(&root, 0, 0, 220, 720);

    try testing.expectApproxEqAbs(@as(f32, 11), root.children[0].computed.h, 0.01);
    try testing.expectApproxEqAbs(@as(f32, 12), root.children[1].computed.y, 0.01);
}
