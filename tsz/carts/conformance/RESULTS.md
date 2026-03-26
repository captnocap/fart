# CONFORMANCE TEST RESULTS — FORM CT-2026-B
# TSZ Compiler Verification Ledger
#
# Status codes:
#   [ ] = Untested
#   [P] = Pass — compiles, runs, renders correctly
#   [F] = Fail — does not compile or renders incorrectly
#   [S] = Skip — known limitation, not applicable
#
# Instructions: Mark each test after running its .so in the book.
# Claude reads this file to determine what needs fixing.
#
# !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
# STOP REBUILDING THE PASSING TESTS!!!!!!!!!!
# If a test is marked [P], DO NOT recompile it. It already works.
# Only build tests marked [F] or [ ]. Delete binaries after testing.
# rm zig-out/bin/d* after you are done.
# !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

## SECTION I — Integration Tests

- [P] 01_ecommerce_dashboard
- [P] 02_admin_sidebar
- [P] 03_jira_board

## SECTION II — Death Tests: Core Patterns (D01–D25)

- [P] d01_nested_maps
- [P] d02_component_returning_map
- [P] d03_conditional_wrapping_map
- [P] d04_map_handler_captures
- [P] d05_dynamic_style_in_map
- [P] d06_ternary_jsx_branches
- [P] d07_sibling_maps_shared_state
- [P] d08_map_classifier_components
- [P] d09_nested_template_scope
- [P] d10_handler_triple_capture
- [P] d11_map_component_map
- [P] d12_kanban_evil
- [P] d13_schema_form
- [P] d14_multiple_instances
- [P] d15_unmount_remount
- [P] d16_state_stress
- [P] d17_map_conditional_card
- [P] d18_array_mutation
- [P] d19_polymorphic_map
- [P] d20_multi_handler_map
- [P] d21_nested_object_access
- [P] d22_index_math
- [P] d23_empty_array
- [P] d24_chained_state
- [P] d25_map_conditional_classifier

## SECTION III — Death Tests: Script Runtimes (D26–D33)

- [P] d26a_timer_script
- [P] d26b_timer_zscript
- [P] d27a_array_methods_script
- [P] d27b_array_methods_zscript
- [P] d28a_string_ops_script
- [P] d28b_string_ops_zscript
- [P] d29a_json_parse_script
- [P] d29b_json_parse_zscript
- [P] d30a_math_derived_script
- [P] d30b_math_derived_zscript
- [P] d31a_state_machine_script
- [P] d31b_state_machine_zscript
- [P] d32_deep_nesting
- [P] d33_extreme_nesting

## SECTION IV — Death Tests: Language Features (D34–D60)

- [P] d34_switch_forof_while
- [P] d35_jsx_fragments
- [P] d36_nullish_bitwise
- [P] d37_destructuring
- [P] d38_arrow_default_params
- [P] d39_declare_function
- [P] d40_type_annotations
- [P] d41_multi_component_props
- [P] d42_export_import
- [P] d43_html_tags
- [P] d44_classifier_styles
- [P] d45_union_type_alias
- [P] d46_multiline_comments
- [P] d47_nested_ternary
- [P] d48_complex_template_literals
- [P] d49_string_state
- [P] d50_boolean_state
- [F] d51_computed_access
- [F] d52_multi_handler_state
- [P] d53_compound_conditionals
- [F] d54_util_functions
- [P] d55_deeply_nested_objects
- [P] d56_multiple_maps_nested
- [P] d57_children_prop
- [P] d58_dynamic_styles
- [P] d59_large_array
- [P] d60_component_reuse

## SECTION V — Death Tests: Advanced & Integration (D61–D80)

- [P] d61_map_ternary_branch
- [F] d62_negative_numbers
- [P] d63_empty_states
- [F] d64_multi_import
- [P] d65_component_8_props
- [P] d66_chained_calls
- [F] d67_conditional_in_map_component
- [P] d68_todo_app
- [P] d69_chat_ui
- [P] d70_strict_equality
- [P] d71_increment_decrement
- [P] d72_typeof_operator
- [P] d73_undefined_checks
- [P] d74_optional_chaining
- [P] d75_throw_try_catch
- [P] d76_new_expression
- [P] d77_do_while
- [P] d78_for_in
- [P] d79_shorthand_properties
- [P] d80_logical_assignment
- [P] d81_rest_spread_params

## SECTION V.5 — Death Tests: Stress & Integration (D82–D93)

