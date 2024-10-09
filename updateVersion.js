const fs = require('fs');
const path = require('path');

const packageJsonPath = path.join(__dirname, 'package.json');

fs.readFile(packageJsonPath, 'utf8', (err, data) => {
  if (err) {
    console.error('Failed to read package.json');
    process.exit(1);
  }

  let packageJson = JSON.parse(data);
  let currentVersion = packageJson.version;
  let versionParts = currentVersion.split('.');
  versionParts[2] = (parseInt(versionParts[2]) + 1).toString(); // Increment patch version
  let newVersion = versionParts.join('.');

  packageJson.version = newVersion;

  fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2), (err) => {
    if (err) {
      console.error('Failed to write updated package.json');
      process.exit(1);
    } else {
      console.log(`Version updated to ${newVersion}`);
    }
  });
});