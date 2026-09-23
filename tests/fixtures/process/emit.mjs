const args = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
  args.set(process.argv[index], process.argv[index + 1] ?? '');
}

if (args.has('--sleep')) {
  await new Promise((resolve) => setTimeout(resolve, Number(args.get('--sleep'))));
}
if (args.has('--secret')) process.stdout.write(`token=${args.get('--secret')}\n`);
if (args.has('--literal')) process.stdout.write(`${args.get('--literal')}\n`);
if (args.has('--bytes')) process.stdout.write('x'.repeat(Number(args.get('--bytes'))));
if (args.has('--stderr')) process.stderr.write(`${args.get('--stderr')}\n`);
if (args.has('--exit')) process.exit(Number(args.get('--exit')));
