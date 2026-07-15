export function workflowIdForReference(ano: number, mes: number): string {
  return `cnes-ingestion-${ano}-${String(mes).padStart(2, '0')}`
}
