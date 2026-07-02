export function download(name: string, data: Uint8Array | string, type: string) {
  const blob = typeof data === "string"
    ? new Blob([data], { type })
    : new Blob([new Uint8Array(data)], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Defer the revoke so the browser has started reading the blob; a late
  // revoke only briefly retains memory, an early one can kill the download.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
