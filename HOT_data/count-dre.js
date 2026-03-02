const fs = require('fs');
const lines = fs.readFileSync('dre_settlements.csv', 'utf-8').split('\n');
let realNames = 0, locationNums = 0, empty = 0;
for (let i = 1; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) continue;
  const matches = line.match(/"([^"]*)"/g);
  if (!matches || matches.length < 5) continue;
  const name = matches[4].replace(/"/g, '');
  if (/^Location #\d+$/.test(name)) locationNums++;
  else if (name.length >= 2) realNames++;
  else empty++;
}
console.log('Real named settlements:', realNames);
console.log('Generic Location #NNN:', locationNums);
console.log('Empty/too short:', empty);
