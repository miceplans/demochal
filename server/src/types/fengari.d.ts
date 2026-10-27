// fengari ships no TypeScript types; declare the slice of its Lua C API the
// rate-limit storage spec uses. Opaque LuaState keeps this minimal.
declare module 'fengari' {
  export type LuaState = object;

  export const lua: {
    LUA_OK: number;
    LUA_TNIL: number;
    LUA_TBOOLEAN: number;
    LUA_TNUMBER: number;
    LUA_TSTRING: number;
    lua_createtable(L: LuaState, narr: number, nrec: number): void;
    lua_gettop(L: LuaState): number;
    lua_pop(L: LuaState, n: number): void;
    lua_pushboolean(L: LuaState, value: boolean): void;
    lua_pushcfunction(L: LuaState, fn: (L: LuaState) => number): void;
    lua_pushnil(L: LuaState): void;
    lua_pushnumber(L: LuaState, value: number): void;
    lua_pushstring(L: LuaState, value: Uint8Array): void;
    lua_rawgeti(L: LuaState, idx: number, n: number): void;
    lua_rawseti(L: LuaState, idx: number, n: number): void;
    lua_setglobal(L: LuaState, name: Uint8Array): void;
    lua_settable(L: LuaState, idx: number): void;
    lua_toboolean(L: LuaState, idx: number): boolean;
    lua_tonumberx(L: LuaState, idx: number, isnum: { value: boolean } | null): number;
    lua_tojsstring(L: LuaState, idx: number): string;
    lua_type(L: LuaState, idx: number): number;
  };

  export const lauxlib: {
    luaL_newstate(): LuaState;
    luaL_dostring(L: LuaState, script: Uint8Array): number;
  };

  export const lualib: {
    luaL_openlibs(L: LuaState): void;
  };

  export function to_luastring(value: string): Uint8Array;
}
