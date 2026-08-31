const fs = require('fs');
const path = require('path');

if (process.env.EAS_BUILD_PLATFORM && process.env.EAS_BUILD_PLATFORM !== 'android') {
  console.log('Skipping google-services.json preparation for a non-Android build.');
  process.exit(0);
}

const appRoot = process.cwd();
const destination = path.join(appRoot, 'android', 'app', 'google-services.json');
const source = process.env.GOOGLE_SERVICES_JSON || destination;

if (!fs.existsSync(source)) {
  throw new Error(
    `Firebase configuration is missing. Set GOOGLE_SERVICES_JSON or provide ${destination}.`,
  );
}

const buildGradlePath = path.join(appRoot, 'android', 'app', 'build.gradle');
const rawConfig = fs.readFileSync(source, 'utf8');
const firebaseConfig = JSON.parse(rawConfig);
const buildGradle = fs.readFileSync(buildGradlePath, 'utf8');
const applicationId = buildGradle.match(/applicationId\s+['"]([^'"]+)['"]/)?.[1];
const configuredPackages = (firebaseConfig.client ?? [])
  .map((client) => client.client_info?.android_client_info?.package_name)
  .filter(Boolean);
const oauthClients = (firebaseConfig.client ?? []).flatMap((client) => [
  ...(client.oauth_client ?? []),
  ...(client.services?.appinvite_service?.other_platform_oauth_client ?? []),
]);
const oauthProjectNumber = String(firebaseConfig.project_info?.project_number ?? '').trim();
const googleWebClientId = String(process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '').trim();

if (!applicationId) {
  throw new Error(`Unable to read applicationId from ${buildGradlePath}.`);
}

if (!configuredPackages.includes(applicationId)) {
  throw new Error(
    `Firebase config packages (${configuredPackages.join(', ') || 'none'}) do not include ${applicationId}.`,
  );
}

if (!oauthProjectNumber) {
  throw new Error('Firebase configuration does not contain project_info.project_number.');
}

if (!/^\d+-[a-zA-Z0-9_-]+\.apps\.googleusercontent\.com$/.test(googleWebClientId)) {
  throw new Error(
    'Google Sign-In is not configured. Set EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID to this app project\'s Web OAuth client ID in the selected EAS environment.',
  );
}

if (!googleWebClientId.startsWith(`${oauthProjectNumber}-`)) {
  throw new Error(
    `Google Sign-In OAuth project mismatch for ${applicationId}. The Web OAuth client must belong to Firebase project number ${oauthProjectNumber}.`,
  );
}

const configuredWebClientIds = new Set(
  oauthClients
    .filter((client) => client.client_type === 3)
    .map((client) => String(client.client_id ?? '').trim())
    .filter(Boolean),
);
if (!configuredWebClientIds.has(googleWebClientId)) {
  throw new Error(
    `Firebase configuration for ${applicationId} is stale or incomplete: it does not contain the configured Web OAuth client. Download a fresh google-services.json after creating the Web client.`,
  );
}

const androidOauthClients = oauthClients.filter((client) =>
  client.client_type === 1 &&
  client.android_info?.package_name === applicationId &&
  String(client.android_info?.certificate_hash ?? '').trim(),
);
if (androidOauthClients.length === 0) {
  throw new Error(
    `Firebase configuration for ${applicationId} has no certificate-bound Android OAuth client. Register the package and signing SHA-1, then download a fresh google-services.json.`,
  );
}

fs.mkdirSync(path.dirname(destination), { recursive: true });
fs.writeFileSync(destination, rawConfig, { encoding: 'utf8', mode: 0o600 });
console.log(`Prepared android/app/google-services.json for ${applicationId}.`);
