import { environment } from '@atlasmed/config'
import { CnesFtpAdapter } from './cnes-ftp.adapter'
import type { CnesFtpPort, CnesReference } from './cnes-ftp.port'
import { MockCnesFtpAdapter } from './mock-cnes-ftp.adapter'

export type CnesFtpMode = 'mock' | 'ftp'

export function createCnesFtpAdapter(input: {
  mode?: CnesFtpMode
  reference?: CnesReference
  host?: string
  user?: string
  password?: string
  basePath?: string
}): CnesFtpPort {
  const mode = input.mode ?? environment.CNES_FTP_MODE

  if (mode === 'mock') {
    return new MockCnesFtpAdapter(input.reference)
  }

  const host = input.host ?? environment.CNES_FTP_HOST
  if (!host) {
    throw new Error('CNES_FTP_HOST is required when CNES_FTP_MODE=ftp')
  }

  return new CnesFtpAdapter({
    host,
    user: input.user ?? environment.CNES_FTP_USER,
    password: input.password ?? environment.CNES_FTP_PASSWORD,
    basePath: input.basePath ?? environment.CNES_FTP_BASE_PATH
  })
}
