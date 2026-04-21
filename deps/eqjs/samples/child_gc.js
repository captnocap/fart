export function main() {
  let ping;
  {
    const child = eqjs.spawn_child(
      "export function ping() { return 42 }",
      { label: "child.gc" }
    );
    ping = child.exports.ping;
  }

  collectgarbage("collect");
  collectgarbage("collect");

  return ping();
}
