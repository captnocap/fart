export function main() {
  const commands = eqjs.shared_memory.commands

  commands[0] = 1
  commands[1] = 10
  commands[2] = 20
  commands[3] = 30
  commands[4] = 40
  commands[5] = 255
  commands[6] = 128
  commands[7] = 64

  commands[8] = 2
  commands[9] = 50
  commands[10] = 60
  commands[11] = 70
  commands[12] = 80
  commands[13] = 0
  commands[14] = 200
  commands[15] = 255

  return commands[1] + commands[4] + commands[9] + commands[12]
}
