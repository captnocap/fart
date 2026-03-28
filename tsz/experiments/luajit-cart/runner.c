// runner.c — LuaJIT + engine .a in one binary
// Cart .lua calls rjit_* via ffi.C (symbols already linked in)
// We reference rjit_* to force the linker to include them.
#include <stdio.h>
#include <luajit-2.1/lua.h>
#include <luajit-2.1/lualib.h>
#include <luajit-2.1/lauxlib.h>

// Force-link engine symbols so ffi.C can find them
extern int rjit_engine_run(void *config);
extern unsigned long rjit_state_create_slot(long initial);
extern long rjit_state_get_slot(unsigned long id);
extern void rjit_state_set_slot(unsigned long id, long val);
extern unsigned long rjit_state_create_slot_float(double initial);
extern double rjit_state_get_slot_float(unsigned long id);
extern void rjit_state_set_slot_float(unsigned long id, double val);
extern unsigned long rjit_state_create_slot_bool(int initial);
extern int rjit_state_get_slot_bool(unsigned long id);
extern void rjit_state_set_slot_bool(unsigned long id, int val);
extern unsigned long rjit_state_create_slot_string(const char *ptr, unsigned long len);
extern const char *rjit_state_get_slot_string_ptr(unsigned long id);
extern unsigned long rjit_state_get_slot_string_len(unsigned long id);
extern void rjit_state_set_slot_string(unsigned long id, const char *ptr, unsigned long len);
extern void rjit_state_mark_dirty(void);
extern int rjit_state_is_dirty(void);
extern void rjit_state_clear_dirty(void);
extern void rjit_qjs_register_host_fn(const char *name, void *fn_ptr, unsigned char argc);
extern void rjit_qjs_call_global(const char *name);
extern void rjit_qjs_call_global_str(const char *name, const char *arg);
extern void rjit_qjs_call_global_int(const char *name, long arg);
extern void rjit_qjs_eval_expr(const char *expr);

// Volatile pointer array to prevent dead-code elimination
static volatile void *_force_link[] = {
    (void*)rjit_engine_run,
    (void*)rjit_state_create_slot,
    (void*)rjit_state_get_slot,
    (void*)rjit_state_set_slot,
    (void*)rjit_state_create_slot_float,
    (void*)rjit_state_get_slot_float,
    (void*)rjit_state_set_slot_float,
    (void*)rjit_state_create_slot_bool,
    (void*)rjit_state_get_slot_bool,
    (void*)rjit_state_set_slot_bool,
    (void*)rjit_state_create_slot_string,
    (void*)rjit_state_get_slot_string_ptr,
    (void*)rjit_state_get_slot_string_len,
    (void*)rjit_state_set_slot_string,
    (void*)rjit_state_mark_dirty,
    (void*)rjit_state_is_dirty,
    (void*)rjit_state_clear_dirty,
    (void*)rjit_qjs_register_host_fn,
    (void*)rjit_qjs_call_global,
    (void*)rjit_qjs_call_global_str,
    (void*)rjit_qjs_call_global_int,
    (void*)rjit_qjs_eval_expr,
};

int main(int argc, char **argv) {
    (void)_force_link; // suppress unused warning

    if (argc < 2) {
        fprintf(stderr, "Usage: rjit-lua <cart.lua>\n");
        return 1;
    }

    lua_State *L = luaL_newstate();
    luaL_openlibs(L);

    if (luaL_dofile(L, argv[1]) != 0) {
        fprintf(stderr, "Error: %s\n", lua_tostring(L, -1));
        lua_close(L);
        return 1;
    }

    lua_close(L);
    return 0;
}