- [P] d82_string_methods_chain
- [P] d83_array_methods
- [P] d84_nested_component_state
- [P] d85_math_heavy
- [P] d86_settings_page
- [ ] d87_kanban_lite
- [ ] d88_data_table
- [ ] d89_calculator
- [ ] d90_spreadsheet
- [ ] d91_file_explorer
- [ ] d92_state_machine_complex
- [ ] d93_dashboard_full

## SECTION V.6 — Death Tests: Graph & Surface Regressions

- [ ] d96_graph_map_expr_attrs

## SECTION V.7 — Death Tests: React Composition Patterns

- [ ] d97_jsx_prop_spread
- [ ] d98_callback_prop_chain
- [ ] d99_recursive_tree_component
- [ ] d100_named_slots
- [ ] d101_filter_sort_map_render

## SECTION VI — WPT Flex: Core Layout (01–30)

- [P] 01_flex_direction_row
- [P] 02_flex_direction_column
- [P] 03_justify_content
- [P] 04_align_items
- [P] 05_flex_grow
- [P] 06_flex_shrink
- [P] 07_flex_wrap
- [P] 08_gap
- [P] 09_align_self
- [P] 10_flex_basis
- [P] 11_padding_margin
- [P] 12_min_max_constraints
- [P] 13_nested_flex
- [P] 14_percentage_sizing
- [P] 15_grow_no_space
- [P] 16_content_sizing
- [P] 17_justify_single_item
- [P] 18_shrink_basis_interaction
- [P] 19_wrap_align_justify
- [P] 20_real_world_layouts
- [P] 21_zero_size_items
- [P] 22_column_justify
- [P] 23_deep_nesting
- [P] 24_overflow_clipping
- [P] 25_grow_shrink_column
- [P] 26_gap_with_justify
- [P] 27_many_items
- [P] 28_mixed_units
- [P] 29_full_page_layout
- [P] 30_align_stretch_sizing

## SECTION VII — WPT Flex: Visual & Box Model (31–60)

- [P] 31_padding_all_sides
- [P] 32_margin_collapse
- [P] 33_flex_basis_zero_vs_auto
- [P] 34_wrap_multiline_height
- [P] 35_complex_dashboard
- [P] 36_margin_auto
- [P] 37_absolute_in_flex
- [P] 38_flex_basis_content
- [P] 39_wrap_reverse
- [P] 40_order_property
- [P] 41_aspect_ratio
- [P] 42_shrink_min_width
- [P] 43_stretch_explicit_height
- [P] 44_grow_with_padding
- [P] 45_nested_percentage
- [P] 46_wrap_row_col_gap
- [P] 47_intrinsic_sizing
- [P] 48_border_box_flex
- [P] 49_mixed_fixed_grow
- [P] 50_column_wrap_height
- [P] 51_border_radius_all_corners
- [P] 52_opacity
- [P] 53_overflow_hidden
- [P] 54_z_index_stacking
- [P] 55_shadow
- [P] 56_transform
- [P] 57_gradient_backgrounds
- [P] 58_border_styles
- [P] 59_text_styling
- [P] 60_nested_scroll

## SECTION VIII — WPT Flex: Advanced & Stress (61–70)

- [P] 61_tw_layout
- [P] 62_tw_spacing
- [P] 63_tw_colors
- [P] 64_tw_sizing
- [P] 65_tw_typography
- [P] 66_align_content
- [P] 67_flex_shorthand
- [P] 68_aspect_ratio_flex
- [P] 69_min_max_content
- [P] 70_flex_interaction_stress

## SECTION IX — Surface Conformance: UI (s01–s15)
#
# Three tiers per test. Same pixels, three ways.
#   a = soup (real model output, zero framework knowledge)
#   b = mixed (today's framework, inline styles)
#   c = chad (classifiers, script blocks, golden path)

