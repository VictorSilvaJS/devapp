const major = Number.parseInt(process.versions.node.split('.')[0] ?? '', 10);

if (major !== 24) {
  console.error(
    `O backend exige Node.js 24.x; versão atual: ${process.versions.node}.`,
  );
  process.exit(1);
}
