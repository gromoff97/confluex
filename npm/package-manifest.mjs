export const nativePackage = {
  cargoPackage: 'confluex',
  cargoBinaryName: process.platform === 'win32' ? 'confluex.exe' : 'confluex',
  packageBinaryPath: 'bin/confluex'
}