- [ ] s01a_counter (soup)
- [ ] s01b_counter (mixed)
- [ ] s01c_counter (chad)
- [ ] s02a_todo (soup)
- [ ] s02b_todo (mixed)
- [ ] s02c_todo (chad)
- [ ] s03a_chat (soup)
- [ ] s03b_chat (mixed)
- [ ] s03c_chat (chad)
- [ ] s04a_dashboard (soup)
- [ ] s04b_dashboard (mixed)
- [ ] s04c_dashboard (chad)
- [ ] s05a_settings (soup)
- [ ] s05b_settings (mixed)
- [ ] s05c_settings (chad)
- [ ] s06a_kanban (soup)
- [ ] s06b_kanban (mixed)
- [ ] s06c_kanban (chad)
- [ ] s07a_node_editor (soup)
- [ ] s07b_node_editor (mixed)
- [ ] s07c_node_editor (chad)
- [ ] s08a_chart (soup)
- [ ] s08b_chart (mixed)
- [ ] s08c_chart (chad)
- [ ] s09a_physics_sim (soup)
- [ ] s09b_physics_sim (mixed)
- [ ] s09c_physics_sim (chad)
- [ ] s10a_pixel_effect (soup)
- [ ] s10b_pixel_effect (mixed)
- [ ] s10c_pixel_effect (chad)
- [ ] s11a_text_icons (soup)
- [ ] s11b_text_icons (mixed)
- [ ] s11c_text_icons (chad)
- [ ] s12a_3d_scene (soup)
- [ ] s12b_3d_scene (mixed)
- [ ] s12c_3d_scene (chad)
- [ ] s13a_music_player (soup)
- [ ] s13b_music_player (mixed)
- [ ] s13c_music_player (chad)
- [ ] s14a_file_browser (soup)
- [ ] s14b_file_browser (mixed)
- [ ] s14c_file_browser (chad)
- [ ] s15a_spreadsheet (soup)
- [ ] s15b_spreadsheet (mixed)
- [ ] s15c_spreadsheet (chad)

## SECTION X — Surface Conformance: Logic (l01–l20)
#
# Same three tiers. Soup is npm-style Node.js patterns.
#   a = soup (classes, Promise chains, Node APIs)
#   b = mixed (today's script/zscript blocks)
#   c = chad (clean separation, right runtime for the job)

## SECTION X — Surface Conformance: Logic (l01–l20)
#
# Same three tiers. Soup is npm-style Node.js patterns.
#   a = soup (classes, Promise chains, Node APIs)
#   b = mixed (today's script/zscript blocks)
#   c = chad (clean separation, right runtime for the job)

- [ ] l01a_event_emitter (soup)
- [ ] l01b_event_emitter (mixed)
- [ ] l01c_event_emitter (chad)
- [ ] l02a_state_machine (soup)
- [ ] l02b_state_machine (mixed)
- [ ] l02c_state_machine (chad)
- [ ] l03a_reactive_store (soup)
- [ ] l03b_reactive_store (mixed)
- [ ] l03c_reactive_store (chad)
- [ ] l04a_async_queue (soup)
- [ ] l04b_async_queue (mixed)
- [ ] l04c_async_queue (chad)
- [ ] l05a_data_pipeline (soup)
- [ ] l05b_data_pipeline (mixed)
- [ ] l05c_data_pipeline (chad)
- [ ] l06a_http_client (soup)
- [ ] l06b_http_client (mixed)
- [ ] l06c_http_client (chad)
- [ ] l07a_form_validator (soup)
- [ ] l07b_form_validator (mixed)
- [ ] l07c_form_validator (chad)
- [ ] l08a_timer_scheduler (soup)
- [ ] l08b_timer_scheduler (mixed)
- [ ] l08c_timer_scheduler (chad)
- [ ] l09a_cache (soup)
- [ ] l09b_cache (mixed)
- [ ] l09c_cache (chad)
- [ ] l10a_router (soup)
- [ ] l10b_router (mixed)
- [ ] l10c_router (chad)
- [ ] l11a_logger (soup)
- [ ] l11b_logger (mixed)
- [ ] l11c_logger (chad)
- [ ] l12a_pubsub (soup)
- [ ] l12b_pubsub (mixed)
- [ ] l12c_pubsub (chad)
- [ ] l13a_orm_lite (soup)
- [ ] l13b_orm_lite (mixed)
- [ ] l13c_orm_lite (chad)
- [ ] l14a_crypto_utils (soup)
- [ ] l14b_crypto_utils (mixed)
- [ ] l14c_crypto_utils (chad)
- [ ] l15a_stream_processor (soup)
- [ ] l15b_stream_processor (mixed)
- [ ] l15c_stream_processor (chad)
- [ ] l16a_dependency_injection (soup)
- [ ] l16b_dependency_injection (mixed)
- [ ] l16c_dependency_injection (chad)
- [ ] l17a_parser_combinator (soup)
- [ ] l17b_parser_combinator (mixed)
- [ ] l17c_parser_combinator (chad)
- [ ] l18a_ecs (soup)
- [ ] l18b_ecs (mixed)
- [ ] l18c_ecs (chad)
- [ ] l19a_math_lib (soup)
- [ ] l19b_math_lib (mixed)
- [ ] l19c_math_lib (chad)
- [ ] l20a_task_runner (soup)
- [ ] l20b_task_runner (mixed)
- [ ] l20c_task_runner (chad)

# END OF LEDGER
# 271 tests registered. 128 passed. 21 failed. 122 untested.
