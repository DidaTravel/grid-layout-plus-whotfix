#!/usr/bin/env node
const { execSync } = await import('node:child_process')
const fs = await import('node:fs')
const { join, dirname } = await import('node:path')
const { argv } = await import('node:process')
const readline = (await import('node:readline')).createInterface({
  input: process.stdin,
  output: process.stdout,
})
const __dirname = dirname(new URL(import.meta.url).pathname)
// modify package.json
const pkgJson = readJson(__dirname + '/../package.json')
const packageDomain = '@dida-whotfix'
const baseName = pkgJson.name
const whotfixPackageName = packageDomain + '/' + baseName
const baseVersion = pkgJson.version

function prepare(nextVersion) {
  // clean temp package-out folder
  execSync('rm -rf temp/package-out', { stdio: 'inherit' })
  // build the project
  execSync('pnpm run build', { stdio: 'inherit' })
  // create temp package-out folder
  execSync('mkdir -p temp/package-out', { stdio: 'inherit' })
  // copy files to temp folder
  pkgJson.files.forEach(file => {
    if (!fs.existsSync(join(__dirname, '..', file))) {
      console.warn(`File ${file} does not exist, skipping.`)
      return
    }
    execSync(`cp -R ${file} temp/package-out/${file}`, { stdio: 'inherit' })
  })
  // modify package.json
  const builtOutputPkgJsonPath = join(__dirname, '..', 'temp', 'package-out', 'package.json')
  const builtOutputPkgJson = readJson(builtOutputPkgJsonPath)
  builtOutputPkgJson.name = whotfixPackageName
  builtOutputPkgJson.version = nextVersion
  builtOutputPkgJson.repository = {
    type: 'git',
    url: 'git+https://github.com/DidaTravel/grid-layout-plus-whotfix.git'
  }
  builtOutputPkgJson.homepage = 'https://github.com/DidaTravel/grid-layout-plus-whotfix#readme'
  delete builtOutputPkgJson.scripts
  delete builtOutputPkgJson.volta
  fs.writeFileSync(builtOutputPkgJsonPath, JSON.stringify(builtOutputPkgJson, null, 2) + '\n')
}

function publish(registry) {
  const publishFlags = ['--access restricted', '--tag latest', '--registry ' + registry]
  execSync(`npm publish ${publishFlags.join(' ')}`, {
    cwd: join(__dirname, '..', 'temp', 'package-out'),
    stdio: 'inherit'
  })
}

function resolveRegistry() {
  // reed .npmrc file
  const npmrcPath = join(__dirname, '..', '.npmrc')
  if (fs.existsSync(npmrcPath)) {
    const npmrcContent = fs.readFileSync(npmrcPath, { encoding: 'utf-8' })
    const lines = npmrcContent.split('\n')
    for (const line of lines) {
      if (line.startsWith('registry=')) {
        return line.split('=')[1].trim()
      }
    }
  }
  return null
}

function getLatestVersion(packageName, registry) {
  try {
    const result = execSync(`npm view ${packageName} version --registry ${registry}`, {
      encoding: 'utf-8'
    })
    return result.trim()
  } catch (error) {
    console.error('Failed to get latest version:', error.toString())
    return null
  }
}

function readJson(path) {
  let data = fs.readFileSync(path, { encoding: 'utf-8' })
  data = data.replace(/\\"|"(?:\\"|[^"])*"|(\/\/.*|\/\*[\s\S]*?\*\/)/g, (m, g) => (g ? '' : m))
  const json = JSON.parse(data)
  return json
}

function buildNextVersion(currentVersion) {
  if (!currentVersion) {
    return baseVersion + '-hotfix.1'
  }
  const parts = currentVersion.split('-hotfix.')
  if (parts[0] !== baseVersion) {
    return baseVersion + '-hotfix.1'
  }
  const hotfixPart = parseInt(parts[1], 10)
  parts[1] = hotfixPart + 1
  return parts.join('-hotfix.')
}

console.info('Starting publish script...')
let buildOnly = false
for (const arg of argv) {
  if (arg === '--buildOnly') {
    buildOnly = true
    console.info('Build only mode enabled, no publishing will be done.')
  }
}

const registry = resolveRegistry()
if (registry) {
  console.info('Using registry:', registry)
} else {
  console.warn('No registry found in .npmrc, using default npm registry.')
  process.exit(1)
}

const curVersion = getLatestVersion(whotfixPackageName, registry)
const nextVersion = buildNextVersion(curVersion)
readline.question(
  `No version specified. Use a new version (from ${curVersion} to: ${nextVersion})? (y/n): `,
  answer => {
    if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
      console.info('Using new version:', nextVersion)
      readline.close()
      proceed(nextVersion)
    } else {
      console.error('Version not specified. Exiting.')
      readline.close()
      process.exit(1)
    }
  }
)

function proceed(version) {
  prepare(version)
  if (!buildOnly) {
    publish(registry)
  } else {
    console.info('Build completed. Skipping publish step.')
  }
  process.exit(0)
}
