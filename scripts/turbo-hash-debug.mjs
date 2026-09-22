// TEMPORARY diagnostic: print every hash input turbo sees for gen:base-stls,
// one per line, so two Vercel build logs can be diffed. Remove after use.
let s = "";
process.stdin.on("data", (d) => (s += d)).on("end", () => {
  const j = JSON.parse(s);
  const g = j.globalCacheInputs;
  console.log("HASHDBG turboVersion=" + j.turboVersion + " envMode=" + j.envMode + " pm=" + JSON.stringify(j.packageManager ?? null));
  console.log("HASHDBG global.files=" + JSON.stringify(g.files));
  console.log("HASHDBG global.ext=" + g.hashOfExternalDependencies + " int=" + g.hashOfInternalDependencies + " engines=" + JSON.stringify(g.engines));
  console.log("HASHDBG global.env=" + JSON.stringify(g.environmentVariables));
  for (const t of j.tasks) {
    console.log(`HASHDBG task ${t.taskId} hash=${t.hash} ext=${t.hashOfExternalDependencies} deps=${JSON.stringify(t.dependencies)} env=${JSON.stringify(t.environmentVariables)}`);
    console.log(`HASHDBG task ${t.taskId} resolvedTaskDefinition=${JSON.stringify(t.resolvedTaskDefinition)}`);
    const inputs = t.inputs ?? t.expandedInputs ?? {};
    console.log(`HASHDBG task ${t.taskId} inputCount=${Object.keys(inputs).length}`);
    for (const [f, h] of Object.entries(inputs)) console.log(`HASHDBG in ${t.taskId} ${h} ${f}`);
  }
});
