export type LifecycleEvent = 'RUN_ACCEPTED' | 'SCOPE_START' | 'PAYLOAD_START' | 'REPORT_START' | 'PUBLICATION_START' | 'RUN_COMPLETE'

export function lifecycleLine (event: LifecycleEvent): string {
  switch (event) {
    case 'RUN_ACCEPTED':
      return 'RUN_ACCEPTED'
    case 'SCOPE_START':
      return 'RUN_PHASE phase=scope_discovery'
    case 'PAYLOAD_START':
      return 'RUN_PHASE phase=page_processing'
    case 'REPORT_START':
      return 'RUN_PHASE phase=report_generation'
    case 'PUBLICATION_START':
      return 'RUN_PHASE phase=zip_packaging'
    case 'RUN_COMPLETE':
      return 'RUN_COMPLETE'
  }
}
