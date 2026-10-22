// Deterministic child-process fixture; never calls any AI service.
const fs = require('node:fs');
const args = process.argv.slice(2);
if (args.includes('status')) {
  if (args.includes('login')) process.stdout.write('Logged in using ChatGPT');
  else process.stdout.write(JSON.stringify({ loggedIn: true, authMethod: 'claude.ai' }));
} else {
  let input = '';
  process.stdin.on('data', c => { input += c; });
  process.stdin.on('end', () => {
    if (args.includes('--model') && args[args.indexOf('--model') + 1] === 'hang-test') { setInterval(() => {}, 1000); return; }
    const data = JSON.parse(input.split('\n\nDATA:\n')[1]);
    const result = { status: 'answered', answer_text: data.options[0], explanation: 'Fake CLI result.', evidence: [{ id: data.documents[0].id, quote: data.documents[0].text }] };
    if (args.includes('--output-last-message')) fs.writeFileSync(args[args.indexOf('--output-last-message') + 1], JSON.stringify(result));
    else process.stdout.write(JSON.stringify({ structured_output: result }));
  });
}
