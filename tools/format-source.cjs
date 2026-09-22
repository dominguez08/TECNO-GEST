const fs = require('node:fs');
const path = require('node:path');
const prettier = require('prettier');

(async () => {
  const file = path.join(__dirname, '../assets/app.js');
  let source = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  const { ast } = await prettier.__debug.parse(source, { parser: 'babel' });
  const inserts = [];

  function visit(node, parent) {
    if (!node || typeof node !== 'object') return;
    if (
      node.type === 'TemplateLiteral' &&
      parent?.type !== 'TaggedTemplateExpression' &&
      /^\s*</.test(node.quasis[0].value.raw)
    ) {
      inserts.push(node.start);
    }
    for (const [key, value] of Object.entries(node)) {
      if (['loc', 'tokens', 'comments'].includes(key)) continue;
      if (Array.isArray(value)) value.forEach((child) => visit(child, node));
      else if (value && typeof value === 'object') visit(value, node);
    }
  }

  visit(ast, null);
  for (const index of [...new Set(inserts)].sort((a, b) => b - a)) {
    source = source.slice(0, index) + 'html' + source.slice(index);
  }
  fs.writeFileSync(file, source);
})();
